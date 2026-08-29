import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { getPresignedUrlOrOriginal } from "../services/s3.service.js";

type AuthUser = { id: string; role: string; email?: string };

function getAdminUser(req: Request): AuthUser | null {
    const user = (req as any).user;
    if (!user?.id) return null;
    return user as AuthUser;
}

// ────────────────────────────────────────────────────────────────────
// 1. STATS & OVERVIEW
// ────────────────────────────────────────────────────────────────────
export const getServiceHubStats = async (_req: Request, res: Response): Promise<Response> => {
    try {
        const [
            totalTickets,
            openTickets,
            completedTickets,
            totalAssets,
            broadcastedTickets,
            emergencyTickets,
        ] = await Promise.all([
            prisma.service_tickets.count(),
            prisma.service_tickets.count({
                where: { status: { in: ["broadcasted", "quote_pending", "quoted", "accepted", "in_progress"] } },
            }),
            prisma.service_tickets.count({ where: { status: "completed" } }),
            prisma.client_assets.count({ where: { is_active: true } }),
            prisma.service_tickets.count({ where: { status: "broadcasted" } }),
            prisma.service_tickets.count({ where: { priority: "emergency_breakdown" } }),
        ]);

        return res.status(200).json({
            success: true,
            stats: {
                totalTickets,
                openTickets,
                completedTickets,
                totalAssets,
                broadcastedTickets,
                emergencyTickets,
            },
        });
    } catch (error) {
        console.error("Error fetching Service Hub stats:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch stats." });
    }
};

// ────────────────────────────────────────────────────────────────────
// 2. TICKETS MANAGEMENT (LIST, DETAIL, ASSIGN, STATUS, QUOTE)
// ────────────────────────────────────────────────────────────────────
export const getAllServiceTickets = async (req: Request, res: Response): Promise<Response> => {
    const { status, category_id, priority, search, page = "1", limit = "25" } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10)));
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {};

    if (status && typeof status === "string" && status.trim() !== "all") {
        whereClause.status = status.trim();
    }
    if (category_id && typeof category_id === "string" && category_id.trim() !== "all") {
        whereClause.category_id = category_id.trim();
    }
    if (priority && typeof priority === "string" && priority.trim() !== "all") {
        whereClause.priority = priority.trim();
    }
    if (search && typeof search === "string" && search.trim()) {
        whereClause.OR = [
            { ticket_number: { contains: search.trim(), mode: "insensitive" } },
            { client_user: { name: { contains: search.trim(), mode: "insensitive" } } },
        ];
    }

    try {
        const [total, tickets] = await Promise.all([
            prisma.service_tickets.count({ where: whereClause }),
            prisma.service_tickets.findMany({
                where: whereClause,
                include: {
                    product_category: { select: { id: true, label: true, code: true } },
                    subcategories: { select: { id: true, name: true } },
                    client_user: { select: { id: true, name: true, email: true } },
                    vendors: { select: { id: true, company_name: true, phone: true } },
                    assigned_agent: { select: { id: true, name: true, email: true } },
                    client_asset: { select: { id: true, asset_name: true, brand: true, model_number: true } },
                    _count: { select: { service_ticket_quotations: true, service_ticket_documents: true } },
                },
                orderBy: { created_at: "desc" },
                skip,
                take: limitNum,
            }),
        ]);

        return res.status(200).json({
            success: true,
            tickets,
            pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
        });
    } catch (error) {
        console.error("Error fetching all service tickets:", error);
        return res.status(500).json({ success: false, message: "Failed to load service tickets." });
    }
};

export const getServiceTicketById = async (req: Request, res: Response): Promise<Response> => {
    const id = String(req.params.id);

    try {
        const ticket = await prisma.service_tickets.findUnique({
            where: { id },
            include: {
                product_category: true,
                subcategories: true,
                client_user: { select: { id: true, name: true, email: true } },
                vendors: { select: { id: true, company_name: true, phone: true, rating: true } },
                assigned_agent: { select: { id: true, name: true, email: true } },
                client_asset: true,
                service_ticket_quotations: {
                    include: {
                        vendors: { select: { id: true, company_name: true, phone: true, rating: true } },
                    },
                    orderBy: { created_at: "desc" },
                },
                service_ticket_documents: {
                    include: {
                        uploaded_by_user: { select: { id: true, name: true } },
                    },
                    orderBy: { created_at: "asc" },
                },
            },
        });

        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket not found." });
        }

        return res.status(200).json({ success: true, ticket });
    } catch (error) {
        console.error("Error fetching ticket detail:", error);
        return res.status(500).json({ success: false, message: "Failed to load ticket." });
    }
};

export const updateTicketStatus = async (req: Request, res: Response): Promise<Response> => {
    const admin = getAdminUser(req);
    const id = String(req.params.id);
    const { status, note } = req.body;

    if (!status) {
        return res.status(400).json({ success: false, message: "Status is required." });
    }

    try {
        const existing = await prisma.service_tickets.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ success: false, message: "Ticket not found." });
        }

        const currentTimeline = (Array.isArray(existing.timeline_logs) ? existing.timeline_logs : []) as any[];
        const newTimeline = [
            ...currentTimeline,
            {
                status,
                note: note || `Status changed to ${status} by Admin.`,
                timestamp: new Date().toISOString(),
                by_user_id: admin?.id || "admin",
            },
        ];

        const updateData: any = {
            status,
            timeline_logs: newTimeline,
            updated_at: new Date(),
        };

        if (status === "completed" && !existing.otp_verified_at) {
            updateData.otp_verified_at = new Date();
        }

        const updated = await prisma.service_tickets.update({
            where: { id },
            data: updateData,
        });

        return res.status(200).json({
            success: true,
            message: `Ticket status updated to ${status}.`,
            ticket: updated,
        });
    } catch (error) {
        console.error("Error updating ticket status:", error);
        return res.status(500).json({ success: false, message: "Failed to update ticket status." });
    }
};

export const assignTicketPersonnel = async (req: Request, res: Response): Promise<Response> => {
    const admin = getAdminUser(req);
    const id = String(req.params.id);
    const { vendor_id, assigned_agent_id, note } = req.body;

    try {
        const existing = await prisma.service_tickets.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ success: false, message: "Ticket not found." });
        }

        const currentTimeline = (Array.isArray(existing.timeline_logs) ? existing.timeline_logs : []) as any[];
        const newTimeline = [
            ...currentTimeline,
            {
                status: existing.status === "broadcasted" ? "in_progress" : existing.status,
                note: note || "Vendor / Technician assigned by Admin.",
                timestamp: new Date().toISOString(),
                by_user_id: admin?.id || "admin",
            },
        ];

        const updated = await prisma.service_tickets.update({
            where: { id },
            data: {
                vendor_id: vendor_id || existing.vendor_id,
                assigned_agent_id: assigned_agent_id || existing.assigned_agent_id,
                status: existing.status === "broadcasted" ? "in_progress" : existing.status,
                timeline_logs: newTimeline,
                updated_at: new Date(),
            },
        });

        return res.status(200).json({
            success: true,
            message: "Assigned personnel updated.",
            ticket: updated,
        });
    } catch (error) {
        console.error("Error assigning personnel:", error);
        return res.status(500).json({ success: false, message: "Failed to assign personnel." });
    }
};

// ────────────────────────────────────────────────────────────────────
// 3. ADMIN SUBCATEGORY FORM-SCHEMA BUILDER
// ────────────────────────────────────────────────────────────────────
export const updateSubcategorySchema = async (req: Request, res: Response): Promise<Response> => {
    const id = String(req.params.id);
    const { form_schema } = req.body;

    if (!Array.isArray(form_schema)) {
        return res.status(400).json({ success: false, message: "form_schema must be an array of field definitions." });
    }

    try {
        const updated = await prisma.subcategories.update({
            where: { id },
            data: {
                form_schema,
                updated_at: new Date(),
            },
        });

        return res.status(200).json({
            success: true,
            message: "Subcategory dynamic form schema updated.",
            subcategory: updated,
        });
    } catch (error) {
        console.error("Error updating form schema:", error);
        return res.status(500).json({ success: false, message: "Failed to update form schema." });
    }
};

// ────────────────────────────────────────────────────────────────────
// 5. SERVICE CATEGORIES & SUBCATEGORIES DYNAMIC MANAGEMENT
// ────────────────────────────────────────────────────────────────────
export const getServiceCategories = async (_req: Request, res: Response): Promise<Response> => {
    try {
        const categories = await prisma.product_category.findMany({
            where: { category_type: "service", is_active: true },
            include: {
                subcategories: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        form_schema: true,
                        created_at: true,
                        updated_at: true,
                    },
                    orderBy: { name: "asc" },
                },
            },
            orderBy: [{ sort_order: "asc" }, { label: "asc" }],
        });

        const resolvedCategories = await Promise.all(
            categories.map(async (cat) => ({
                ...cat,
                image: await getPresignedUrlOrOriginal(cat.image),
            }))
        );

        return res.status(200).json({ success: true, categories: resolvedCategories });
    } catch (error) {
        console.error("Error fetching service categories:", error);
        return res.status(500).json({ success: false, message: "Failed to load categories." });
    }
};

export const createServiceCategory = async (req: Request, res: Response): Promise<Response> => {
    const { code, label, description, image, sort_order, min_commision_percentage, max_commision_percentage } = req.body;

    if (!code || !label) {
        return res.status(400).json({ success: false, message: "Code and Label are required." });
    }

    try {
        const category = await prisma.product_category.create({
            data: {
                code: String(code).trim().toLowerCase().replace(/\s+/g, "_"),
                label: String(label).trim(),
                description: description ? String(description).trim() : null,
                image: image ? String(image).trim() : "",
                category_type: "service",
                sort_order: parseInt(String(sort_order || 0), 10),
                min_commision_percentage: parseInt(String(min_commision_percentage || 0), 10),
                max_commision_percentage: parseInt(String(max_commision_percentage || 10), 10),
                is_active: true,
            },
        });

        return res.status(201).json({ success: true, message: "Service category created.", category });
    } catch (error: any) {
        console.error("Error creating service category:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to create category." });
    }
};

export const updateServiceCategory = async (req: Request, res: Response): Promise<Response> => {
    const id = String(req.params.id);
    const { label, description, image, sort_order, is_active, min_commision_percentage, max_commision_percentage } = req.body;

    try {
        const category = await prisma.product_category.update({
            where: { id },
            data: {
                ...(label !== undefined && { label: String(label).trim() }),
                ...(description !== undefined && { description: String(description).trim() }),
                ...(image !== undefined && { image: String(image).trim() }),
                ...(sort_order !== undefined && { sort_order: parseInt(String(sort_order), 10) }),
                ...(is_active !== undefined && { is_active: Boolean(is_active) }),
                ...(min_commision_percentage !== undefined && { min_commision_percentage: parseInt(String(min_commision_percentage), 10) }),
                ...(max_commision_percentage !== undefined && { max_commision_percentage: parseInt(String(max_commision_percentage), 10) }),
            },
        });

        return res.status(200).json({ success: true, message: "Service category updated.", category });
    } catch (error: any) {
        console.error("Error updating service category:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to update category." });
    }
};

export const deleteServiceCategory = async (req: Request, res: Response): Promise<Response> => {
    const id = String(req.params.id);
    try {
        await prisma.product_category.delete({ where: { id } });
        return res.status(200).json({ success: true, message: "Service category deleted." });
    } catch (error: any) {
        console.error("Error deleting service category:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to delete category." });
    }
};

export const createServiceSubcategory = async (req: Request, res: Response): Promise<Response> => {
    const { category_id, name, description, form_schema } = req.body;

    if (!category_id || !name) {
        return res.status(400).json({ success: false, message: "Category ID and Subcategory Name are required." });
    }

    try {
        const subcategory = await prisma.subcategories.create({
            data: {
                category_id: String(category_id),
                name: String(name).trim(),
                description: description ? String(description).trim() : null,
                form_schema: Array.isArray(form_schema) ? form_schema : [],
            },
        });

        return res.status(201).json({ success: true, message: "Subcategory created successfully.", subcategory });
    } catch (error: any) {
        console.error("Error creating subcategory:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to create subcategory." });
    }
};

export const updateServiceSubcategory = async (req: Request, res: Response): Promise<Response> => {
    const id = String(req.params.id);
    const { name, description, form_schema } = req.body;

    try {
        const subcategory = await prisma.subcategories.update({
            where: { id },
            data: {
                ...(name !== undefined && { name: String(name).trim() }),
                ...(description !== undefined && { description: String(description).trim() }),
                ...(form_schema !== undefined && { form_schema: Array.isArray(form_schema) ? form_schema : [] }),
                updated_at: new Date(),
            },
        });

        return res.status(200).json({ success: true, message: "Subcategory updated successfully.", subcategory });
    } catch (error: any) {
        console.error("Error updating subcategory:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to update subcategory." });
    }
};

export const deleteServiceSubcategory = async (req: Request, res: Response): Promise<Response> => {
    const id = String(req.params.id);
    try {
        await prisma.subcategories.delete({ where: { id } });
        return res.status(200).json({ success: true, message: "Subcategory deleted successfully." });
    } catch (error: any) {
        console.error("Error deleting subcategory:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to delete subcategory." });
    }
};

// ────────────────────────────────────────────────────────────────────
// 6. CLIENT ASSETS OVERSIGHT
// ────────────────────────────────────────────────────────────────────
export const getAllClientAssets = async (req: Request, res: Response): Promise<Response> => {
    const { search, page = "1", limit = "25" } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10)));
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = { is_active: true };

    if (search && typeof search === "string" && search.trim()) {
        whereClause.OR = [
            { asset_name: { contains: search.trim(), mode: "insensitive" } },
            { brand: { contains: search.trim(), mode: "insensitive" } },
            { asset_code: { contains: search.trim(), mode: "insensitive" } },
            { users: { name: { contains: search.trim(), mode: "insensitive" } } },
        ];
    }

    try {
        const [total, assets] = await Promise.all([
            prisma.client_assets.count({ where: whereClause }),
            prisma.client_assets.findMany({
                where: whereClause,
                include: {
                    users: { select: { id: true, name: true, email: true } },
                    product_category: { select: { id: true, label: true } },
                    subcategories: { select: { id: true, name: true } },
                    _count: { select: { service_tickets: true } },
                },
                orderBy: { created_at: "desc" },
                skip,
                take: limitNum,
            }),
        ]);

        return res.status(200).json({
            success: true,
            assets,
            pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
        });
    } catch (error) {
        console.error("Error fetching client assets:", error);
        return res.status(500).json({ success: false, message: "Failed to load assets." });
    }
};
