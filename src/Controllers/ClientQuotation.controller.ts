import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { getPresignedUrl } from "../services/s3.service.js";

const adminRoles = ["admin", "super_admin"];

function getAuthUser(req: Request) {
    return (req as any).user as { userId: string; role: string; username?: string } | undefined;
}

/**
 * List all client-vendor quotation requests that have been accepted (client_accepted status or beyond).
 * Admin can track these and send confirmation messages.
 */
export async function getClientQuotations(req: Request, res: Response): Promise<Response> {
    const authUser = getAuthUser(req);
    if (!authUser?.userId || !adminRoles.includes(authUser.role)) {
        return res.status(403).json({ message: "Unauthorized. Admin access required." });
    }

    try {
        const rows: any[] = await prisma.$queryRawUnsafe(`
            SELECT
                qr.id,
                qr.status,
                qr.requested_quantity,
                qr.requested_price,
                qr.current_offer_price,
                qr.current_offer_quantity,
                qr.current_offer_by,
                qr.accepted_price,
                qr.accepted_quantity,
                qr.rejection_reason,
                qr.admin_confirmation_status,
                qr.admin_confirmation_message,
                qr.admin_confirmed_at,
                qr.admin_user_id,
                qr.order_id,
                qr.created_at,
                qr.updated_at,
                qr.vendor_document_url,
                qr.vendor_document_s3_key,
                qd.document_url AS base_document_url,
                qd.s3_key AS base_document_s3_key,
                p.name AS product_name,
                v.company_name AS vendor_name,
                u_client.name AS client_name,
                u_client.email AS client_email
            FROM quotation_requests qr
            JOIN products p ON qr.product_id = p.id
            JOIN vendors v ON qr.vendor_id = v.id
            JOIN users u_client ON qr.user_id = u_client.id
            LEFT JOIN quotation_documents qd ON qr.quotation_group_id = qd.quotation_group_id
            WHERE qr.status IN (
                'client_accepted',
                'admin_confirmation_pending',
                'admin_confirmed',
                'admin_confirmation_rejected'
            )
            ORDER BY qr.updated_at DESC
        `);

        for (const row of rows) {
            if (row.vendor_document_s3_key) {
                try {
                    row.vendor_document_url = await getPresignedUrl(row.vendor_document_s3_key);
                } catch (err) {
                    console.error(`Error presigning vendor_document S3 key ${row.vendor_document_s3_key}:`, err);
                }
            }
            if (row.base_document_s3_key) {
                try {
                    row.base_document_url = await getPresignedUrl(row.base_document_s3_key);
                } catch (err) {
                    console.error(`Error presigning base_document S3 key ${row.base_document_s3_key}:`, err);
                }
            }
        }

        return res.status(200).json({ message: "Client quotations fetched", data: rows });
    } catch (error) {
        console.error("Error fetching client quotations:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * Get a single client-vendor quotation with full message history.
 */
export async function getClientQuotationById(req: Request, res: Response): Promise<Response> {
    const authUser = getAuthUser(req);
    if (!authUser?.userId || !adminRoles.includes(authUser.role)) {
        return res.status(403).json({ message: "Unauthorized. Admin access required." });
    }

    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: "Quotation ID is required" });
    }

    try {
        const quotationRows: any[] = await prisma.$queryRawUnsafe(`
            SELECT
                qr.*,
                qd.document_url AS base_document_url,
                qd.s3_key AS base_document_s3_key,
                p.name AS product_name,
                v.company_name AS vendor_name,
                u_client.name AS client_name,
                u_client.email AS client_email
            FROM quotation_requests qr
            JOIN products p ON qr.product_id = p.id
            JOIN vendors v ON qr.vendor_id = v.id
            JOIN users u_client ON qr.user_id = u_client.id
            LEFT JOIN quotation_documents qd ON qr.quotation_group_id = qd.quotation_group_id
            WHERE qr.id = $1::uuid
            LIMIT 1
        `, id);

        if (quotationRows.length === 0) {
            return res.status(404).json({ message: "Quotation not found" });
        }

        const quotation = quotationRows[0];
        if (quotation.vendor_document_s3_key) {
            try {
                quotation.vendor_document_url = await getPresignedUrl(quotation.vendor_document_s3_key);
            } catch (err) {
                console.error(`Error presigning vendor_document S3 key ${quotation.vendor_document_s3_key}:`, err);
            }
        }
        if (quotation.base_document_s3_key) {
            try {
                quotation.base_document_url = await getPresignedUrl(quotation.base_document_s3_key);
            } catch (err) {
                console.error(`Error presigning base_document S3 key ${quotation.base_document_s3_key}:`, err);
            }
        }

        const messagesRows: any[] = await prisma.$queryRawUnsafe(`
            SELECT
                qm.id,
                qm.sender_user_id,
                qm.sender_role,
                qm.action,
                qm.offer_price,
                qm.offer_quantity,
                qm.note,
                qm.reason,
                qm.created_at,
                u.name AS sender_name
            FROM quotation_messages qm
            JOIN users u ON qm.sender_user_id = u.id
            WHERE qm.quotation_id = $1::uuid
            ORDER BY qm.created_at ASC
        `, id);

        return res.status(200).json({
            message: "Quotation fetched",
            data: {
                quotation,
                messages: messagesRows,
            },
        });
    } catch (error) {
        console.error("Error fetching client quotation by ID:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * Admin sends a confirmation message to the client.
 * This sets admin_confirmation_status = 'pending' and creates a quotation_message
 * with sender_role = 'admin' and action = 'admin_confirm_request'.
 */
export async function sendConfirmationMessage(req: Request, res: Response): Promise<Response> {
    const authUser = getAuthUser(req);
    if (!authUser?.userId || !adminRoles.includes(authUser.role)) {
        return res.status(403).json({ message: "Unauthorized. Admin access required." });
    }

    const { id } = req.params;
    const { message } = req.body as { message?: string };

    if (!id) {
        return res.status(400).json({ message: "Quotation ID is required" });
    }
    if (!message || !message.trim()) {
        return res.status(400).json({ message: "Confirmation message is required" });
    }

    try {
        // Verify quotation exists and is in client_accepted status
        const quotationRows: any[] = await prisma.$queryRawUnsafe(`
            SELECT id, user_id, status, admin_confirmation_status
            FROM quotation_requests
            WHERE id = $1::uuid
            LIMIT 1
        `, id);

        if (quotationRows.length === 0) {
            return res.status(404).json({ message: "Quotation not found" });
        }

        const quotation = quotationRows[0];

        if (quotation.status !== "client_accepted" && quotation.admin_confirmation_status !== null) {
            return res.status(400).json({ message: "Quotation is not in a state that allows admin confirmation" });
        }

        // Update quotation_requests
        await prisma.$executeRawUnsafe(`
            UPDATE quotation_requests
            SET admin_confirmation_status = 'pending',
                admin_confirmation_message = $1,
                admin_user_id = $2::uuid,
                status = 'admin_confirmation_pending',
                updated_at = NOW()
            WHERE id = $3::uuid
        `, message.trim(), authUser.userId, id);

        // Insert admin message
        await prisma.$executeRawUnsafe(`
            INSERT INTO quotation_messages (quotation_id, sender_user_id, sender_role, action, note)
            VALUES ($1::uuid, $2::uuid, 'admin', 'admin_confirm_request', $3)
        `, id, authUser.userId, message.trim());

        // Create notification for the client
        await prisma.$executeRawUnsafe(`
            INSERT INTO notifications (user_id, type, title, body, reference_type, reference_id)
            VALUES ($1::uuid, 'admin_confirmation_sent', 'Admin confirmation required', $2, 'quotation', $3::uuid)
        `, quotation.user_id, `Admin sent a confirmation message for your quotation. Please review and confirm or reject.`, id);

        return res.status(200).json({ message: "Confirmation message sent to client" });
    } catch (error) {
        console.error("Error sending admin confirmation:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
