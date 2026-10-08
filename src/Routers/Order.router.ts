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
    getAllPayoutRequests,
    revealPayoutBankDetails,
    rejectPayoutRequest,
    payPayoutRequest,
} from "../Controllers/Order.controller.js";

const router = Router();

// Admin-only routes for order management
router.post("/", createOrder);
router.get("/", getAllOrders);
router.get("/payouts", getAllPayouts);
router.get("/payout-requests", getAllPayoutRequests);
router.get("/payout-requests/:requestId/bank-details", revealPayoutBankDetails);
router.patch("/payout-requests/:requestId/reject", rejectPayoutRequest);
router.patch("/payout-requests/:requestId/pay", payPayoutRequest);
router.get("/products/:productId/vendors", getOrderProductVendors);
router.get("/status/:status", getOrdersByStatus);
router.get("/:id", getOrderById);
router.put("/:id/status", updateOrderStatus);
router.patch("/:id/status", updateOrderStatus);
router.delete("/:id", deleteOrder);

export default router;
