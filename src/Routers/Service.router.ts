import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../Middleware/AuthMiddleware.js";
import {
    adminListServicesController,
    adminCreateServiceController,
    adminUpdateServiceController,
    adminReviewServiceController,
    adminDeleteServiceController,
    vendorOfferServiceController,
    vendorUpdateServiceOfferingController,
    vendorDeleteServiceOfferingController,
    uploadServiceMediaController,
    adminReviewServiceMediaController,
    deleteServiceMediaController,
    adminListServiceBookingsController,
    adminListServiceQuotationsController,
    adminGetServiceReviewsController,
    vendorGetMyServiceOfferingsController,
} from "../Controllers/Service.controller.js";

const serviceRouter = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024,
    },
});

serviceRouter.use(authMiddleware);

// --- Vendor routes (must be before /:id to avoid route clash) ---
serviceRouter.get("/vendor/offerings", vendorGetMyServiceOfferingsController);
serviceRouter.post("/vendor/offerings", vendorOfferServiceController);
serviceRouter.put("/vendor/offerings/:id", vendorUpdateServiceOfferingController);
serviceRouter.delete("/vendor/offerings/:id", vendorDeleteServiceOfferingController);

// --- Admin monitoring routes (must be before /:id to avoid route clash) ---
serviceRouter.get("/admin/bookings", adminListServiceBookingsController);
serviceRouter.get("/admin/quotations", adminListServiceQuotationsController);
serviceRouter.get("/admin/reviews", adminGetServiceReviewsController);

// --- Service catalog CRUD ---
serviceRouter.get("/", adminListServicesController);
serviceRouter.post("/", adminCreateServiceController);
serviceRouter.put("/:id", adminUpdateServiceController);
serviceRouter.put("/:id/review", adminReviewServiceController);
serviceRouter.delete("/:id", adminDeleteServiceController);

// --- Media management ---
serviceRouter.post("/:id/media", upload.single("file"), uploadServiceMediaController);
serviceRouter.put("/:id/media/:mediaId/review", adminReviewServiceMediaController);
serviceRouter.delete("/:id/media/:mediaId", deleteServiceMediaController);

export default serviceRouter;
