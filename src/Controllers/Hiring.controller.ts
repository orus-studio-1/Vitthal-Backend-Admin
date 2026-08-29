import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { getPresignedUrlOrOriginal } from "../services/s3.service.js";

type AuthUser = { userId: string; role: string };

function getAuthUser(req: Request): AuthUser | null {
    const user = (req as any).user;
    if (!user?.userId) return null;
    return user as AuthUser;
}

// ────────────────────────────────────────────────────────────────────
// GET /candidates — List all candidates (admin view, all statuses)
// ────────────────────────────────────────────────────────────────────
export const getAllCandidates = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { status, city, search, page, limit } = req.query;
        const pageNum = Math.max(1, parseInt(String(page || "1"), 10));
        const limitNum = Math.min(100, Math.max(1, parseInt(String(limit || "50"), 10)));
        const offset = (pageNum - 1) * limitNum;

        const conditions: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (status && typeof status === "string" && status.trim()) {
            conditions.push(`ec.verification_status = $${idx}`);
            values.push(status.trim());
            idx++;
        }

        if (city && typeof city === "string" && city.trim()) {
            conditions.push(`ec.city ILIKE $${idx}`);
            values.push(`%${city.trim()}%`);
            idx++;
        }

        if (search && typeof search === "string" && search.trim()) {
            conditions.push(`(ec.full_name ILIKE $${idx} OR ec.phone ILIKE $${idx} OR ec.designation ILIKE $${idx})`);
            values.push(`%${search.trim()}%`);
            idx++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const countResult: any[] = await prisma.$queryRawUnsafe(
            `SELECT COUNT(*)::int AS total FROM employee_candidates ec ${whereClause}`,
            ...values
        );
        const total = countResult[0]?.total || 0;

        const candidates: any[] = await prisma.$queryRawUnsafe(
            `SELECT ec.*, u.name AS registered_by_name, u.email AS registered_by_email
             FROM employee_candidates ec
             LEFT JOIN users u ON u.id = ec.registered_by_user_id
             ${whereClause}
             ORDER BY ec.created_at DESC
             LIMIT $${idx} OFFSET $${idx + 1}`,
            ...values, limitNum, offset
        );

        return res.status(200).json({
            success: true,
            data: candidates,
            pagination: { page: pageNum, limit: limitNum, total },
        });
    } catch (error) {
        console.error("Error fetching candidates:", error);
        return res.status(500).json({ message: "Failed to load candidates." });
    }
};

// ────────────────────────────────────────────────────────────────────
// GET /candidates/:id — Single candidate with documents
// ────────────────────────────────────────────────────────────────────
export const getCandidateById = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
    try {
        const candidates: any[] = await prisma.$queryRawUnsafe(
            `SELECT ec.*, u.name AS registered_by_name, u.email AS registered_by_email,
                    v.name AS verified_by_name
             FROM employee_candidates ec
             LEFT JOIN users u ON u.id = ec.registered_by_user_id
             LEFT JOIN users v ON v.id = ec.verified_by_user_id
             WHERE ec.id = $1`,
            id
        );

        if (candidates.length === 0) {
            return res.status(404).json({ message: "Candidate not found." });
        }

        const rawDocuments: any[] = await prisma.$queryRawUnsafe(
            `SELECT ed.*, uploader.name AS uploaded_by_name
             FROM employee_documents ed
             LEFT JOIN users uploader ON uploader.id = ed.uploaded_by_user_id
             WHERE ed.candidate_id = $1
             ORDER BY ed.created_at ASC`,
            id
        );

        // Map documents to ensure doc_url is an accessible signed S3 URL
        const documents = await Promise.all(
            rawDocuments.map(async (doc) => ({
                ...doc,
                doc_url: await getPresignedUrlOrOriginal(doc.doc_url),
            }))
        );

        // Hire requests for this candidate
        const hireRequests: any[] = await prisma.$queryRawUnsafe(
            `SELECT hr.*, requester.name AS requester_name, requester.email AS requester_email,
                    reviewer.name AS reviewer_name
             FROM hire_requests hr
             JOIN users requester ON requester.id = hr.requested_by_user_id
             LEFT JOIN users reviewer ON reviewer.id = hr.reviewed_by_user_id
             WHERE hr.candidate_id = $1
             ORDER BY hr.created_at DESC`,
            id
        );

        return res.status(200).json({
            success: true,
            data: {
                ...candidates[0],
                documents,
                hire_requests: hireRequests,
            },
        });
    } catch (error) {
        console.error("Error fetching candidate:", error);
        return res.status(500).json({ message: "Failed to load candidate." });
    }
};

// ────────────────────────────────────────────────────────────────────
// POST /candidates — Admin creates a new candidate
// ────────────────────────────────────────────────────────────────────
export const createCandidate = async (req: Request, res: Response): Promise<Response> => {
    const authUser = getAuthUser(req);
    if (!authUser) return res.status(401).json({ message: "Unauthorized" });

    const {
        full_name, email, phone, city, state, pincode, address_line,
        designation, experience_years, skills, metadata, photo_url,
        commission_percentage,
    } = req.body;

    if (!full_name || !phone) {
        return res.status(400).json({ message: "full_name and phone are required." });
    }

    try {
        const result: any[] = await prisma.$queryRawUnsafe(
            `INSERT INTO employee_candidates
                (full_name, email, phone, city, state, pincode, address_line,
                 designation, experience_years, skills, metadata, photo_url,
                 commission_percentage, registered_by_user_id, verification_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13, $14, 'pending')
             RETURNING *`,
            full_name.trim(),
            email?.trim() || null,
            phone.trim(),
            city?.trim() || null,
            state?.trim() || null,
            pincode?.trim() || null,
            address_line?.trim() || null,
            designation?.trim() || null,
            experience_years ?? 0,
            JSON.stringify(Array.isArray(skills) ? skills : []),
            JSON.stringify(metadata || {}),
            photo_url || null,
            commission_percentage ?? 0,
            authUser.userId
        );

        return res.status(201).json({ success: true, data: result[0] });
    } catch (error) {
        console.error("Error creating candidate:", error);
        return res.status(500).json({ message: "Failed to create candidate." });
    }
};

// ────────────────────────────────────────────────────────────────────
// PATCH /candidates/:id — Update candidate details
// ────────────────────────────────────────────────────────────────────
export const updateCandidate = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
    const {
        full_name, email, phone, city, state, pincode, address_line,
        designation, experience_years, skills, metadata, photo_url,
        is_available, commission_percentage,
    } = req.body;

    try {
        const setClauses: string[] = [];
        const values: any[] = [];
        let idx = 1;

        const addField = (field: string, value: any) => {
            if (value !== undefined) {
                setClauses.push(`${field} = $${idx}`);
                values.push(value);
                idx++;
            }
        };

        addField("full_name", full_name?.trim());
        addField("email", email?.trim() || null);
        addField("phone", phone?.trim());
        addField("city", city?.trim() || null);
        addField("state", state?.trim() || null);
        addField("pincode", pincode?.trim() || null);
        addField("address_line", address_line?.trim() || null);
        addField("designation", designation?.trim() || null);
        addField("experience_years", experience_years);
        addField("photo_url", photo_url);
        addField("is_available", is_available);
        addField("commission_percentage", commission_percentage);

        if (skills !== undefined) {
            setClauses.push(`skills = $${idx}::jsonb`);
            values.push(JSON.stringify(Array.isArray(skills) ? skills : []));
            idx++;
        }

        if (metadata !== undefined) {
            setClauses.push(`metadata = $${idx}::jsonb`);
            values.push(JSON.stringify(metadata));
            idx++;
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ message: "No fields to update." });
        }

        setClauses.push("updated_at = NOW()");

        const result: any[] = await prisma.$queryRawUnsafe(
            `UPDATE employee_candidates SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
            ...values, id
        );

        if (result.length === 0) {
            return res.status(404).json({ message: "Candidate not found." });
        }

        return res.status(200).json({ success: true, data: result[0] });
    } catch (error) {
        console.error("Error updating candidate:", error);
        return res.status(500).json({ message: "Failed to update candidate." });
    }
};

// ────────────────────────────────────────────────────────────────────
// PATCH /candidates/:id/verify — Approve or Reject
// ────────────────────────────────────────────────────────────────────
export const verifyCandidateStatus = async (req: Request, res: Response): Promise<Response> => {
    const authUser = getAuthUser(req);
    if (!authUser) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const { action, rejection_reason } = req.body;

    if (!action || !["approve", "reject"].includes(action)) {
        return res.status(400).json({ message: "action must be 'approve' or 'reject'." });
    }

    const newStatus = action === "approve" ? "verified" : "rejected";

    try {
        const result: any[] = await prisma.$queryRawUnsafe(
            `UPDATE employee_candidates
             SET verification_status = $1,
                 rejection_reason = $2,
                 verified_at = NOW(),
                 verified_by_user_id = $3,
                 updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
            newStatus,
            action === "reject" ? (rejection_reason || "Rejected by admin") : null,
            authUser.userId,
            id
        );

        if (result.length === 0) {
            return res.status(404).json({ message: "Candidate not found." });
        }

        return res.status(200).json({
            success: true,
            message: `Candidate ${newStatus}.`,
            data: result[0],
        });
    } catch (error) {
        console.error("Error verifying candidate:", error);
        return res.status(500).json({ message: "Failed to update verification status." });
    }
};

// ────────────────────────────────────────────────────────────────────
// DELETE /candidates/:id
// ────────────────────────────────────────────────────────────────────
export const deleteCandidate = async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
    try {
        const result: any[] = await prisma.$queryRawUnsafe(
            `DELETE FROM employee_candidates WHERE id = $1 RETURNING id`,
            id
        );

        if (result.length === 0) {
            return res.status(404).json({ message: "Candidate not found." });
        }

        return res.status(200).json({ success: true, message: "Candidate deleted." });
    } catch (error) {
        console.error("Error deleting candidate:", error);
        return res.status(500).json({ message: "Failed to delete candidate." });
    }
};

// ────────────────────────────────────────────────────────────────────
// POST /candidates/:id/documents — Add document
// ────────────────────────────────────────────────────────────────────
export const addCandidateDocument = async (req: Request, res: Response): Promise<Response> => {
    const authUser = getAuthUser(req);
    if (!authUser) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const { doc_type, doc_number, doc_url, doc_name, metadata } = req.body;

    if (!doc_type || !doc_url) {
        return res.status(400).json({ message: "doc_type and doc_url are required." });
    }

    try {
        const result: any[] = await prisma.$queryRawUnsafe(
            `INSERT INTO employee_documents (candidate_id, doc_type, doc_number, doc_url, doc_name, metadata, uploaded_by_user_id)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
             RETURNING *`,
            id, doc_type, doc_number || null, doc_url, doc_name || null,
            JSON.stringify(metadata || {}), authUser.userId
        );

        return res.status(201).json({ success: true, data: result[0] });
    } catch (error) {
        console.error("Error adding document:", error);
        return res.status(500).json({ message: "Failed to add document." });
    }
};

// ────────────────────────────────────────────────────────────────────
// DELETE /documents/:docId
// ────────────────────────────────────────────────────────────────────
export const deleteCandidateDocument = async (req: Request, res: Response): Promise<Response> => {
    const { docId } = req.params;
    try {
        const result: any[] = await prisma.$queryRawUnsafe(
            `DELETE FROM employee_documents WHERE id = $1 RETURNING id`,
            docId
        );

        if (result.length === 0) {
            return res.status(404).json({ message: "Document not found." });
        }

        return res.status(200).json({ success: true, message: "Document deleted." });
    } catch (error) {
        console.error("Error deleting document:", error);
        return res.status(500).json({ message: "Failed to delete document." });
    }
};

// ────────────────────────────────────────────────────────────────────
// GET /requests — List all hire requests
// ────────────────────────────────────────────────────────────────────
export const getAllHireRequests = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { status } = req.query;

        let whereClause = "";
        const values: any[] = [];

        if (status && typeof status === "string" && status.trim()) {
            whereClause = "WHERE hr.status = $1";
            values.push(status.trim());
        }

        const requests: any[] = await prisma.$queryRawUnsafe(
            `SELECT hr.*,
                    ec.full_name AS candidate_name, ec.designation AS candidate_designation,
                    ec.phone AS candidate_phone, ec.city AS candidate_city,
                    ec.photo_url AS candidate_photo,
                    requester.name AS requester_name, requester.email AS requester_email,
                    reviewer.name AS reviewer_name
             FROM hire_requests hr
             JOIN employee_candidates ec ON ec.id = hr.candidate_id
             JOIN users requester ON requester.id = hr.requested_by_user_id
             LEFT JOIN users reviewer ON reviewer.id = hr.reviewed_by_user_id
             ${whereClause}
             ORDER BY hr.created_at DESC`,
            ...values
        );

        return res.status(200).json({ success: true, data: requests });
    } catch (error) {
        console.error("Error fetching hire requests:", error);
        return res.status(500).json({ message: "Failed to load hire requests." });
    }
};

// ────────────────────────────────────────────────────────────────────
// PATCH /requests/:id — Admin approve/reject hire request
// ────────────────────────────────────────────────────────────────────
export const reviewHireRequest = async (req: Request, res: Response): Promise<Response> => {
    const authUser = getAuthUser(req);
    if (!authUser) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const { action, admin_notes } = req.body;

    if (!action || !["approve", "reject", "complete"].includes(action)) {
        return res.status(400).json({ message: "action must be 'approve', 'reject', or 'complete'." });
    }

    const statusMap: Record<string, string> = {
        approve: "approved",
        reject: "rejected",
        complete: "completed",
    };

    try {
        const result: any[] = await prisma.$queryRawUnsafe(
            `UPDATE hire_requests
             SET status = $1,
                 admin_notes = $2,
                 reviewed_by_user_id = $3,
                 reviewed_at = NOW(),
                 updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
            statusMap[action],
            admin_notes || null,
            authUser.userId,
            id
        );

        if (result.length === 0) {
            return res.status(404).json({ message: "Hire request not found." });
        }

        // If approved, mark candidate as unavailable
        if (action === "approve") {
            await prisma.$queryRawUnsafe(
                `UPDATE employee_candidates SET is_available = false, updated_at = NOW()
                 WHERE id = $1`,
                result[0].candidate_id
            );
        }

        // If completed, mark candidate as available again
        if (action === "complete") {
            await prisma.$queryRawUnsafe(
                `UPDATE employee_candidates SET is_available = true, updated_at = NOW()
                 WHERE id = $1`,
                result[0].candidate_id
            );
        }

        return res.status(200).json({
            success: true,
            message: `Request ${statusMap[action]}.`,
            data: result[0],
        });
    } catch (error) {
        console.error("Error reviewing hire request:", error);
        return res.status(500).json({ message: "Failed to update hire request." });
    }
};

// ────────────────────────────────────────────────────────────────────
// GET /stats — Dashboard stats for hiring module
// ────────────────────────────────────────────────────────────────────
export const getHiringStats = async (_req: Request, res: Response): Promise<Response> => {
    try {
        const stats: any[] = await prisma.$queryRawUnsafe(`
            SELECT
                COUNT(*)::int AS total_candidates,
                COUNT(*) FILTER (WHERE verification_status = 'pending')::int AS pending_candidates,
                COUNT(*) FILTER (WHERE verification_status = 'verified')::int AS verified_candidates,
                COUNT(*) FILTER (WHERE verification_status = 'rejected')::int AS rejected_candidates,
                COUNT(*) FILTER (WHERE is_available = true AND verification_status = 'verified')::int AS available_candidates
            FROM employee_candidates
        `);

        const requestStats: any[] = await prisma.$queryRawUnsafe(`
            SELECT
                COUNT(*)::int AS total_requests,
                COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_requests,
                COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_requests
            FROM hire_requests
        `);

        return res.status(200).json({
            success: true,
            data: {
                ...stats[0],
                ...requestStats[0],
            },
        });
    } catch (error) {
        console.error("Error fetching hiring stats:", error);
        return res.status(500).json({ message: "Failed to load stats." });
    }
};
