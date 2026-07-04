import { Router } from "express";
import { getDashboardStats, getAnalytics, getMyVendorAnalytics, getUserDetails, getUserManagement, updateUserStatus, getAllPayments, getDeliveryAgents, createDeliveryAgent } from "../Controllers/Admin.controller.js";
import { getAdminVendorConversation, getAdminVendorConversations, sendAdminVendorMessage, } from "../Controllers/Chat.controller.js";
import { createFulfillmentCenter, getAllFulfillmentCenters, getFulfillmentCenterById, updateFulfillmentCenter, deleteFulfillmentCenter } from "../Controllers/FulfillmentCenter.controller.js";
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
router.get("/delivery-agents", getDeliveryAgents);
router.post("/delivery-agents", createDeliveryAgent);
// Fulfillment Centers Routes
router.post("/fulfillment-centers", createFulfillmentCenter);
router.get("/fulfillment-centers", getAllFulfillmentCenters);
router.get("/fulfillment-centers/:id", getFulfillmentCenterById);
router.put("/fulfillment-centers/:id", updateFulfillmentCenter);
router.delete("/fulfillment-centers/:id", deleteFulfillmentCenter);
export default router;
//# sourceMappingURL=Admin.router.js.map