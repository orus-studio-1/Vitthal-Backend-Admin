import { Router } from "express";
import {
    createOrder,
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    deleteOrder,
    getOrdersByStatus,
    getOrderProductVendors,
    getAllPayouts,
    updatePayout,
    getAllPayoutRequests,
    revealPayoutBankDetails,
    rejectPayoutRequest,
    payPayoutRequest,
} from "../Controllers/Order.controller.js";
import {
    getWorkerPayoutRequests,
    revealWorkerPayoutBankDetails,
    rejectWorkerPayoutRequest,
    payWorkerPayoutRequest,
} from "../Controllers/WorkerPayout.controller.js";

const router = Router();

// Admin-only routes for order management
router.post("/", createOrder);
router.get("/", getAllOrders);
router.get("/payouts", getAllPayouts);
router.put("/payouts/:orderId", updatePayout);
router.get("/payout-requests", getAllPayoutRequests);
router.get("/payout-requests/:requestId/bank-details", revealPayoutBankDetails);
router.patch("/payout-requests/:requestId/reject", rejectPayoutRequest);
router.patch("/payout-requests/:requestId/pay", payPayoutRequest);
router.get("/worker-payout-requests", getWorkerPayoutRequests);
router.get("/worker-payout-requests/:requestId/bank-details", revealWorkerPayoutBankDetails);
router.patch("/worker-payout-requests/:requestId/reject", rejectWorkerPayoutRequest);
router.patch("/worker-payout-requests/:requestId/pay", payWorkerPayoutRequest);
router.get("/products/:productId/vendors", getOrderProductVendors);
router.get("/status/:status", getOrdersByStatus);
router.get("/:id", getOrderById);
router.put("/:id/status", updateOrderStatus);
router.patch("/:id/status", updateOrderStatus);
router.delete("/:id", deleteOrder);

export default router;
