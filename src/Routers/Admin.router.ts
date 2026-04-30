import { Router } from "express";
import {
    getDashboardStats,
    getAnalytics,
    getUserManagement,
    updateUserStatus
} from "../Controllers/Admin.controller.js";

const router = Router();

// Admin-only routes for dashboard and management
router.get("/dashboard", getDashboardStats);
router.get("/analytics", getAnalytics);
router.get("/users", getUserManagement);
router.put("/users/:id/status", updateUserStatus);

export default router;