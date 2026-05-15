import type { Request, Response } from "express";
export declare function createVendorQuotation(req: Request, res: Response): Promise<Response>;
export declare function getAdminVendorQuotations(req: Request, res: Response): Promise<Response>;
export declare function getAdminVendorQuotationById(req: Request, res: Response): Promise<Response>;
export declare function reviewAdminVendorQuotation(req: Request, res: Response): Promise<Response>;
export declare function downloadAdminVendorQuotationPdf(req: Request, res: Response): Promise<Response | void>;
export declare function getVendorQuotationPublic(req: Request, res: Response): Promise<Response>;
export declare function respondVendorQuotationPublic(req: Request, res: Response): Promise<Response>;
export declare function downloadVendorQuotationPdfPublic(req: Request, res: Response): Promise<Response | void>;
//# sourceMappingURL=VendorQuotation.controller.d.ts.map