import { Router } from "express";
import {
    getClientQuotations,
    getClientQuotationById,
    sendConfirmationMessage,
} from "../Controllers/ClientQuotation.controller.js";
import { authMiddleware, requireAdmin } from "../Middleware/AuthMiddleware.js";

const router = Router();

// Admin Web is the only caller: admins reviewing client quotations.
router.use(authMiddleware, requireAdmin);

router.get("/", getClientQuotations);
router.get("/:id", getClientQuotationById);
router.post("/:id/confirm", sendConfirmationMessage);

export default router;
