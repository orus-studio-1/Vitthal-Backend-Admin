import { Router } from "express";
import {
    getClientQuotations,
    getClientQuotationById,
    sendConfirmationMessage,
} from "../Controllers/ClientQuotation.controller.js";
import { authMiddleware } from "../Middleware/AuthMiddleware.js";

const router = Router();

router.use(authMiddleware);

router.get("/", getClientQuotations);
router.get("/:id", getClientQuotationById);
router.post("/:id/confirm", sendConfirmationMessage);

export default router;
