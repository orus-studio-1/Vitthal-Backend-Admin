import type { Request, Response } from "express";
import { marketplacePool } from "../lib/marketplace.js";
import { getPresignedUrlOrOriginal } from "../services/s3.service.js";
import { decryptPayoutAccountNumber } from "../services/payoutBankEncryption.service.js";

const adminRoles = ["admin", "super_admin"];
function requireAdmin(req: Request, res: Response) {
    const user = (req as any).user;
    if (!user?.userId || !adminRoles.includes(user.role)) {
        res.status(403).json({ message: "Only admins can manage worker payouts." });
        return null;
    }
    return user as { userId: string; role: string };
}

export const getWorkerPayoutRequests = async (req: Request, res: Response): Promise<Response> => {
    if (!requireAdmin(req, res)) return res as Response;
    try {
        const result = await marketplacePool.query(
            `SELECT r.id AS request_id, r.worker_user_id, r.hire_request_id, r.gross_amount,
                    r.commission_percentage, r.eligible_amount, r.paid_amount, r.status AS request_status,
                    r.transfer_reference, r.rejection_reason, r.requested_at, r.processed_at,
                    ec.full_name AS worker_name, ec.designation AS worker_designation, ec.phone AS worker_phone,
                    worker.email AS worker_email, client.name AS client_name, hr.contract_status, hr.request_details,
                    hr.completed_at, bank.bank_name, bank.account_holder_name,
                    bank.account_number_last4 AS account_last_four, bank.ifsc_code,
                    (bank.bank_name IS NOT NULL AND bank.account_holder_name IS NOT NULL AND bank.account_number IS NOT NULL
                     AND bank.ifsc_code IS NOT NULL AND bank.cancelled_cheque_link IS NOT NULL) AS bank_details_complete,
                    COALESCE((SELECT json_agg(json_build_object('amount', t.amount, 'reference', t.transfer_reference, 'transferred_at', t.transferred_at) ORDER BY t.transferred_at)
                              FROM worker_payout_transfers t WHERE t.request_id = r.id), '[]'::json) AS transfers
             FROM worker_payout_requests r
             JOIN hire_requests hr ON hr.id = r.hire_request_id
             JOIN employee_candidates ec ON ec.id = hr.candidate_id AND ec.registered_by_user_id = r.worker_user_id
             LEFT JOIN users worker ON worker.id = r.worker_user_id
             JOIN users client ON client.id = hr.requested_by_user_id
             LEFT JOIN worker_payout_bank_details bank ON bank.worker_user_id = r.worker_user_id
             ORDER BY CASE WHEN r.status IN ('requested', 'partially_paid') THEN 0 ELSE 1 END, r.requested_at DESC`
        );
        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Error retrieving worker payout requests:", error);
        return res.status(500).json({ message: "Unable to retrieve worker payout requests." });
    }
};

export const revealWorkerPayoutBankDetails = async (req: Request, res: Response): Promise<Response> => {
    const admin = requireAdmin(req, res);
    if (!admin) return res as Response;
    try {
        const result = await marketplacePool.query(
            `SELECT r.id AS request_id, r.worker_user_id, bank.bank_name, bank.account_holder_name,
                    bank.account_number, bank.ifsc_code, bank.cancelled_cheque_link
             FROM worker_payout_requests r JOIN worker_payout_bank_details bank ON bank.worker_user_id = r.worker_user_id
             WHERE r.id = $1`, [req.params.requestId]);
        if (!result.rows.length) return res.status(404).json({ message: "Worker payout request or bank details not found." });
        await marketplacePool.query(`INSERT INTO worker_payout_bank_access_audit (worker_payout_request_id, admin_user_id) VALUES ($1, $2)`, [result.rows[0].request_id, admin.userId]);
        const details = result.rows[0];
        details.account_number = decryptPayoutAccountNumber(details.account_number);
        details.cancelled_cheque_link = await getPresignedUrlOrOriginal(details.cancelled_cheque_link);
        return res.json({ success: true, data: details });
    } catch (error) {
        console.error("Error revealing worker payout bank details:", error);
        return res.status(500).json({ message: "Unable to reveal worker bank details." });
    }
};

export const rejectWorkerPayoutRequest = async (req: Request, res: Response): Promise<Response> => {
    const admin = requireAdmin(req, res);
    if (!admin) return res as Response;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!reason) return res.status(400).json({ message: "A rejection reason is required." });
    try {
        const result = await marketplacePool.query(
            `UPDATE worker_payout_requests SET status = 'rejected', rejection_reason = $1, processed_at = NOW(), processed_by = $2
             WHERE id = $3 AND status = 'requested' RETURNING id AS request_id, status, rejection_reason, processed_at`,
            [reason, admin.userId, req.params.requestId]);
        if (!result.rows.length) return res.status(409).json({ message: "Request is no longer pending or already has a partial transfer." });
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error("Error rejecting worker payout request:", error);
        return res.status(500).json({ message: "Unable to reject worker payout request." });
    }
};

export const payWorkerPayoutRequest = async (req: Request, res: Response): Promise<Response> => {
    const admin = requireAdmin(req, res);
    if (!admin) return res as Response;
    const requestedAmount = Number(req.body?.amount);
    const amount = Math.round((requestedAmount + Number.EPSILON) * 100) / 100;
    const reference = typeof req.body?.transferReference === "string" ? req.body.transferReference.trim() : "";
    if (!Number.isFinite(requestedAmount) || !Number.isFinite(amount) || amount <= 0 || !reference) return res.status(400).json({ message: "A positive amount and bank transfer reference are required." });
    const db = await marketplacePool.connect();
    try {
        await db.query("BEGIN");
        const result = await db.query(
            `SELECT r.*, bank.bank_name, bank.account_holder_name, bank.account_number, bank.ifsc_code,
                    hr.contract_status, hr.client_completed_at, hr.worker_completed_at,
                    EXISTS (SELECT 1 FROM payments p WHERE p.hire_request_id = hr.id AND p.payment_type = 'worker_hiring' AND p.status = 'successful') AS payment_confirmed,
                    COALESCE((SELECT SUM(t.amount) FROM worker_payout_transfers t WHERE t.request_id = r.id), 0) AS transferred_amount
             FROM worker_payout_requests r JOIN worker_payout_bank_details bank ON bank.worker_user_id = r.worker_user_id
             JOIN hire_requests hr ON hr.id = r.hire_request_id WHERE r.id = $1 FOR UPDATE OF r`, [req.params.requestId]);
        if (!result.rows.length) { await db.query("ROLLBACK"); return res.status(404).json({ message: "Worker payout request not found." }); }
        const request = result.rows[0];
        if (!["requested", "partially_paid"].includes(request.status)) { await db.query("ROLLBACK"); return res.status(409).json({ message: "Request is no longer payable." }); }
        if (request.contract_status !== "completed" || !request.client_completed_at || !request.worker_completed_at || !request.payment_confirmed) {
            await db.query("ROLLBACK"); return res.status(409).json({ message: "Both parties must have completed the paid contract." });
        }
        if (![request.bank_name, request.account_holder_name, request.account_number, request.ifsc_code].every((value) => typeof value === "string" && value.trim())) {
            await db.query("ROLLBACK"); return res.status(409).json({ message: "Worker bank details are incomplete." });
        }
        const audit = await db.query(
            `SELECT 1 FROM worker_payout_bank_access_audit WHERE worker_payout_request_id = $1 AND admin_user_id = $2
             AND accessed_at > NOW() - INTERVAL '15 minutes' LIMIT 1`, [request.id, admin.userId]);
        if (!audit.rows.length) { await db.query("ROLLBACK"); return res.status(403).json({ message: "Reveal and verify beneficiary details before recording the transfer." }); }
        const alreadyPaid = Number(request.transferred_amount);
        const remaining = Math.max(0, Number(request.eligible_amount) - alreadyPaid);
        if (amount > remaining) { await db.query("ROLLBACK"); return res.status(400).json({ message: "Transfer exceeds the remaining eligible payout amount." }); }
        await db.query(`INSERT INTO worker_payout_transfers (request_id, amount, transfer_reference, transferred_by) VALUES ($1, $2, $3, $4)`, [request.id, amount, reference, admin.userId]);
        const paidAmount = alreadyPaid + amount;
        const status = paidAmount >= Number(request.eligible_amount) ? "paid" : "partially_paid";
        await db.query(`UPDATE worker_payout_requests SET status = $1, paid_amount = $2, transfer_reference = $3, processed_at = NOW(), processed_by = $4 WHERE id = $5`, [status, paidAmount, reference, admin.userId, request.id]);
        await db.query("COMMIT");
        return res.json({ success: true, data: { request_id: request.id, status, paid_amount: paidAmount } });
    } catch (error) {
        await db.query("ROLLBACK");
        console.error("Error processing worker payout:", error);
        return res.status(500).json({ message: "Unable to process worker payout." });
    } finally { db.release(); }
};
