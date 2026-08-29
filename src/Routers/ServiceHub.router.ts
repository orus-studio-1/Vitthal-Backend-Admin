import express from "express";
import {
    getServiceHubStats,
    getAllServiceTickets,
    getServiceTicketById,
    updateTicketStatus,
    assignTicketPersonnel,
    updateSubcategorySchema,
    getAllClientAssets,
    getServiceCategories,
    createServiceCategory,
    updateServiceCategory,
    deleteServiceCategory,
    createServiceSubcategory,
    updateServiceSubcategory,
    deleteServiceSubcategory,
} from "../Controllers/ServiceHub.controller.js";

const router = express.Router();

// Stats & Overview
router.get("/stats", getServiceHubStats);

// Service Tickets
router.get("/tickets", getAllServiceTickets);
router.get("/tickets/:id", getServiceTicketById);
router.patch("/tickets/:id/status", updateTicketStatus);
router.patch("/tickets/:id/assign", assignTicketPersonnel);

// Service Categories CRUD
router.get("/categories", getServiceCategories);
router.post("/categories", createServiceCategory);
router.put("/categories/:id", updateServiceCategory);
router.delete("/categories/:id", deleteServiceCategory);

// Service Subcategories & Dynamic Form Schema Builder
router.post("/subcategories", createServiceSubcategory);
router.put("/subcategories/:id", updateServiceSubcategory);
router.delete("/subcategories/:id", deleteServiceSubcategory);
router.patch("/subcategories/:id/schema", updateSubcategorySchema);

// Client Assets Registry
router.get("/assets", getAllClientAssets);

export default router;
