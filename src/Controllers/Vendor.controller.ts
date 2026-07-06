import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { marketplacePool } from "../lib/marketplace.js";
import {
    getVendorAnalyticsData,
    getVendorDashboardData,
    getVendorProfile,
} from "../services/vendorInsights.service.js";
import { getPresignedUrlOrOriginal } from "../services/s3.service.js";
import { sendVendorReconsiderationEmail } from "../services/mail.service.js";

async function resolveVendorGstLink(vendor: any) {
    if (vendor && vendor.gst_certificate_link) {
        vendor.gst_certificate_link = await getPresignedUrlOrOriginal(vendor.gst_certificate_link);
    }
    if (vendor && vendor.vendor_signature_image_link) {
        vendor.vendor_signature_image_link = await getPresignedUrlOrOriginal(vendor.vendor_signature_image_link);
    }
    return vendor;
}


const adminRoles = ["admin", "super_admin"];
const reviewDecisions = ["approved", "rejected", "reconsideration"] as const;

function ensureAdmin(req: Request, res: Response) {
    const { role } = (req as any).user ?? {};
    if (!adminRoles.includes(role)) {
        res.status(403).json({ message: "Unauthorized! Only admins can manage vendors." });
        return null;
    }

    return (req as any).user as { userId: string; role: string };
}

const vendorSelect = `
    SELECT
        v.id,
        v.user_id,
        u.name,
        u.email,
        v.company_name,
        v.gst_number,
        v.gst_certificate_link,
        v.vendor_signature_image_link,
        v.business_type,
        v.company_website,
        v.phone,
        v.alternative_number,
        v.designation,
        v.business_description,
        v.credit_cycle,
        v.minimum_commision_percentage,
        v.maximum_commision_percentage,
        v.rating,
        v.vendor_type,
        v.reconsideration_notes,
        a.address,
        a.city,
        a.state,
        a.country,
        a.pincode,
        v.approval_status,
        v.approval_notes,
        v.application_number,
        v.is_active,
        v.is_blocked,
        v.created_at,
        v.updated_at,
        COALESCE(order_stats.order_count, 0) AS order_count,
        COALESCE(
            (
                SELECT json_agg(json_build_object('id', pc.id, 'code', pc.code, 'label', pc.label))
                FROM vendor_categories vc
                JOIN product_category pc ON pc.id = vc.category_id
                WHERE vc.vendor_id = v.id
            ),
            '[]'::json
        ) AS categories
    FROM vendors v
    JOIN users u ON u.id = v.user_id
    LEFT JOIN addresses a ON a.user_id = v.user_id
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS order_count
        FROM orders o
        WHERE o.vendor_id = v.id
    ) order_stats ON true
`;

export const createVendor = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const { name, email, phone, companyName, gstNumber, password } = req.body;

    if (!name || !email || !companyName) {
        return res.status(400).json({ message: "Name, email, and company name are required." });
    }

    const client = await marketplacePool.connect();
    try {
        await client.query("BEGIN");

        const normalizedEmail = String(email).trim().toLowerCase();
        const existingUserResult = await client.query(
            `SELECT id, role FROM users WHERE email = $1`,
            [normalizedEmail]
        );

        let userId: string;
        if (!existingUserResult.rows.length) {
            const hashedPassword = await bcrypt.hash(password || "Vendor@123", 10);
            const createdUser = await client.query(
                `
                    INSERT INTO users (name, email, password_hash, role, is_active, is_verified)
                    VALUES ($1, $2, $3, 'vendor', TRUE, TRUE)
                    RETURNING id
                `,
                [String(name).trim(), normalizedEmail, hashedPassword]
            );
            userId = createdUser.rows[0].id;
        } else {
            const existingUser = existingUserResult.rows[0];
            if (existingUser.role !== "vendor") {
                await client.query("ROLLBACK");
                return res.status(409).json({ message: "A non-vendor user already exists with this email." });
            }

            userId = existingUser.id;
            await client.query(
                `UPDATE users SET name = $1, is_active = TRUE, updated_at = NOW() WHERE id = $2`,
                [String(name).trim(), userId]
            );
        }

        const appNumber = `APP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
        const vendorUpsert = await client.query(
            `
                INSERT INTO vendors (
                    user_id,
                    company_name,
                    gst_number,
                    phone,
                    is_active,
                    is_blocked,
                    approval_status,
                    approval_notes,
                    application_number
                )
                VALUES ($1, $2, $3, $4, TRUE, FALSE, 'approved', 'Created by admin', $5)
                ON CONFLICT (user_id)
                DO UPDATE SET
                    company_name = EXCLUDED.company_name,
                    gst_number = EXCLUDED.gst_number,
                    phone = EXCLUDED.phone,
                    is_active = TRUE,
                    is_blocked = FALSE,
                    approval_status = 'approved',
                    approval_notes = 'Created by admin',
                    application_number = COALESCE(vendors.application_number, EXCLUDED.application_number),
                    updated_at = NOW()
                RETURNING id
            `,
            [userId, String(companyName).trim(), gstNumber?.trim() || null, phone?.trim() || null, appNumber]
        );

        await client.query("COMMIT");

        const vendor = await marketplacePool.query(
            `${vendorSelect} WHERE v.id = $1`,
            [vendorUpsert.rows[0].id]
        );

        const resolvedVendor = await resolveVendorGstLink(vendor.rows[0]);
        return res.status(201).json({ message: "Vendor created successfully", data: resolvedVendor });
    } catch (error: any) {
        await client.query("ROLLBACK");
        if (error?.code === "23505") {
            if (error?.constraint === "vendors_gst_number_key") {
                return res.status(409).json({ message: "GST number is already assigned to another vendor." });
            }
            return res.status(409).json({ message: "Vendor with these details already exists." });
        }
        console.error("Error creating vendor:", error);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
};

export const getAllVendors = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const result = await marketplacePool.query(
            `${vendorSelect} ORDER BY v.created_at DESC`
        );

        const vendors = await Promise.all(result.rows.map(resolveVendorGstLink));
        return res.status(200).json({ message: "Vendors retrieved successfully", data: vendors });
    } catch (error) {
        console.error("Error fetching vendors:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getVendorById = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const result = await marketplacePool.query(
            `${vendorSelect} WHERE v.id = $1`,
            [req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        const resolvedVendor = await resolveVendorGstLink(result.rows[0]);
        return res.status(200).json({ message: "Vendor retrieved successfully", data: resolvedVendor });
    } catch (error) {
        console.error("Error fetching vendor:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getVendorInsights = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const vendorId = String(req.params.id ?? "");
        const vendor = await getVendorProfile(vendorId);
        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        const [dashboard, analytics] = await Promise.all([
            getVendorDashboardData(vendorId),
            getVendorAnalyticsData(vendorId, typeof req.query.timeframe === "string" ? req.query.timeframe : undefined),
        ]);

        return res.status(200).json({
            message: "Vendor insights retrieved successfully",
            data: {
                vendor,
                dashboard,
                analytics,
            },
        });
    } catch (error) {
        console.error("Error fetching vendor insights:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const reviewVendor = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const { id } = req.params;
    const { decision, notes } = req.body as { decision?: string; notes?: string };

    if (!decision || !reviewDecisions.includes(decision as (typeof reviewDecisions)[number])) {
        return res.status(400).json({ message: "Decision must be either approved, rejected, or reconsideration." });
    }

    const client = await marketplacePool.connect();
    try {
        await client.query("BEGIN");

        const vendorResult = await client.query(
            `
                SELECT v.id, v.user_id, v.company_name, v.vendor_signature_image_link, u.name, u.email
                FROM vendors v
                JOIN users u ON u.id = v.user_id
                WHERE v.id = $1
            `,
            [id]
        );
        if (!vendorResult.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Vendor not found" });
        }

        const vendor = vendorResult.rows[0];
        const isApproved = decision === "approved";
        const isReconsideration = decision === "reconsideration";

        if (decision === "approved") {
            const agreementResult = await client.query(
                `
                    SELECT status
                    FROM vendor_quotations
                    WHERE vendor_id = $1
                      AND quotation_kind = 'vendor_agreement'
                    ORDER BY created_at DESC
                    LIMIT 1
                `,
                [id]
            );
            const latestAgreementStatus = agreementResult.rows[0]?.status;
            if (!latestAgreementStatus || !["vendor_approved", "admin_approved"].includes(latestAgreementStatus)) {
                await client.query("ROLLBACK");
                return res.status(400).json({ message: "Vendor can only be approved after the agreement is signed by the vendor." });
            }
        }

        await client.query(
            `
                UPDATE vendors
                SET
                    approval_status = $1,
                    approval_notes = $2,
                    reconsideration_notes = $3,
                    is_active = $4,
                    is_blocked = $5,
                    updated_at = NOW()
                WHERE id = $6
            `,
            [
                decision,
                isReconsideration ? 'Sent back for edits' : (notes?.trim() || null),
                isReconsideration ? (notes?.trim() || null) : null,
                isApproved || isReconsideration,
                false,
                id
            ]
        );

        await client.query(
            `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2`,
            [isApproved || isReconsideration, vendor.user_id]
        );

        await client.query("COMMIT");

        if (isReconsideration) {
            try {
                await sendVendorReconsiderationEmail({
                    vendorEmail: vendor.email,
                    vendorName: vendor.name,
                    companyName: vendor.company_name,
                    notes: notes?.trim() || "Please review and edit your registration information.",
                });
            } catch (emailError) {
                console.error("Failed to send reconsideration email to vendor:", emailError);
            }
        }

        const updated = await marketplacePool.query(`${vendorSelect} WHERE v.id = $1`, [id]);
        const resolvedVendor = await resolveVendorGstLink(updated.rows[0]);
        return res.status(200).json({ message: `Vendor ${decision} successfully`, data: resolvedVendor });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error reviewing vendor:", error);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
};

export const updateVendorStatus = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const { id } = req.params;
    const { is_active, is_blocked } = req.body as { is_active?: boolean; is_blocked?: boolean };

    if (typeof is_active !== "boolean" && typeof is_blocked !== "boolean") {
        return res.status(400).json({ message: "Provide is_active and/or is_blocked as booleans." });
    }

    const client = await marketplacePool.connect();
    try {
        await client.query("BEGIN");

        const vendorResult = await client.query(`SELECT id, user_id FROM vendors WHERE id = $1`, [id]);
        if (!vendorResult.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Vendor not found" });
        }

        const vendor = vendorResult.rows[0];

        if (typeof is_active === "boolean") {
            await client.query(
                `UPDATE vendors SET is_active = $1, updated_at = NOW() WHERE id = $2`,
                [is_active, id]
            );
            await client.query(
                `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2`,
                [is_active, vendor.user_id]
            );
        }

        if (typeof is_blocked === "boolean") {
            await client.query(
                `UPDATE vendors SET is_blocked = $1, updated_at = NOW() WHERE id = $2`,
                [is_blocked, id]
            );
        }

        await client.query("COMMIT");

        const updated = await marketplacePool.query(`${vendorSelect} WHERE v.id = $1`, [id]);
        const resolvedVendor = await resolveVendorGstLink(updated.rows[0]);
        return res.status(200).json({ message: "Vendor status updated successfully", data: resolvedVendor });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error updating vendor status:", error);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
};

export const updateVendor = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const { id } = req.params;
    const { name, phone, company_name, gst_number } = req.body;

    const client = await marketplacePool.connect();
    try {
        await client.query("BEGIN");

        const vendorResult = await client.query(`SELECT id, user_id FROM vendors WHERE id = $1`, [id]);
        if (!vendorResult.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Vendor not found" });
        }

        const vendor = vendorResult.rows[0];

        if (name) {
            await client.query(
                `UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2`,
                [String(name).trim(), vendor.user_id]
            );
        }

        await client.query(
            `
                UPDATE vendors
                SET
                    phone = COALESCE($1, phone),
                    company_name = COALESCE($2, company_name),
                    gst_number = COALESCE($3, gst_number),
                    updated_at = NOW()
                WHERE id = $4
            `,
            [phone?.trim() || null, company_name?.trim() || null, gst_number?.trim() || null, id]
        );

        await client.query("COMMIT");

        const updated = await marketplacePool.query(`${vendorSelect} WHERE v.id = $1`, [id]);
        const resolvedVendor = await resolveVendorGstLink(updated.rows[0]);
        return res.status(200).json({ message: "Vendor updated successfully", data: resolvedVendor });
    } catch (error) {
        await client.query("ROLLBACK");
        if ((error as { code?: string; constraint?: string }).code === "23505") {
            if ((error as { constraint?: string }).constraint === "vendors_gst_number_key") {
                return res.status(409).json({ message: "GST number is already assigned to another vendor." });
            }
            return res.status(409).json({ message: "Vendor with these details already exists." });
        }
        console.error("Error updating vendor:", error);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
};

export const deleteVendor = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const { id } = req.params;

    try {
        const activeOrders = await marketplacePool.query(
            `SELECT COUNT(*)::int AS count FROM orders WHERE vendor_id = $1 AND status NOT IN ('delivered', 'cancelled')`,
            [id]
        );

        if (activeOrders.rows[0]?.count > 0) {
            return res.status(400).json({ message: "Cannot delete vendor with active orders." });
        }

        const result = await marketplacePool.query(`DELETE FROM vendors WHERE id = $1 RETURNING id`, [id]);
        if (!result.rows.length) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        return res.status(200).json({ message: "Vendor deleted successfully" });
    } catch (error) {
        console.error("Error deleting vendor:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
