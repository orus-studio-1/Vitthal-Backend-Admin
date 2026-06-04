import { Router } from "express";
import {
    getDashboardStats,
    getAnalytics,
    getMyVendorAnalytics,
    getUserDetails,
    getUserManagement,
    updateUserStatus,
    getAllPayments
} from "../Controllers/Admin.controller.js";
import {
    getAdminVendorConversation,
    getAdminVendorConversations,
    sendAdminVendorMessage,
} from "../Controllers/Chat.controller.js";

const router = Router();

// Admin-only routes for dashboard and management
router.get("/dashboard", getDashboardStats);
router.get("/analytics", getAnalytics);
router.get("/my-vendor-analytics", getMyVendorAnalytics);
router.get("/vendor-chats", getAdminVendorConversations);
router.get("/vendor-chats/:vendorId", getAdminVendorConversation);
router.post("/vendor-chats/:vendorId", sendAdminVendorMessage);
router.get("/users", getUserManagement);
router.get("/users/:id", getUserDetails);
router.put("/users/:id/status", updateUserStatus);
router.get("/payments", getAllPayments);

export default router;
