import type { Request, Response } from "express";
import { marketplacePool } from "../lib/marketplace.js";
import { createAndEmitNotification } from "../lib/notificationEmitter.js";
import { getPresignedUrlOrOriginal, s3Client, BUCKET_NAME } from "../services/s3.service.js";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const adminRoles = new Set(["admin", "super_admin"]);
const ALLOWED_MEDIA_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/x-msvideo"]);
const ALLOWED_SERVICE_STATUSES = new Set(["pending", "approved", "rejected"]);
const ALLOWED_PRICING_TYPES = new Set(["hourly", "project", "milestone", "flat"]);
const REVIEW_DECISIONS = new Set(["approved", "rejected"]);

type AdminUser = { userId: string; role: string };
type VendorUser = { userId: string; role: string };

function ensureAdmin(req: Request, res: Response): AdminUser | null {
    const user = (req as any).user;
    if (!user?.userId || !adminRoles.has(user.role)) {
        res.status(403).json({ message: "Forbidden! Only admins can perform this action." });
        return null;
    }
    return user as AdminUser;
}

function ensureAdminOrVendor(req: Request, res: Response): (AdminUser | VendorUser) | null {
    const user = (req as any).user;
    if (!user?.userId) {
        res.status(401).json({ message: "Unauthorized" });
        return null;
    }
    if (!adminRoles.has(user.role) && user.role !== "vendor") {
        res.status(403).json({ message: "Forbidden" });
        return null;
    }
    return user;
}

async function getVendorIdByUserId(userId: string): Promise<string | null> {
    const result = await marketplacePool.query(
        `SELECT id FROM vendors WHERE user_id = $1 AND approval_status = 'approved' LIMIT 1`,
        [userId]
    );
    return result.rows[0]?.id ?? null;
}

function normalizeText(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function parsePositiveDecimal(value: unknown): string | null {
    const n = parseFloat(String(value));
    if (isNaN(n) || n < 0) return null;
    return n.toFixed(2);
}

function parsePositiveInt(value: unknown): number | null {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
}

export async function adminListServicesController(req: Request, res: Response): Promise<Response> {
    if (!ensureAdmin(req, res)) return res as Response;

    const { status, search, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(String(page || "1"), 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit || "20"), 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (status && typeof status === "string" && ALLOWED_SERVICE_STATUSES.has(status)) {
        conditions.push(`s.status = $${idx++}`);
        values.push(status);
    }

    if (search && typeof search === "string" && search.trim().length > 0) {
        conditions.push(`(s.name ILIKE $${idx} OR s.description ILIKE $${idx})`);
        values.push(`%${search.trim()}%`);
        idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
        const [dataResult, countResult] = await Promise.all([
            marketplacePool.query(
                `SELECT
                    s.id, s.name, s.description, s.status, s.rating, s.review_count, s.category_id,
                    pc.label AS category_label,
                    CASE WHEN parent_sub.id IS NOT NULL THEN parent_sub.name || ' > ' || ss.name ELSE ss.name END AS subcategory_name,
                    (ss.approval_status = 'pending' OR parent_sub.approval_status = 'pending') AS has_new_subcategory,
                    COUNT(DISTINCT vs.id) AS vendor_count,
                    COUNT(DISTINCT sb.id) AS booking_count
                 FROM services s
                 LEFT JOIN service_categories pc ON pc.id = s.category_id
                 LEFT JOIN service_subcategories ss ON ss.id = s.subcategory_id
                 LEFT JOIN service_subcategories parent_sub ON parent_sub.id = ss.parent_id
                 LEFT JOIN vendor_services vs ON vs.service_id = s.id
                 LEFT JOIN service_bookings sb ON sb.vendor_service_id = vs.id
                 ${where}
                 GROUP BY s.id, pc.label, ss.id, parent_sub.id
                 ORDER BY s.created_at DESC
                 LIMIT $${idx} OFFSET $${idx + 1}`,
                [...values, limitNum, offset]
            ),
            marketplacePool.query(
                `SELECT COUNT(*) FROM services s ${where}`,
                values
            ),
        ]);

        return res.status(200).json({
            data: dataResult.rows,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: parseInt(countResult.rows[0].count, 10),
            },
        });
    } catch (error) {
        console.error("Error listing services (admin):", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function adminCreateServiceController(req: Request, res: Response): Promise<Response> {
    const authUser = ensureAdminOrVendor(req, res);
    if (!authUser) return res as Response;

    const { name, description, categoryId, status, subcategoryId, newSubcategoryName } = req.body as Record<string, unknown>;

    const nameVal = normalizeText(name);
    if (!nameVal) {
        return res.status(400).json({ message: "name is required" });
    }
    if (!categoryId || typeof categoryId !== "string") {
        return res.status(400).json({ message: "categoryId is required" });
    }
    
    let statusVal = "pending";
    if (adminRoles.has(authUser.role)) {
        statusVal = typeof status === "string" && ALLOWED_SERVICE_STATUSES.has(status) ? status : "pending";
    }

    try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId);
        const query = isUuid
            ? `SELECT id FROM service_categories WHERE id = $1 AND is_active = true LIMIT 1`
            : `SELECT id FROM service_categories WHERE (LOWER(code) = LOWER($1) OR LOWER(label) = LOWER($1)) AND is_active = true LIMIT 1`;
        
        const categoryCheck = await marketplacePool.query(query, [categoryId]);
        if (categoryCheck.rows.length === 0) {
            return res.status(404).json({ message: "Category not found or inactive" });
        }
        const resolvedCategoryId = categoryCheck.rows[0].id;

        let resolvedSubcategoryId: string | null = null;

        if (newSubcategoryName && typeof newSubcategoryName === "string" && newSubcategoryName.trim()) {
            const subName = newSubcategoryName.trim();
            const subCheck = await marketplacePool.query(
                `SELECT id FROM service_subcategories WHERE category_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
                [resolvedCategoryId, subName]
            );
            if (subCheck.rows.length > 0) {
                resolvedSubcategoryId = subCheck.rows[0].id;
            } else {
                const subInsert = await marketplacePool.query(
                    `INSERT INTO service_subcategories (category_id, name)
                     VALUES ($1, $2)
                     RETURNING id`,
                    [resolvedCategoryId, subName]
                );
                resolvedSubcategoryId = subInsert.rows[0].id;
            }
        } else if (subcategoryId && typeof subcategoryId === "string" && subcategoryId.trim()) {
            const subCheck = await marketplacePool.query(
                `SELECT id FROM service_subcategories WHERE id = $1 AND category_id = $2 LIMIT 1`,
                [subcategoryId.trim(), resolvedCategoryId]
            );
            if (subCheck.rows.length === 0) {
                return res.status(400).json({ message: "Subcategory not found under this category" });
            }
            resolvedSubcategoryId = subCheck.rows[0].id;
        }

        const result = await marketplacePool.query(
            `INSERT INTO services (name, description, category_id, subcategory_id, status)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, name, description, status, category_id, subcategory_id, created_at`,
            [nameVal, normalizeText(description), resolvedCategoryId, resolvedSubcategoryId, statusVal]
        );

        return res.status(201).json({
            message: "Service created successfully",
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Error creating service:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function adminUpdateServiceController(req: Request, res: Response): Promise<Response> {
    const authUser = ensureAdmin(req, res);
    if (!authUser) return res as Response;

    const { id } = req.params;
    const { name, description, categoryId, status, subcategoryId, newSubcategoryName } = req.body as Record<string, unknown>;

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    let resolvedCategoryId: string | null = null;
    try {
        const existingService = await marketplacePool.query(
            `SELECT category_id FROM services WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existingService.rows.length === 0) {
            return res.status(404).json({ message: "Service not found" });
        }
        resolvedCategoryId = existingService.rows[0].category_id;
    } catch (error) {
        console.error("Error checking existing service:", error);
        return res.status(500).json({ message: "Internal server error" });
    }

    if (name !== undefined) {
        const nameVal = normalizeText(name);
        if (!nameVal) return res.status(400).json({ message: "name cannot be empty" });
        fields.push(`name = $${idx++}`);
        values.push(nameVal);
    }
    if (description !== undefined) {
        fields.push(`description = $${idx++}`);
        values.push(normalizeText(description));
    }
    if (categoryId !== undefined) {
        if (typeof categoryId !== "string" || !categoryId.trim()) {
            return res.status(400).json({ message: "Invalid categoryId" });
        }
        try {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId);
            const query = isUuid
                ? `SELECT id FROM service_categories WHERE id = $1 AND is_active = true LIMIT 1`
                : `SELECT id FROM service_categories WHERE (LOWER(code) = LOWER($1) OR LOWER(label) = LOWER($1)) AND is_active = true LIMIT 1`;
            
            const categoryCheck = await marketplacePool.query(query, [categoryId]);
            if (categoryCheck.rows.length === 0) {
                return res.status(404).json({ message: "Category not found or inactive" });
            }
            resolvedCategoryId = categoryCheck.rows[0].id;
            fields.push(`category_id = $${idx++}`);
            values.push(resolvedCategoryId);
        } catch (error) {
            console.error("Error resolving categoryId during update:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }
    if (status !== undefined) {
        if (typeof status !== "string" || !ALLOWED_SERVICE_STATUSES.has(status)) {
            return res.status(400).json({ message: `Invalid status. Allowed: ${[...ALLOWED_SERVICE_STATUSES].join(", ")}` });
        }
        fields.push(`status = $${idx++}`);
        values.push(status);
    }

    if (newSubcategoryName !== undefined || subcategoryId !== undefined) {
        let resolvedSubcategoryId: string | null = null;
        if (newSubcategoryName && typeof newSubcategoryName === "string" && newSubcategoryName.trim()) {
            try {
                const subName = newSubcategoryName.trim();
                const subCheck = await marketplacePool.query(
                    `SELECT id FROM service_subcategories WHERE category_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
                    [resolvedCategoryId, subName]
                );
                if (subCheck.rows.length > 0) {
                    resolvedSubcategoryId = subCheck.rows[0].id;
                } else {
                    const subInsert = await marketplacePool.query(
                        `INSERT INTO service_subcategories (category_id, name)
                         VALUES ($1, $2)
                         RETURNING id`,
                        [resolvedCategoryId, subName]
                    );
                    resolvedSubcategoryId = subInsert.rows[0].id;
                }
            } catch (error) {
                console.error("Error resolving/creating subcategory on update:", error);
                return res.status(500).json({ message: "Internal server error" });
            }
        } else if (subcategoryId && typeof subcategoryId === "string" && subcategoryId.trim()) {
            try {
                const subCheck = await marketplacePool.query(
                    `SELECT id FROM service_subcategories WHERE id = $1 AND category_id = $2 LIMIT 1`,
                    [subcategoryId.trim(), resolvedCategoryId]
                );
                if (subCheck.rows.length === 0) {
                    return res.status(400).json({ message: "Subcategory not found under this category" });
                }
                resolvedSubcategoryId = subCheck.rows[0].id;
            } catch (error) {
                console.error("Error validating subcategory during update:", error);
                return res.status(500).json({ message: "Internal server error" });
            }
        }
        fields.push(`subcategory_id = $${idx++}`);
        values.push(resolvedSubcategoryId);
    }

    if (fields.length === 0) {
        return res.status(400).json({ message: "No fields to update" });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    try {
        const result = await marketplacePool.query(
            `UPDATE services SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id, name, description, status, category_id, subcategory_id, updated_at`,
            values
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Service not found" });
        }
        return res.status(200).json({ message: "Service updated", data: result.rows[0] });
    } catch (error) {
        console.error("Error updating service:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function adminReviewServiceController(req: Request, res: Response): Promise<Response> {
    const authUser = ensureAdmin(req, res);
    if (!authUser) return res as Response;

    const { id } = req.params;
    const { decision, notes } = req.body as Record<string, unknown>;

    if (!decision || typeof decision !== "string" || !REVIEW_DECISIONS.has(decision)) {
        return res.status(400).json({ message: "decision must be 'approved' or 'rejected'" });
    }

    const newStatus = decision === "approved" ? "approved" : "rejected";

    try {
        const result = await marketplacePool.query(
            `UPDATE services SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, status`,
            [newStatus, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Service not found" });
        }
        await marketplacePool.query(
            `UPDATE vendor_services SET is_active = $1, updated_at = NOW() WHERE service_id = $2`,
            [decision === "approved", id]
        );

        // The vendor's proposed sub-categories and media are decided together with the service.
        const proposedNodes = `
            WITH node AS (
                SELECT sub.id, sub.parent_id FROM services s
                JOIN service_subcategories sub ON sub.id = s.subcategory_id
                WHERE s.id = $1
            )
            SELECT id FROM node UNION SELECT parent_id FROM node WHERE parent_id IS NOT NULL`;
        if (decision === "approved") {
            await marketplacePool.query(
                `UPDATE service_subcategories SET approval_status = 'approved', updated_at = NOW()
                 WHERE approval_status = 'pending' AND id IN (${proposedNodes})`,
                [id]
            );
            await marketplacePool.query(
                `UPDATE services_media SET approval_status = 'approved', is_approved = TRUE, reviewed_by_user_id = $2
                 WHERE service_id = $1 AND approval_status = 'pending'`,
                [id, authUser.userId]
            );
        } else {
            await marketplacePool.query(
                `UPDATE service_subcategories sub SET approval_status = 'rejected', updated_at = NOW()
                 WHERE sub.approval_status = 'pending' AND sub.id IN (${proposedNodes})
                   AND NOT EXISTS (
                       SELECT 1 FROM services other
                       WHERE other.id <> $1 AND other.status <> 'rejected'
                         AND (other.subcategory_id = sub.id
                              OR other.subcategory_id IN (SELECT child.id FROM service_subcategories child WHERE child.parent_id = sub.id))
                   )`,
                [id]
            );
        }

        const trimmedNotes = typeof notes === "string" ? notes.trim() : "";
        const vendors = await marketplacePool.query(
            `SELECT DISTINCT v.user_id FROM vendor_services vs JOIN vendors v ON v.id = vs.vendor_id WHERE vs.service_id = $1`,
            [id]
        );
        for (const vendor of vendors.rows) {
            void createAndEmitNotification({
                userId: vendor.user_id,
                type: decision === "approved" ? "vendor_product_approved" : "vendor_product_rejected",
                title: decision === "approved" ? "Service Approved ✅" : "Service Rejected ❌",
                body: decision === "approved"
                    ? `Your service "${result.rows[0].name}" has been approved by the admin and is now live.`
                    : `Your service "${result.rows[0].name}" has been rejected by the admin.${trimmedNotes ? ` Reason: ${trimmedNotes}` : ""}`,
                referenceType: "service",
                referenceId: String(id),
            });
        }

        return res.status(200).json({ message: `Service ${decision}`, data: result.rows[0] });
    } catch (error) {
        console.error("Error reviewing service:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function adminDeleteServiceController(req: Request, res: Response): Promise<Response> {
    const authUser = ensureAdmin(req, res);
    if (!authUser) return res as Response;

    const { id } = req.params;

    try {
        const activeBookings = await marketplacePool.query(
            `SELECT COUNT(*) FROM service_bookings sb
             JOIN vendor_services vs ON vs.id = sb.vendor_service_id
             WHERE vs.service_id = $1 AND sb.status NOT IN ('completed', 'cancelled')`,
            [id]
        );

        if (parseInt(activeBookings.rows[0].count, 10) > 0) {
            return res.status(409).json({ message: "Cannot delete service with active bookings" });
        }

        const result = await marketplacePool.query(
            `DELETE FROM services WHERE id = $1 RETURNING id`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Service not found" });
        }
        return res.status(200).json({ message: "Service deleted" });
    } catch (error) {
        console.error("Error deleting service:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function vendorOfferServiceController(req: Request, res: Response): Promise<Response> {
    const authUser = ensureAdminOrVendor(req, res);
    if (!authUser) return res as Response;

    const { serviceId, price, pricingType, moq, deliveryDays, tokenPercentage } = req.body as Record<string, unknown>;

    if (!serviceId || typeof serviceId !== "string") {
        return res.status(400).json({ message: "serviceId is required" });
    }
    const priceVal = parsePositiveDecimal(price);
    if (!priceVal) {
        return res.status(400).json({ message: "price must be a positive number" });
    }
    if (!pricingType || typeof pricingType !== "string" || !ALLOWED_PRICING_TYPES.has(pricingType)) {
        return res.status(400).json({ message: `pricingType must be one of: ${[...ALLOWED_PRICING_TYPES].join(", ")}` });
    }
    const moqVal = parsePositiveInt(moq ?? 1) ?? 1;
    const deliveryDaysVal = deliveryDays != null ? parsePositiveInt(deliveryDays) : null;
    const tokenPercentageVal = tokenPercentage != null ? parsePositiveDecimal(tokenPercentage) : null;

    let vendorId: string;
    if (adminRoles.has(authUser.role)) {
        const { targetVendorId } = req.body as Record<string, unknown>;
        if (!targetVendorId || typeof targetVendorId !== "string") {
            return res.status(400).json({ message: "targetVendorId is required for admin action" });
        }
        vendorId = targetVendorId;
    } else {
        const vId = await getVendorIdByUserId(authUser.userId);
        if (!vId) {
            return res.status(403).json({ message: "Vendor profile not found or not approved" });
        }
        vendorId = vId;
    }

    try {
        const serviceCheck = await marketplacePool.query(
            `SELECT id, status FROM services WHERE id = $1 LIMIT 1`,
            [serviceId]
        );
        if (serviceCheck.rows.length === 0) {
            return res.status(404).json({ message: "Service not found" });
        }

        const result = await marketplacePool.query(
            `INSERT INTO vendor_services (vendor_id, service_id, price, pricing_type, moq, delivery_days, token_percentage, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true)
             ON CONFLICT (vendor_id, service_id) DO UPDATE
             SET price = EXCLUDED.price, pricing_type = EXCLUDED.pricing_type,
                 moq = EXCLUDED.moq,
                 delivery_days = EXCLUDED.delivery_days,
                 token_percentage = EXCLUDED.token_percentage,
                 is_active = true, updated_at = NOW()
             RETURNING id, vendor_id, service_id, price, pricing_type, moq, delivery_days, token_percentage, is_active, created_at`,
            [vendorId, serviceId, priceVal, pricingType, moqVal, deliveryDaysVal, tokenPercentageVal]
        );

        return res.status(201).json({
            message: "Service offering saved",
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Error creating vendor service offering:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function vendorUpdateServiceOfferingController(req: Request, res: Response): Promise<Response> {
    const authUser = ensureAdminOrVendor(req, res);
    if (!authUser) return res as Response;

    const { id } = req.params;
    const { price, pricingType, moq, isActive, deliveryDays, tokenPercentage, serviceName, serviceDescription } = req.body as Record<string, unknown>;

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    const serviceFields: string[] = [];
    const serviceValues: unknown[] = [];
    let serviceIdx = 1;
    const proposedChanges: Record<string, unknown> = {};

    if (serviceName !== undefined) {
        const normalizedName = normalizeText(serviceName);
        if (!normalizedName) return res.status(400).json({ message: "serviceName cannot be empty" });
        serviceFields.push(`name = $${serviceIdx++}`);
        serviceValues.push(normalizedName);
        proposedChanges.service_name = normalizedName;
    }
    if (serviceDescription !== undefined) {
        if (typeof serviceDescription !== "string") {
            return res.status(400).json({ message: "serviceDescription must be a string" });
        }
        serviceFields.push(`description = $${serviceIdx++}`);
        serviceValues.push(normalizeText(serviceDescription));
        proposedChanges.service_description = normalizeText(serviceDescription);
    }

    if (price !== undefined) {
        const priceVal = parsePositiveDecimal(price);
        if (!priceVal) return res.status(400).json({ message: "price must be a positive number" });
        fields.push(`price = $${idx++}`);
        values.push(priceVal);
        proposedChanges.price = priceVal;
    }
    if (pricingType !== undefined) {
        if (typeof pricingType !== "string" || !ALLOWED_PRICING_TYPES.has(pricingType)) {
            return res.status(400).json({ message: `Invalid pricingType` });
        }
        fields.push(`pricing_type = $${idx++}`);
        values.push(pricingType);
        proposedChanges.pricing_type = pricingType;
    }
    if (moq !== undefined) {
        const moqVal = parsePositiveInt(moq);
        if (!moqVal) return res.status(400).json({ message: "moq must be a positive integer" });
        fields.push(`moq = $${idx++}`);
        values.push(moqVal);
        proposedChanges.moq = moqVal;
    }

    if (isActive !== undefined) {
        fields.push(`is_active = $${idx++}`);
        values.push(Boolean(isActive));
        proposedChanges.is_active = Boolean(isActive);
    }

    if (deliveryDays !== undefined) {
        const val = deliveryDays != null ? parsePositiveInt(deliveryDays) : null;
        fields.push(`delivery_days = $${idx++}`);
        values.push(val);
        proposedChanges.delivery_days = val;
    }

    if (tokenPercentage !== undefined) {
        const val = tokenPercentage != null ? parsePositiveDecimal(tokenPercentage) : null;
        fields.push(`token_percentage = $${idx++}`);
        values.push(val);
        proposedChanges.token_percentage = val;
    }

    if (fields.length === 0 && serviceFields.length === 0) {
        return res.status(400).json({ message: "No fields to update" });
    }

    try {
        let vendorId: string | null = null;
        let serviceId: string | null = null;
        let canEditServiceDetails = true;
        if (adminRoles.has(authUser.role)) {
            const offering = await marketplacePool.query(
                `SELECT service_id FROM vendor_services WHERE id = $1 LIMIT 1`,
                [id]
            );
            if (offering.rows.length === 0) return res.status(404).json({ message: "Service offering not found" });
            serviceId = offering.rows[0].service_id;
        } else {
            vendorId = await getVendorIdByUserId(authUser.userId);
            if (!vendorId) return res.status(403).json({ message: "Vendor profile not found or not approved" });

            const offering = await marketplacePool.query(
                `SELECT s.id AS service_id, s.status AS service_status, vs.is_active AS current_is_active,
                        (s.created_by_user_id = $1 OR (
                            s.created_by_user_id IS NULL AND NOT EXISTS (
                                SELECT 1 FROM vendor_services other
                                WHERE other.service_id = s.id AND other.vendor_id <> $2
                            )
                        )) AS can_edit_service_details
                 FROM vendor_services vs
                 JOIN services s ON s.id = vs.service_id
                 WHERE vs.id = $3 AND vs.vendor_id = $2
                 LIMIT 1`,
                [authUser.userId, vendorId, id]
            );
            if (offering.rows.length === 0) return res.status(404).json({ message: "Service offering not found" });
            serviceId = offering.rows[0].service_id;
            canEditServiceDetails = Boolean(offering.rows[0].can_edit_service_details);
            const changesActiveState = isActive !== undefined && Boolean(isActive) !== Boolean(offering.rows[0].current_is_active);
            if (changesActiveState && offering.rows[0].service_status !== "approved") {
                return res.status(409).json({
                    message: offering.rows[0].service_status === "rejected"
                        ? "This service was rejected by the admin, so it can't be activated."
                        : "This service can't be activated until the admin approves it. Once approved, you can activate or deactivate it.",
                });
            }
            if (serviceFields.length > 0 && !canEditServiceDetails) {
                return res.status(409).json({ message: "This service is shared in the catalog. Ask an administrator to change its name or description." });
            }

            const pending = await marketplacePool.query(
                `SELECT modification_status FROM vendor_services WHERE id = $1 AND vendor_id = $2`,
                [id, vendorId]
            );
            if (pending.rows[0]?.modification_status === "pending") {
                return res.status(409).json({ message: "A service edit is already waiting for admin approval." });
            }

            await marketplacePool.query(
                `UPDATE vendor_services
                 SET pending_modifications = $1::jsonb,
                     modification_status = 'pending',
                     updated_at = NOW()
                 WHERE id = $2 AND vendor_id = $3`,
                [JSON.stringify(proposedChanges), id, vendorId]
            );
            return res.status(202).json({
                message: "Service changes submitted and waiting for admin approval.",
                data: { modification_status: "pending", pending_modifications: proposedChanges },
            });
        }

        if (fields.length > 0) {
            fields.push(`updated_at = NOW()`);
            values.push(id);
            let query = `UPDATE vendor_services SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id`;
            if (vendorId) {
                values.push(vendorId);
                query = `UPDATE vendor_services SET ${fields.join(", ")} WHERE id = $${idx} AND vendor_id = $${idx + 1} RETURNING id`;
            }
            const result = await marketplacePool.query(query, values);
            if (result.rows.length === 0) return res.status(404).json({ message: "Service offering not found" });
        }

        if (serviceFields.length > 0 && serviceId) {
            serviceFields.push(`updated_at = NOW()`);
            serviceValues.push(serviceId);
            await marketplacePool.query(
                `UPDATE services SET ${serviceFields.join(", ")} WHERE id = $${serviceIdx}`,
                serviceValues
            );
        }

        return res.status(200).json({ message: "Service offering updated" });
    } catch (error) {
        console.error("Error updating vendor service offering:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function adminGetPendingServiceModificationsController(req: Request, res: Response): Promise<Response> {
    if (!ensureAdmin(req, res)) return res as Response;
    try {
        const result = await marketplacePool.query(
            `SELECT vs.id AS vendor_service_id, vs.pending_modifications, vs.modification_status,
                    vs.price AS current_price, vs.pricing_type AS current_pricing_type,
                    vs.moq AS current_moq, vs.is_active AS current_is_active,
                    vs.delivery_days AS current_delivery_days, vs.token_percentage AS current_token_percentage,
                    s.id AS service_id, s.name AS current_service_name, s.description AS current_service_description,
                    v.company_name AS vendor_company_name, u.name AS vendor_user_name, u.email AS vendor_email,
                    vs.updated_at
             FROM vendor_services vs
             JOIN services s ON s.id = vs.service_id
             JOIN vendors v ON v.id = vs.vendor_id
             JOIN users u ON u.id = v.user_id
             WHERE vs.modification_status = 'pending' AND vs.pending_modifications IS NOT NULL
             ORDER BY vs.updated_at DESC`
        );
        return res.status(200).json({ data: result.rows });
    } catch (error) {
        console.error("Error fetching pending service modifications:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function adminReviewServiceModificationController(req: Request, res: Response): Promise<Response> {
    const admin = ensureAdmin(req, res);
    if (!admin) return res as Response;
    const { id } = req.params;
    const { decision } = req.body as { decision?: string };
    if (!REVIEW_DECISIONS.has(decision || "")) {
        return res.status(400).json({ message: "Valid decision ('approved' or 'rejected') is required" });
    }

    const client = await marketplacePool.connect();
    try {
        await client.query("BEGIN");
        const result = await client.query(
            `SELECT vs.pending_modifications, vs.service_id,
                    (SELECT v.user_id FROM vendors v WHERE v.id = vs.vendor_id) AS vendor_user_id,
                    (SELECT sv.name FROM services sv WHERE sv.id = vs.service_id) AS service_name
             FROM vendor_services vs
             WHERE vs.id = $1 AND vs.modification_status = 'pending'
             FOR UPDATE OF vs`, [id]
        );
        if (result.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Pending service edit not found" });
        }
        const changes = result.rows[0].pending_modifications as Record<string, unknown>;
        if (decision === "approved") {
            const offeringFields: string[] = [];
            const offeringValues: unknown[] = [];
            const columns: Record<string, string> = {
                price: "price", pricing_type: "pricing_type", moq: "moq", is_active: "is_active",
                delivery_days: "delivery_days", token_percentage: "token_percentage",
            };
            for (const [key, column] of Object.entries(columns)) {
                if (Object.prototype.hasOwnProperty.call(changes, key)) {
                    offeringValues.push(changes[key]);
                    offeringFields.push(`${column} = $${offeringValues.length}`);
                }
            }
            if (offeringFields.length) {
                offeringValues.push(id);
                await client.query(`UPDATE vendor_services SET ${offeringFields.join(", ")}, updated_at = NOW() WHERE id = $${offeringValues.length}`, offeringValues);
            }
            const serviceFields: string[] = [];
            const serviceValues: unknown[] = [];
            if (Object.prototype.hasOwnProperty.call(changes, "service_name")) {
                serviceValues.push(changes.service_name);
                serviceFields.push(`name = $${serviceValues.length}`);
            }
            if (Object.prototype.hasOwnProperty.call(changes, "service_description")) {
                serviceValues.push(changes.service_description);
                serviceFields.push(`description = $${serviceValues.length}`);
            }
            if (serviceFields.length) {
                serviceValues.push(result.rows[0].service_id);
                await client.query(`UPDATE services SET ${serviceFields.join(", ")}, updated_at = NOW() WHERE id = $${serviceValues.length}`, serviceValues);
            }
        }
        await client.query(
            `UPDATE vendor_services
             SET pending_modifications = NULL, modification_status = $1, updated_at = NOW()
             WHERE id = $2`, [decision, id]
        );
        await client.query("COMMIT");
        if (result.rows[0].vendor_user_id) {
            void createAndEmitNotification({
                userId: result.rows[0].vendor_user_id,
                type: decision === "approved" ? "vendor_product_approved" : "vendor_product_rejected",
                title: decision === "approved" ? "Service Changes Approved ✅" : "Service Changes Rejected ❌",
                body: decision === "approved"
                    ? `Your changes to "${result.rows[0].service_name}" have been approved and are now live.`
                    : `Your changes to "${result.rows[0].service_name}" were rejected. The previous details stay live.`,
                referenceType: "service",
                referenceId: result.rows[0].service_id,
            });
        }
        return res.status(200).json({ message: `Service edit ${decision}` });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error reviewing pending service edit:", error);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
}

export async function vendorDeleteServiceOfferingController(req: Request, res: Response): Promise<Response> {
    const authUser = ensureAdminOrVendor(req, res);
    if (!authUser) return res as Response;

    const { id } = req.params;

    try {
        let query: string;
        const values: unknown[] = [id];
        
        if (adminRoles.has(authUser.role)) {
            query = `DELETE FROM vendor_services WHERE id = $1 RETURNING id`;
        } else {
            const vendorId = await getVendorIdByUserId(authUser.userId);
            if (!vendorId) return res.status(403).json({ message: "Vendor profile not found or not approved" });
            values.push(vendorId);
            query = `DELETE FROM vendor_services WHERE id = $1 AND vendor_id = $2 RETURNING id`;
        }

        const result = await marketplacePool.query(query, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Service offering not found" });
        }
        return res.status(200).json({ message: "Service offering deleted successfully" });
    } catch (error) {
        console.error("Error deleting vendor service offering:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function uploadServiceMediaController(req: Request, res: Response): Promise<Response> {
    const authUser = ensureAdminOrVendor(req, res);
    if (!authUser) return res as Response;

    const { id } = req.params;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ message: "A file is required" });
    }

    if (!ALLOWED_MEDIA_MIME.has(file.mimetype)) {
        return res.status(400).json({ message: "Only image (JPG, PNG, WEBP) and video (MP4, MOV, AVI) files are allowed" });
    }

    const isVideo = file.mimetype.startsWith("video/");
    const maxSize = isVideo ? 100 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
        return res.status(400).json({ message: `File size exceeds limit (${isVideo ? "100MB for video" : "5MB for image"})` });
    }

    const mediaType: "image" | "video" = isVideo ? "video" : "image";
    const ext = file.originalname.split(".").pop() ?? (isVideo ? "mp4" : "jpg");
    const s3Key = `services/${id}/media/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    try {
        if (mediaType === "video") {
            const existingVideo = await marketplacePool.query(
                `SELECT id FROM services_media WHERE service_id = $1 AND media_type = 'video' LIMIT 1`,
                [id]
            );
            if (existingVideo.rows.length > 0) {
                return res.status(409).json({ message: "A video already exists for this service. Delete it first." });
            }
        }

        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            Body: file.buffer,
            ContentType: file.mimetype,
        }));

        const mediaUrl = `https://${BUCKET_NAME}.s3.${(process.env.AWS_REGION || "ap-south-1").trim()}.amazonaws.com/${s3Key}`;
        const approvalStatus = adminRoles.has(authUser.role) ? "approved" : "pending";

        const result = await marketplacePool.query(
            `INSERT INTO services_media (service_id, media_url, media_type, approval_status, created_by_user_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, media_type, approval_status, created_at`,
            [id, mediaUrl, mediaType, approvalStatus, authUser.userId]
        );

        return res.status(201).json({
            message: adminRoles.has(authUser.role)
                ? "Media uploaded and auto-approved"
                : "Media uploaded and pending admin approval",
            data: result.rows[0],
        });
    } catch (error) {
        console.error("Error uploading service media:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function adminGetPendingServiceMediaController(req: Request, res: Response): Promise<Response> {
    if (!ensureAdmin(req, res)) return res as Response;
    try {
        // Media of a service still under review is decided along with that service.
        const result = await marketplacePool.query(
            `SELECT sm.id, sm.service_id, sm.media_url, sm.media_type, sm.approval_status, sm.removal_requested_at, sm.created_at,
                    s.name AS service_name
             FROM services_media sm
             JOIN services s ON s.id = sm.service_id
             WHERE s.status = 'approved' AND (sm.approval_status = 'pending' OR sm.removal_requested_at IS NOT NULL)
             ORDER BY COALESCE(sm.removal_requested_at, sm.created_at) ASC`
        );
        const rows = await Promise.all(result.rows.map(async (row) => ({
            ...row,
            media_url: await getPresignedUrlOrOriginal(row.media_url),
        })));
        return res.status(200).json({ data: rows });
    } catch (error) {
        console.error("Error fetching pending service media:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function adminReviewServiceMediaController(req: Request, res: Response): Promise<Response> {
    const authUser = ensureAdmin(req, res);
    if (!authUser) return res as Response;

    const { id, mediaId } = req.params;
    const { decision } = req.body as Record<string, unknown>;

    if (!decision || typeof decision !== "string" || !REVIEW_DECISIONS.has(decision)) {
        return res.status(400).json({ message: "decision must be 'approved' or 'rejected'" });
    }

    try {
        const current = await marketplacePool.query(
            `SELECT sm.id, sm.media_url, sm.s3_key, sm.is_primary, sm.removal_requested_at, sv.name AS service_name
             FROM services_media sm JOIN services sv ON sv.id = sm.service_id
             WHERE sm.id = $1 AND sm.service_id = $2`,
            [mediaId, id]
        );
        if (current.rows.length === 0) {
            return res.status(404).json({ message: "Media not found" });
        }
        const media = current.rows[0];
        const isRemoval = Boolean(media.removal_requested_at);

        if (isRemoval && decision === "approved") {
            await marketplacePool.query(`DELETE FROM services_media WHERE id = $1`, [mediaId]);
            if (media.is_primary) {
                await marketplacePool.query(
                    `UPDATE services_media SET is_primary = TRUE
                     WHERE id = (SELECT id FROM services_media WHERE service_id = $1 AND media_type = 'image' AND approval_status = 'approved'
                                 ORDER BY display_order, created_at LIMIT 1)`,
                    [id]
                );
            }
            const key = media.s3_key;
            if (BUCKET_NAME && key) {
                await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
                    .catch((error) => console.warn("Could not delete service media from S3:", error));
            }
        } else if (isRemoval) {
            await marketplacePool.query(`UPDATE services_media SET removal_requested_at = NULL WHERE id = $1`, [mediaId]);
        } else {
            await marketplacePool.query(
                `UPDATE services_media SET approval_status = $1, is_approved = $2, reviewed_by_user_id = $3 WHERE id = $4`,
                [decision, decision === "approved", authUser.userId, mediaId]
            );
        }

        const vendors = await marketplacePool.query(
            `SELECT DISTINCT v.user_id FROM vendor_services vs JOIN vendors v ON v.id = vs.vendor_id WHERE vs.service_id = $1`,
            [id]
        );
        const action = isRemoval ? "removal of a file from" : "new file for";
        for (const vendor of vendors.rows) {
            void createAndEmitNotification({
                userId: vendor.user_id,
                type: decision === "approved" ? "vendor_product_approved" : "vendor_product_rejected",
                title: decision === "approved" ? "Service Media Approved ✅" : "Service Media Rejected ❌",
                body: `The ${action} "${media.service_name}" was ${decision} by the admin.`,
                referenceType: "service",
                referenceId: String(id),
            });
        }

        return res.status(200).json({ message: `Media request ${decision}` });
    } catch (error) {
        console.error("Error reviewing service media:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function deleteServiceMediaController(req: Request, res: Response): Promise<Response> {
    const authUser = ensureAdminOrVendor(req, res);
    if (!authUser) return res as Response;

    const { id, mediaId } = req.params;

    try {
        let deleteResult;
        if (adminRoles.has(authUser.role)) {
            deleteResult = await marketplacePool.query(
                `DELETE FROM services_media WHERE id = $1 AND service_id = $2 RETURNING id`,
                [mediaId, id]
            );
        } else {
            const vendorId = await getVendorIdByUserId(authUser.userId);
            if (!vendorId) return res.status(403).json({ message: "Vendor profile not found or not approved" });

            deleteResult = await marketplacePool.query(
                `DELETE FROM services_media sm
                 USING vendor_services vs
                 WHERE sm.id = $1 AND sm.service_id = $2 AND vs.vendor_id = $3
                 RETURNING sm.id`,
                [mediaId, id, vendorId]
            );
        }

        if (deleteResult.rows.length === 0) {
            return res.status(404).json({ message: "Media not found" });
        }

        return res.status(200).json({ message: "Media deleted" });
    } catch (error) {
        console.error("Error deleting service media:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function adminListServiceBookingsController(req: Request, res: Response): Promise<Response> {
    if (!ensureAdmin(req, res)) return res as Response;

    const { status, vendorId, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(String(page || "1"), 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit || "20"), 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (status && typeof status === "string") {
        conditions.push(`sb.status = $${idx++}`);
        values.push(status);
    }
    if (vendorId && typeof vendorId === "string") {
        conditions.push(`sb.vendor_id = $${idx++}`);
        values.push(vendorId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
        const [dataResult, countResult] = await Promise.all([
            marketplacePool.query(
                `SELECT
                    sb.id, sb.status, sb.payment_status, sb.total_amount,
                    sb.scheduled_start, sb.scheduled_end, sb.created_at,
                    s.name AS service_name,
                    v.company_name AS vendor_name,
                    u.name AS client_name, u.email AS client_email
                 FROM service_bookings sb
                 JOIN vendor_services vs ON vs.id = sb.vendor_service_id
                 JOIN services s ON s.id = vs.service_id
                 JOIN vendors v ON v.id = sb.vendor_id
                 JOIN users u ON u.id = sb.user_id
                 ${where}
                 ORDER BY sb.created_at DESC
                 LIMIT $${idx} OFFSET $${idx + 1}`,
                [...values, limitNum, offset]
            ),
            marketplacePool.query(
                `SELECT COUNT(*) FROM service_bookings sb ${where}`,
                values
            ),
        ]);

        return res.status(200).json({
            data: dataResult.rows,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: parseInt(countResult.rows[0].count, 10),
            },
        });
    } catch (error) {
        console.error("Error listing service bookings (admin):", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function adminListServiceQuotationsController(req: Request, res: Response): Promise<Response> {
    if (!ensureAdmin(req, res)) return res as Response;

    const { status, vendorId, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(String(page || "1"), 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit || "20"), 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (status && typeof status === "string") {
        conditions.push(`sq.status = $${idx++}`);
        values.push(status);
    }
    if (vendorId && typeof vendorId === "string") {
        conditions.push(`sq.vendor_id = $${idx++}`);
        values.push(vendorId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
        const [dataResult, countResult] = await Promise.all([
            marketplacePool.query(
                `SELECT
                    sq.id, sq.status, sq.scope_of_work, sq.requested_price, sq.agreed_price,
                    sq.created_at, sq.updated_at,
                    s.name AS service_name,
                    v.company_name AS vendor_name,
                    u.name AS client_name, u.email AS client_email
                 FROM service_quotations sq
                 JOIN services s ON s.id = sq.service_id
                 JOIN vendors v ON v.id = sq.vendor_id
                 JOIN users u ON u.id = sq.user_id
                 ${where}
                 ORDER BY sq.updated_at DESC
                 LIMIT $${idx} OFFSET $${idx + 1}`,
                [...values, limitNum, offset]
            ),
            marketplacePool.query(
                `SELECT COUNT(*) FROM service_quotations sq ${where}`,
                values
            ),
        ]);

        return res.status(200).json({
            data: dataResult.rows,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: parseInt(countResult.rows[0].count, 10),
            },
        });
    } catch (error) {
        console.error("Error listing service quotations (admin):", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function adminGetServiceReviewsController(req: Request, res: Response): Promise<Response> {
    if (!ensureAdmin(req, res)) return res as Response;

    const { serviceId, vendorId, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(String(page || "1"), 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit || "20"), 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (serviceId && typeof serviceId === "string") {
        conditions.push(`sr.service_id = $${idx++}`);
        values.push(serviceId);
    }
    if (vendorId && typeof vendorId === "string") {
        conditions.push(`sr.vendor_id = $${idx++}`);
        values.push(vendorId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
        const [dataResult, countResult] = await Promise.all([
            marketplacePool.query(
                `SELECT
                    sr.id, sr.rating, sr.review_title, sr.review_text, sr.images, sr.created_at,
                    s.name AS service_name,
                    v.company_name AS vendor_name,
                    u.name AS client_name, u.email AS client_email
                 FROM service_reviews sr
                 JOIN services s ON s.id = sr.service_id
                 JOIN vendors v ON v.id = sr.vendor_id
                 JOIN users u ON u.id = sr.user_id
                 ${where}
                 ORDER BY sr.created_at DESC
                 LIMIT $${idx} OFFSET $${idx + 1}`,
                [...values, limitNum, offset]
            ),
            marketplacePool.query(
                `SELECT COUNT(*) FROM service_reviews sr ${where}`,
                values
            ),
        ]);

        const reviewsWithUrls = await Promise.all(
            dataResult.rows.map(async (r) => ({
                ...r,
                images: Array.isArray(r.images)
                    ? await Promise.all(r.images.map((img: string) => getPresignedUrlOrOriginal(img)))
                    : [],
            }))
        );

        return res.status(200).json({
            data: reviewsWithUrls,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: parseInt(countResult.rows[0].count, 10),
            },
        });
    } catch (error) {
        console.error("Error fetching service reviews (admin):", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function vendorGetMyServiceOfferingsController(req: Request, res: Response): Promise<Response> {
    const authUser = (req as any).user;
    if (!authUser?.userId || authUser.role !== "vendor") {
        return res.status(403).json({ message: "Forbidden" });
    }

    const vendorId = await getVendorIdByUserId(authUser.userId);
    if (!vendorId) {
        return res.status(403).json({ message: "Vendor profile not found or not approved" });
    }

    try {
        const result = await marketplacePool.query(
            `SELECT
                vs.id, vs.price, vs.pricing_type, vs.moq, vs.delivery_days, vs.token_percentage, vs.is_active, vs.created_at,
                vs.modification_status, vs.pending_modifications,
                s.id AS service_id, s.name AS service_name, s.description AS service_description,
                s.status AS service_status,
                CASE WHEN s.created_by_user_id = $2 THEN true
                     WHEN s.created_by_user_id IS NULL AND NOT EXISTS (
                         SELECT 1 FROM vendor_services other
                         WHERE other.service_id = s.id AND other.vendor_id <> $1
                     ) THEN true
                     ELSE false END AS can_edit_service_details,
                (
                    SELECT COALESCE(
                        (SELECT sm.media_url FROM services_media sm WHERE sm.service_id = s.id AND sm.is_primary = true LIMIT 1),
                        (SELECT sm.media_url FROM services_media sm WHERE sm.service_id = s.id LIMIT 1),
                        (SELECT pc.image FROM service_categories pc WHERE pc.id = s.category_id LIMIT 1),
                        ''
                    )
                ) AS service_image,
                (SELECT pc.label FROM service_categories pc WHERE pc.id = s.category_id LIMIT 1) AS category_name,
                COUNT(sb.id) AS booking_count
             FROM vendor_services vs
             JOIN services s ON s.id = vs.service_id
             LEFT JOIN service_bookings sb ON sb.vendor_service_id = vs.id
             WHERE vs.vendor_id = $1
             GROUP BY vs.id, s.id
             ORDER BY vs.created_at DESC`,
            [vendorId, authUser.userId]
        );

        const rows = await Promise.all(result.rows.map(async (row) => ({
            ...row,
            service_image: await getPresignedUrlOrOriginal(row.service_image),
        })));

        return res.status(200).json({ data: rows });
    } catch (error) {
        console.error("Error fetching vendor service offerings:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function adminGetServiceOfferingsController(req: Request, res: Response): Promise<Response> {
    if (!ensureAdmin(req, res)) return res as Response;
    const { id } = req.params;
    try {
        const result = await marketplacePool.query(
            `SELECT vs.id, vs.price, vs.pricing_type, vs.moq, vs.is_active, vs.created_at,
                    v.id AS vendor_id, v.company_name, v.business_type,
                    u.name AS vendor_name, u.email AS vendor_email
             FROM vendor_services vs
             JOIN vendors v ON v.id = vs.vendor_id
             JOIN users u ON u.id = v.user_id
             WHERE vs.service_id = $1
             ORDER BY vs.price ASC`,
            [id]
        );
        return res.status(200).json({ data: result.rows });
    } catch (error) {
        console.error("Error fetching service offerings (admin):", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

