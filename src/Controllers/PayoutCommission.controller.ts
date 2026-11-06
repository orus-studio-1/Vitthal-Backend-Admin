import type { Request, Response } from "express";
import { marketplacePool } from "../lib/marketplace.js";

function isAdmin(req: Request, res: Response) {
    const user = (req as any).user;
    if (!user?.userId || !["admin", "super_admin"].includes(user.role)) {
        res.status(403).json({ message: "Only admins can manage payout commissions." });
        return null;
    }
    return user as { userId: string; role: string };
}

export async function getPayoutCommissionSettings(req: Request, res: Response): Promise<Response> {
    if (!isAdmin(req, res)) return res as Response;
    try {
        const result = await marketplacePool.query(
            `SELECT vendor_commission_percentage, worker_commission_percentage, updated_at
             FROM payout_commission_settings WHERE id = 1`
        );
        return res.json({ success: true, data: result.rows[0] || { vendor_commission_percentage: 0, worker_commission_percentage: 0 } });
    } catch (error) {
        console.error("Error retrieving payout commission settings:", error);
        return res.status(500).json({ message: "Unable to retrieve payout commission settings." });
    }
}

export async function updatePayoutCommissionSettings(req: Request, res: Response): Promise<Response> {
    const admin = isAdmin(req, res);
    if (!admin) return res as Response;
    const vendorRate = Number(req.body?.vendorCommissionPercentage);
    const workerRate = Number(req.body?.workerCommissionPercentage);
    if (![vendorRate, workerRate].every((rate) => Number.isFinite(rate) && rate >= 0 && rate <= 100)) {
        return res.status(400).json({ message: "Vendor and worker commission rates must be between 0 and 100." });
    }
    const client = await marketplacePool.connect();
    try {
        await client.query("BEGIN");
        const result = await client.query(
            `INSERT INTO payout_commission_settings (id, vendor_commission_percentage, worker_commission_percentage, updated_by, updated_at)
             VALUES (1, $1, $2, $3, NOW())
             ON CONFLICT (id) DO UPDATE SET vendor_commission_percentage = EXCLUDED.vendor_commission_percentage,
                 worker_commission_percentage = EXCLUDED.worker_commission_percentage,
                 updated_by = EXCLUDED.updated_by, updated_at = NOW()
             RETURNING vendor_commission_percentage, worker_commission_percentage, updated_at`,
            [vendorRate, workerRate, admin.userId]
        );
        // Requests waiting for the admin follow the new rate; part-paid and settled ones keep theirs.
        const vendorRequests = await client.query(
            `UPDATE vendor_payout_requests
             SET commission_percentage = $1::numeric,
                 eligible_amount = ROUND(gross_amount * (100 - $1::numeric) / 100, 2)
             WHERE status = 'requested' AND gross_amount > 0
               AND ROUND(gross_amount * (100 - $1::numeric) / 100, 2) > 0`,
            [vendorRate]
        );
        const workerRequests = await client.query(
            `UPDATE worker_payout_requests
             SET commission_percentage = $1::numeric,
                 eligible_amount = ROUND(gross_amount * (100 - $1::numeric) / 100, 2)
             WHERE status = 'requested' AND gross_amount > 0
               AND ROUND(gross_amount * (100 - $1::numeric) / 100, 2) > 0`,
            [workerRate]
        );
        await client.query("COMMIT");
        return res.json({
            success: true,
            message: "Payout commission settings updated.",
            data: { ...result.rows[0], updated_vendor_requests: vendorRequests.rowCount, updated_worker_requests: workerRequests.rowCount },
        });
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("Error updating payout commission settings:", error);
        return res.status(500).json({ message: "Unable to update payout commission settings." });
    } finally {
        client.release();
    }
}
