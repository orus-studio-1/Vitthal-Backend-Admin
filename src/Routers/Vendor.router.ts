import { Router } from "express";
import {
    createVendor,
    getAllVendors,
    getVendorById,
    reviewVendor,
    updateVendor,
    updateVendorStatus,
    deleteVendor
} from "../Controllers/Vendor.controller.js";

const router = Router();

// Admin-only routes for vendor management
router.post("/", createVendor);
router.get("/", getAllVendors);
router.get("/:id", getVendorById);
router.put("/:id/review", reviewVendor);
router.put("/:id/status", updateVendorStatus);
router.put("/:id", updateVendor);
router.delete("/:id", deleteVendor);

export default router;
