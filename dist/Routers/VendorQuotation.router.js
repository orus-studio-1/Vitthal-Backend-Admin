import { Router } from "express";
import { createVendorQuotation, downloadAdminVendorQuotationPdf, downloadVendorQuotationPdfPublic, getAdminVendorQuotationById, getAdminVendorQuotations, getVendorQuotationPublic, respondVendorQuotationPublic, reviewAdminVendorQuotation, } from "../Controllers/VendorQuotation.controller.js";
import { authMiddleware } from "../Middleware/AuthMiddleware.js";
const router = Router();
router.get("/vendor/:token", getVendorQuotationPublic);
router.get("/vendor/:token/pdf", downloadVendorQuotationPdfPublic);
router.post("/vendor/:token/respond", respondVendorQuotationPublic);
router.use("/admin", authMiddleware);
router.post("/admin", createVendorQuotation);
router.get("/admin", getAdminVendorQuotations);
router.get("/admin/:id", getAdminVendorQuotationById);
router.get("/admin/:id/pdf", downloadAdminVendorQuotationPdf);
router.put("/admin/:id/review", reviewAdminVendorQuotation);
export default router;
//# sourceMappingURL=VendorQuotation.router.js.map