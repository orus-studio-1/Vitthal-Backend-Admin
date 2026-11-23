import type { Request, Response } from "express";
import { marketplacePool } from "../lib/marketplace.js";
import { createAndEmitNotification } from "../lib/notificationEmitter.js";

/**
 * Review queue for product vendors' requests for extra product categories.
 * The admin decides each requested category on its own; approved ones are added to
 * vendor_categories, which is what lets the vendor find those products in the catalogue.
 */

type Decision = "approved" | "rejected";
const MAX_NOTE_LENGTH = 1000;

function joinLabels(labels: string[]) {
    if (labels.length <= 1) return labels[0] ?? "";
    return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

function buildVendorNotification(approved: string[], rejected: string[], note: string | null) {
    const noteLine = note ? ` Note from the admin team: "${note}"` : "";

    if (rejected.length === 0) {
        return {
            title: "Category request approved",
            body: `Your request for ${joinLabels(approved)} has been approved. You can now find products from ${approved.length === 1 ? "this category" : "these categories"} in the catalogue and add your listings.${noteLine}`,
        };
    }
    if (approved.length === 0) {
        return {
            title: "Category request not approved",
            body: `Your request for ${joinLabels(rejected)} was not approved this time.${note ? ` Reason: "${note}"` : ""} You can submit a new request with more details at any time.`,
        };
    }
    return {
        title: "Category request partially approved",
        body: `Approved: ${joinLabels(approved)}. You can now list products from ${approved.length === 1 ? "this category" : "these categories"}. Not approved: ${joinLabels(rejected)}.${noteLine}`,
    };
}

/** GET /api/admin/vendor-category-requests?status=pending|approved|partially_approved|rejected|all */
export const getVendorCategoryRequests = async (req: Request, res: Response): Promise<Response> => {
    const status = typeof req.query.status === "string" ? req.query.status : "pending";
    const allowed = ["pending", "approved", "partially_approved", "rejected", "all"];
    if (!allowed.includes(status)) {
        return res.status(400).json({ message: "Invalid status filter." });
    }

    try {
        const [requests, stats] = await Promise.all([
            marketplacePool.query(
                `SELECT r.id, r.reason, r.status, r.admin_note, r.created_at, r.reviewed_at,
                        v.id AS vendor_id, v.company_name, v.approval_status AS vendor_approval_status,
                        u.name AS vendor_name, u.email AS vendor_email,
                        reviewer.name AS reviewed_by_name,
                        COALESCE((
                            SELECT json_agg(json_build_object(
                                'category_id', pc.id, 'code', pc.code, 'label', pc.label, 'status', i.status,
                                'is_active', pc.is_active,
                                'max_commission', pc.max_commision_percentage,
                                'vendor_count', (SELECT COUNT(*)::int FROM vendor_categories x WHERE x.category_id = pc.id),
                                'product_count', (SELECT COUNT(*)::int FROM products p WHERE p.category = pc.id AND p.approval_status = 'approved' AND p.is_active)
                            ) ORDER BY pc.label)
                            FROM vendor_category_request_items i
                            JOIN product_category pc ON pc.id = i.category_id
                            WHERE i.request_id = r.id
                        ), '[]'::json) AS items,
                        COALESCE((
                            SELECT json_agg(json_build_object('id', pc.id, 'label', pc.label) ORDER BY pc.label)
                            FROM vendor_categories vc
                            JOIN product_category pc ON pc.id = vc.category_id
                            WHERE vc.vendor_id = v.id
                        ), '[]'::json) AS current_categories
                 FROM vendor_category_requests r
                 JOIN vendors v ON v.id = r.vendor_id
                 JOIN users u ON u.id = v.user_id
                 LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by_user_id
                 WHERE ($1 = 'all' OR r.status = $1)
                 ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC
                 LIMIT 200`,
                [status]
            ),
            marketplacePool.query(
                `SELECT status, COUNT(*)::int AS count FROM vendor_category_requests GROUP BY status`
            ),
        ]);

        const counts: Record<string, number> = { pending: 0, approved: 0, partially_approved: 0, rejected: 0 };
        for (const row of stats.rows) counts[row.status as string] = row.count as number;

        return res.status(200).json({
            message: "Vendor category requests fetched successfully",
            data: { requests: requests.rows, counts },
        });
    } catch (error) {
        console.error("Error fetching vendor category requests:", error);
        return res.status(500).json({ message: "Could not load category requests." });
    }
};

/**
 * PUT /api/admin/vendor-category-requests/:id/review
 * body { decisions: { [categoryId]: "approved" | "rejected" }, note?: string }
 * Every requested category needs a decision. A note is required when anything is rejected.
 */
export const reviewVendorCategoryRequest = async (req: Request, res: Response): Promise<Response> => {
    const adminUserId = (req as any).user?.userId as string | undefined;
    const requestId = String(req.params.id ?? "");
    const decisions = (req.body?.decisions ?? {}) as Record<string, unknown>;
    const note = typeof req.body?.note === "string" && req.body.note.trim() ? req.body.note.trim() : null;

    if (!decisions || typeof decisions !== "object" || Array.isArray(decisions)) {
        return res.status(400).json({ message: "Decisions are required." });
    }
    if (note && note.length > MAX_NOTE_LENGTH) {
        return res.status(400).json({ message: `The note can be at most ${MAX_NOTE_LENGTH} characters.` });
    }

    const client = await marketplacePool.connect();
    try {
        await client.query("BEGIN");

        const requestResult = await client.query(
            `SELECT r.id, r.status, r.vendor_id, v.user_id AS vendor_user_id
             FROM vendor_category_requests r
             JOIN vendors v ON v.id = r.vendor_id
             WHERE r.id = $1
             FOR UPDATE OF r`,
            [requestId]
        );
        const request = requestResult.rows[0];
        if (!request) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Category request not found." });
        }
        if (request.status !== "pending") {
            await client.query("ROLLBACK");
            return res.status(409).json({ message: "This request has already been reviewed." });
        }

        const itemsResult = await client.query(
            `SELECT i.id, i.category_id, pc.label, pc.is_active
             FROM vendor_category_request_items i
             JOIN product_category pc ON pc.id = i.category_id
             WHERE i.request_id = $1
             ORDER BY pc.label`,
            [requestId]
        );
        const items = itemsResult.rows as Array<{ id: string; category_id: string; label: string; is_active: boolean }>;

        const approved: typeof items = [];
        const rejected: typeof items = [];
        for (const item of items) {
            const decision = decisions[item.category_id] as Decision | undefined;
            if (decision !== "approved" && decision !== "rejected") {
                await client.query("ROLLBACK");
                return res.status(400).json({ message: `Choose approve or reject for "${item.label}".` });
            }
            if (decision === "approved" && !item.is_active) {
                await client.query("ROLLBACK");
                return res.status(400).json({ message: `"${item.label}" is inactive. Activate it first or reject it.` });
            }
            (decision === "approved" ? approved : rejected).push(item);
        }

        if (rejected.length > 0 && !note) {
            await client.query("ROLLBACK");
            return res.status(400).json({ message: "Add a reason for the vendor when rejecting a category." });
        }

        const finalStatus = rejected.length === 0 ? "approved" : approved.length === 0 ? "rejected" : "partially_approved";

        if (approved.length > 0) {
            await client.query(
                `UPDATE vendor_category_request_items SET status = 'approved' WHERE id = ANY($1::uuid[])`,
                [approved.map((i) => i.id)]
            );
            // Vendors pick at most 3 categories themselves; admin-approved ones may go beyond that.
            // The flag is transaction-local and read by the enforce_vendor_category_limit trigger.
            await client.query(`SELECT set_config('app.vendor_category_admin_grant', 'on', true)`);
            await client.query(
                `INSERT INTO vendor_categories (vendor_id, category_id)
                 SELECT $1, unnest($2::uuid[])
                 ON CONFLICT (vendor_id, category_id) DO NOTHING`,
                [request.vendor_id, approved.map((i) => i.category_id)]
            );
        }
        if (rejected.length > 0) {
            await client.query(
                `UPDATE vendor_category_request_items SET status = 'rejected' WHERE id = ANY($1::uuid[])`,
                [rejected.map((i) => i.id)]
            );
        }

        await client.query(
            `UPDATE vendor_category_requests
             SET status = $2, admin_note = $3, reviewed_by_user_id = $4, reviewed_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [requestId, finalStatus, note, adminUserId ?? null]
        );

        await client.query("COMMIT");

        const message = buildVendorNotification(approved.map((i) => i.label), rejected.map((i) => i.label), note);
        if (request.vendor_user_id) {
            await createAndEmitNotification({
                userId: request.vendor_user_id,
                type: "general",
                title: message.title,
                body: message.body,
                referenceType: "vendor",
                referenceId: requestId,
            });
        }

        return res.status(200).json({
            message: finalStatus === "approved"
                ? "All requested categories approved. The vendor has been notified."
                : finalStatus === "rejected"
                    ? "Request rejected. The vendor has been notified."
                    : `${approved.length} approved and ${rejected.length} rejected. The vendor has been notified.`,
            data: { id: requestId, status: finalStatus },
        });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        console.error("Error reviewing vendor category request:", error);
        return res.status(500).json({ message: "Could not save the review. Nothing was changed." });
    } finally {
        client.release();
    }
};
