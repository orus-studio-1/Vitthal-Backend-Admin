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
} from "../Controllers/Order.controller.js";

const router = Router();

// Admin-only routes for order management
router.post("/", createOrder);
router.get("/", getAllOrders);
router.get("/payouts", getAllPayouts);
router.put("/payouts/:orderId", updatePayout);
router.get("/products/:productId/vendors", getOrderProductVendors);
router.get("/status/:status", getOrdersByStatus);
router.get("/:id", getOrderById);
router.put("/:id/status", updateOrderStatus);
router.patch("/:id/status", updateOrderStatus);
router.delete("/:id", deleteOrder);

export default router;
