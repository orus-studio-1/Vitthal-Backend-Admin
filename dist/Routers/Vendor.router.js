import { Router } from "express";
import { createVendor, getAllVendors, getVendorById, getVendorInsights, reviewVendor, updateVendor, updateVendorStatus, deleteVendor } from "../Controllers/Vendor.controller.js";
import { getVendorChatMessages, sendVendorChatMessage } from "../Controllers/Chat.controller.js";
const router = Router();
// Admin-only routes for vendor management
router.post("/", createVendor);
router.get("/", getAllVendors);
router.get("/chat", getVendorChatMessages);
router.post("/chat", sendVendorChatMessage);
router.get("/:id", getVendorById);
router.get("/:id/insights", getVendorInsights);
router.put("/:id/review", reviewVendor);
router.put("/:id/status", updateVendorStatus);
router.put("/:id", updateVendor);
router.delete("/:id", deleteVendor);
export default router;
//# sourceMappingURL=Vendor.router.js.map