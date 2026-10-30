import { Router } from "express";
import {
    createVendor,
    getAllVendors,
    getVendorById,
    getVendorInsights,
    reviewVendor,
    updateVendor,
    updateVendorStatus,
    deleteVendor
} from "../Controllers/Vendor.controller.js";
import { getVendorChatMessages, sendVendorChatMessage } from "../Controllers/Chat.controller.js";
import { requireAdmin, requireVendor } from "../Middleware/AuthMiddleware.js";

const router = Router();

// Vendor's own chat with the admin team (Vendor Web and the vendor app)
router.get("/chat", requireVendor, getVendorChatMessages);
router.post("/chat", requireVendor, sendVendorChatMessage);

// Admin-only routes for vendor management
router.use(requireAdmin);
router.post("/", createVendor);
router.get("/", getAllVendors);
router.get("/:id", getVendorById);
router.get("/:id/insights", getVendorInsights);
router.put("/:id/review", reviewVendor);
router.put("/:id/status", updateVendorStatus);
router.put("/:id", updateVendor);
router.delete("/:id", deleteVendor);

export default router;
