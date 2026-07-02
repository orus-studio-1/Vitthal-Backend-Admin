import type { Request, Response } from "express";
import { marketplacePool } from "../lib/marketplace.js";
import { getPresignedUrlOrOriginal, s3Client, BUCKET_NAME } from "../services/s3.service.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";

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
                    COUNT(DISTINCT vs.id) AS vendor_count,
                    COUNT(DISTINCT sb.id) AS booking_count
                 FROM services s
                 LEFT JOIN product_category pc ON pc.id = s.category_id
                 LEFT JOIN vendor_services vs ON vs.service_id = s.id
                 LEFT JOIN service_bookings sb ON sb.vendor_service_id = vs.id
                 ${where}
                 GROUP BY s.id, pc.label
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
    const authUser = ensureAdmin(req, res);
    if (!authUser) return res as Response;

    const { name, description, categoryId, status } = req.body as Record<string, unknown>;

    const nameVal = normalizeText(name);
    if (!nameVal) {
        return res.status(400).json({ message: "name is required" });
    }
    if (!categoryId || typeof categoryId !== "string") {
        return res.status(400).json({ message: "categoryId is required" });
    }
    const statusVal = typeof status === "string" && ALLOWED_SERVICE_STATUSES.has(status) ? status : "pending";

    try {
        const categoryCheck = await marketplacePool.query(
            `SELECT id FROM product_category WHERE id = $1 AND is_active = true LIMIT 1`,
            [categoryId]
        );
        if (categoryCheck.rows.length === 0) {
            return res.status(404).json({ message: "Category not found or inactive" });
        }

        const result = await marketplacePool.query(
            `INSERT INTO services (name, description, category_id, status)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, description, status, category_id, created_at`,
            [nameVal, normalizeText(description), categoryId, statusVal]
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
    const { name, description, categoryId, status } = req.body as Record<string, unknown>;

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

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
        fields.push(`category_id = $${idx++}`);
        values.push(categoryId);
    }
    if (status !== undefined) {
        if (typeof status !== "string" || !ALLOWED_SERVICE_STATUSES.has(status)) {
            return res.status(400).json({ message: `Invalid status. Allowed: ${[...ALLOWED_SERVICE_STATUSES].join(", ")}` });
        }
        fields.push(`status = $${idx++}`);
        values.push(status);
    }

    if (fields.length === 0) {
        return res.status(400).json({ message: "No fields to update" });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    try {
        const result = await marketplacePool.query(
            `UPDATE services SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id, name, description, status, category_id, updated_at`,
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

    const { serviceId, price, pricingType, moq } = req.body as Record<string, unknown>;

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
            `INSERT INTO vendor_services (vendor_id, service_id, price, pricing_type, moq, is_active)
             VALUES ($1, $2, $3, $4, $5, true)
             ON CONFLICT (vendor_id, service_id) DO UPDATE
             SET price = EXCLUDED.price, pricing_type = EXCLUDED.pricing_type,
                 moq = EXCLUDED.moq,
                 is_active = true, updated_at = NOW()
             RETURNING id, vendor_id, service_id, price, pricing_type, moq, is_active, created_at`,
            [vendorId, serviceId, priceVal, pricingType, moqVal]
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
    const { price, pricingType, moq, isActive } = req.body as Record<string, unknown>;

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (price !== undefined) {
        const priceVal = parsePositiveDecimal(price);
        if (!priceVal) return res.status(400).json({ message: "price must be a positive number" });
        fields.push(`price = $${idx++}`);
        values.push(priceVal);
    }
    if (pricingType !== undefined) {
        if (typeof pricingType !== "string" || !ALLOWED_PRICING_TYPES.has(pricingType)) {
            return res.status(400).json({ message: `Invalid pricingType` });
        }
        fields.push(`pricing_type = $${idx++}`);
        values.push(pricingType);
    }
    if (moq !== undefined) {
        const moqVal = parsePositiveInt(moq);
        if (!moqVal) return res.status(400).json({ message: "moq must be a positive integer" });
        fields.push(`moq = $${idx++}`);
        values.push(moqVal);
    }

    if (isActive !== undefined) {
        fields.push(`is_active = $${idx++}`);
        values.push(Boolean(isActive));
    }

    if (fields.length === 0) {
        return res.status(400).json({ message: "No fields to update" });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    try {
        let query: string;
        if (adminRoles.has(authUser.role)) {
            query = `UPDATE vendor_services SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id`;
        } else {
            const vendorId = await getVendorIdByUserId(authUser.userId);
            if (!vendorId) return res.status(403).json({ message: "Vendor profile not found or not approved" });
            values.push(vendorId);
            query = `UPDATE vendor_services SET ${fields.join(", ")} WHERE id = $${idx} AND vendor_id = $${idx + 1} RETURNING id`;
        }

        const result = await marketplacePool.query(query, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Service offering not found" });
        }
        return res.status(200).json({ message: "Service offering updated" });
    } catch (error) {
        console.error("Error updating vendor service offering:", error);
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
            `INSERT INTO services_media (service_id, media_url, s3_key, media_type, approval_status, uploaded_by_user_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, media_type, approval_status, created_at`,
            [id, mediaUrl, s3Key, mediaType, approvalStatus, authUser.userId]
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

export async function adminReviewServiceMediaController(req: Request, res: Response): Promise<Response> {
    const authUser = ensureAdmin(req, res);
    if (!authUser) return res as Response;

    const { id, mediaId } = req.params;
    const { decision } = req.body as Record<string, unknown>;

    if (!decision || typeof decision !== "string" || !REVIEW_DECISIONS.has(decision)) {
        return res.status(400).json({ message: "decision must be 'approved' or 'rejected'" });
    }

    try {
        const result = await marketplacePool.query(
            `UPDATE services_media
             SET approval_status = $1, reviewed_by_user_id = $2, updated_at = NOW()
             WHERE id = $3 AND service_id = $4
             RETURNING id, media_type, approval_status`,
            [decision, authUser.userId, mediaId, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Media not found" });
        }
        return res.status(200).json({ message: `Media ${decision}`, data: result.rows[0] });
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
                `DELETE FROM services_media WHERE id = $1 AND service_id = $2 RETURNING id, s3_key`,
                [mediaId, id]
            );
        } else {
            const vendorId = await getVendorIdByUserId(authUser.userId);
            if (!vendorId) return res.status(403).json({ message: "Vendor profile not found or not approved" });

            deleteResult = await marketplacePool.query(
                `DELETE FROM services_media sm
                 USING vendor_services vs
                 WHERE sm.id = $1 AND sm.service_id = $2 AND vs.vendor_id = $3
                 RETURNING sm.id, sm.s3_key`,
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
                vs.id, vs.price, vs.pricing_type, vs.moq, vs.is_active, vs.created_at,
                s.id AS service_id, s.name AS service_name, s.status AS service_status,
                COUNT(sb.id) AS booking_count
             FROM vendor_services vs
             JOIN services s ON s.id = vs.service_id
             LEFT JOIN service_bookings sb ON sb.vendor_service_id = vs.id
             WHERE vs.vendor_id = $1
             GROUP BY vs.id, s.id
             ORDER BY vs.created_at DESC`,
            [vendorId]
        );

        return res.status(200).json({ data: result.rows });
    } catch (error) {
        console.error("Error fetching vendor service offerings:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
