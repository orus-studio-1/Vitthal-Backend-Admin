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
    try {
        const result = await marketplacePool.query(
            `INSERT INTO payout_commission_settings (id, vendor_commission_percentage, worker_commission_percentage, updated_by, updated_at)
             VALUES (1, $1, $2, $3, NOW())
             ON CONFLICT (id) DO UPDATE SET vendor_commission_percentage = EXCLUDED.vendor_commission_percentage,
                 worker_commission_percentage = EXCLUDED.worker_commission_percentage,
                 updated_by = EXCLUDED.updated_by, updated_at = NOW()
             RETURNING vendor_commission_percentage, worker_commission_percentage, updated_at`,
            [vendorRate, workerRate, admin.userId]
        );
        return res.json({ success: true, message: "Payout commission settings updated.", data: result.rows[0] });
    } catch (error) {
        console.error("Error updating payout commission settings:", error);
        return res.status(500).json({ message: "Unable to update payout commission settings." });
    }
}
