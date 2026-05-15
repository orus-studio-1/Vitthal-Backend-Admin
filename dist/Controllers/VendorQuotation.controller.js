import { createAndSendVendorQuotation, generateVendorQuotationPdf, getVendorQuotationById, listVendorQuotations, markQuotationOpened, reviewVendorQuotation, serializeAdminQuotation, serializePublicQuotation, submitVendorQuotationResponse, } from "../services/vendorQuotation.service.js";
const adminRoles = ["admin", "super_admin"];
function ensureAdmin(req, res) {
    const { role } = req.user ?? {};
    if (!adminRoles.includes(role)) {
        res.status(403).json({ message: "Unauthorized! Only admins can manage quotations." });
        return null;
    }
    return req.user;
}
export async function createVendorQuotation(req, res) {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res;
    }
    try {
        const result = await createAndSendVendorQuotation({
            vendorId: req.body.vendorId,
            createdByAdminId: authUser.userId,
            ...(authUser.email ? { createdByAdminEmail: authUser.email } : {}),
            title: req.body.title,
            quantity: req.body.quantity,
            unit: req.body.unit,
            targetPrice: req.body.targetPrice,
            requestedMoq: req.body.requestedMoq,
            requestNotes: req.body.requestNotes,
            validityDate: req.body.validityDate,
            adminSignatureData: req.body.adminSignatureData,
        });
        return res.status(201).json({
            message: "Quotation created and emailed to vendor successfully.",
            data: {
                quotation: result.quotation ? serializeAdminQuotation(result.quotation) : null,
                vendorLink: result.vendorLink,
            },
        });
    }
    catch (error) {
        console.error("Error creating vendor quotation:", error);
        return res.status(400).json({
            message: error instanceof Error ? error.message : "Failed to create vendor quotation.",
        });
    }
}
export async function getAdminVendorQuotations(req, res) {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res;
    }
    try {
        const quotations = await listVendorQuotations();
        return res.status(200).json({
            message: "Vendor quotations fetched successfully.",
            data: quotations.map(serializeAdminQuotation),
        });
    }
    catch (error) {
        console.error("Error fetching vendor quotations:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
export async function getAdminVendorQuotationById(req, res) {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res;
    }
    try {
        const quotation = await getVendorQuotationById(String(req.params.id ?? ""));
        if (!quotation) {
            return res.status(404).json({ message: "Quotation not found." });
        }
        return res.status(200).json({
            message: "Vendor quotation fetched successfully.",
            data: serializeAdminQuotation(quotation),
        });
    }
    catch (error) {
        console.error("Error fetching vendor quotation:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
export async function reviewAdminVendorQuotation(req, res) {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res;
    }
    try {
        const quotation = await reviewVendorQuotation({
            quotationId: String(req.params.id ?? ""),
            decision: req.body.decision,
            adminReviewNotes: req.body.adminReviewNotes,
            reviewedByAdminId: authUser.userId,
            ...(authUser.email ? { reviewedByAdminEmail: authUser.email } : {}),
        });
        return res.status(200).json({
            message: "Vendor quotation reviewed successfully.",
            data: quotation ? serializeAdminQuotation(quotation) : null,
        });
    }
    catch (error) {
        console.error("Error reviewing vendor quotation:", error);
        return res.status(400).json({
            message: error instanceof Error ? error.message : "Failed to review vendor quotation.",
        });
    }
}
export async function downloadAdminVendorQuotationPdf(req, res) {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res;
    }
    try {
        const quotation = await getVendorQuotationById(String(req.params.id ?? ""));
        if (!quotation) {
            return res.status(404).json({ message: "Quotation not found." });
        }
        const pdfBuffer = await generateVendorQuotationPdf(quotation);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${quotation.quotation_number}.pdf"`);
        res.send(pdfBuffer);
    }
    catch (error) {
        console.error("Error downloading quotation PDF:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
export async function getVendorQuotationPublic(req, res) {
    try {
        const quotation = await markQuotationOpened(String(req.params.token ?? ""));
        if (!quotation) {
            return res.status(404).json({ message: "Quotation not found." });
        }
        return res.status(200).json({
            message: "Quotation fetched successfully.",
            data: serializePublicQuotation(quotation),
        });
    }
    catch (error) {
        console.error("Error fetching public quotation:", error);
        return res.status(400).json({
            message: error instanceof Error ? error.message : "Failed to fetch quotation.",
        });
    }
}
export async function respondVendorQuotationPublic(req, res) {
    try {
        const quotation = await submitVendorQuotationResponse({
            rawToken: String(req.params.token ?? ""),
            decision: req.body.decision,
            vendorPrice: req.body.vendorPrice,
            vendorMoq: req.body.vendorMoq,
            vendorNotes: req.body.vendorNotes,
            vendorSignatureData: req.body.vendorSignatureData,
            rejectionReason: req.body.rejectionReason,
            responseIp: req.ip || null,
            responseUserAgent: req.get("user-agent") || null,
        });
        return res.status(200).json({
            message: "Quotation response submitted successfully.",
            data: serializePublicQuotation(quotation),
        });
    }
    catch (error) {
        console.error("Error submitting quotation response:", error);
        return res.status(400).json({
            message: error instanceof Error ? error.message : "Failed to submit quotation response.",
        });
    }
}
export async function downloadVendorQuotationPdfPublic(req, res) {
    try {
        const quotation = await markQuotationOpened(String(req.params.token ?? ""));
        if (!quotation) {
            return res.status(404).json({ message: "Quotation not found." });
        }
        const pdfBuffer = await generateVendorQuotationPdf(quotation);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${quotation.quotation_number}.pdf"`);
        res.send(pdfBuffer);
    }
    catch (error) {
        console.error("Error downloading public quotation PDF:", error);
        return res.status(400).json({
            message: error instanceof Error ? error.message : "Failed to download quotation PDF.",
        });
    }
}
//# sourceMappingURL=VendorQuotation.controller.js.map