import "dotenv/config";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { marketplacePool } from "../lib/marketplace.js";
const vendorQuotationSelect = `
    SELECT
        q.id,
        q.quotation_number,
        q.quotation_kind,
        q.vendor_id,
        q.product_id,
        q.created_by_admin_id,
        q.sent_to_email,
        q.title,
        q.quantity,
        q.unit,
        q.target_price,
        q.requested_moq,
        q.request_notes,
        q.validity_date,
        q.status,
        q.vendor_price,
        q.vendor_moq,
        q.vendor_notes,
        q.admin_signature_data,
        q.vendor_signature_data,
        q.token_expires_at,
        q.vendor_opened_at,
        q.vendor_responded_at,
        q.vendor_response_ip,
        q.vendor_response_user_agent,
        q.admin_reviewed_at,
        q.reviewed_by_admin_id,
        q.admin_review_notes,
        q.vendor_rejection_reason,
        q.email_sent_at,
        q.email_last_error,
        q.created_at,
        q.updated_at,
        vendor_user.name AS vendor_name,
        vendor_user.email AS vendor_email,
        v.phone AS vendor_phone,
        v.company_name,
        v.business_type,
        v.gst_number,
        v.company_website,
        v.alternative_number,
        v.designation,
        v.business_description,
        v.credit_cycle,
        v.minimum_commision_percentage,
        v.maximum_commision_percentage,
        admin_user.name AS created_by_admin_name,
        admin_user.email AS created_by_admin_email
    FROM vendor_quotations q
    JOIN vendors v ON v.id = q.vendor_id
    JOIN users vendor_user ON vendor_user.id = v.user_id
    JOIN users admin_user ON admin_user.id = q.created_by_admin_id
`;
const AUTO_SIGNATURE_MARKER = "__AUTO_TEXT_SIGNATURE__";
let cachedTransporter = null;
function requireEnv(name) {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
function getMailTransporter() {
    if (cachedTransporter) {
        return cachedTransporter;
    }
    const host = requireEnv("SMTP_HOST");
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
    });
    return cachedTransporter;
}
function getMailFrom() {
    return requireEnv("MAIL_FROM");
}
function buildVendorDocumentUrl(baseUrl, rawToken) {
    return `${baseUrl.replace(/\/$/, "")}?token=${encodeURIComponent(rawToken)}`;
}
function getVendorQuotationAppUrl(rawToken) {
    return buildVendorDocumentUrl(requireEnv("VENDOR_QUOTATION_APP_URL"), rawToken);
}
function getAdminQuotationAppUrl(quotationId) {
    const baseUrl = process.env.ADMIN_QUOTATION_APP_URL?.trim();
    if (!baseUrl) {
        return null;
    }
    return `${baseUrl.replace(/\/$/, "")}/${quotationId}`;
}
function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}
function generateToken() {
    return crypto.randomBytes(32).toString("hex");
}
function parsePositiveNumber(value, field) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`${field} must be a positive number.`);
    }
    return parsed;
}
function parseOptionalCurrency(value, field) {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`${field} must be a valid amount.`);
    }
    return parsed;
}
function parseOptionalInteger(value, field) {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${field} must be a positive integer.`);
    }
    return parsed;
}
function normalizeRequiredText(value, field) {
    if (value === undefined || value === null) {
        throw new Error(`${field} is required.`);
    }
    const normalized = String(value).trim();
    if (!normalized) {
        throw new Error(`${field} is required.`);
    }
    return normalized;
}
function normalizeOptionalText(value) {
    if (value === undefined || value === null) {
        return null;
    }
    const normalized = String(value).trim();
    return normalized || null;
}
function parseValidityDate(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
        throw new Error("validityDate must be a valid ISO date string.");
    }
    return date;
}
function dataUrlToBytes(dataUrl) {
    const match = dataUrl.match(/^data:(image\/png|image\/jpeg|image\/jpg);base64,(.+)$/);
    if (!match) {
        throw new Error("Signature must be a PNG or JPEG data URL.");
    }
    const mimeType = match[1];
    const base64 = match[2];
    if (!mimeType || !base64) {
        throw new Error("Signature must be a PNG or JPEG data URL.");
    }
    return {
        mimeType,
        bytes: Buffer.from(base64, "base64"),
    };
}
// embedSignature is no longer needed with pdfmake
function normalizeAdminSignatureData(value) {
    const normalized = normalizeOptionalText(value);
    if (!normalized || normalized.includes("REPLACE_WITH_ADMIN_SIGNATURE")) {
        return AUTO_SIGNATURE_MARKER;
    }
    try {
        dataUrlToBytes(normalized);
        return normalized;
    }
    catch {
        return AUTO_SIGNATURE_MARKER;
    }
}
function formatDate(value) {
    if (!value) {
        return "Not specified";
    }
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}
function formatDateTime(value) {
    if (!value) {
        return "Not available";
    }
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
function formatCurrency(value) {
    if (value === null || value === undefined || value === "") {
        return "Not specified";
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return String(value);
    }
    const formatted = new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(numeric);
    return `Rs. ${formatted}`;
}
function formatStatus(status) {
    return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
function formatKindLabel(kind) {
    return kind === "vendor_agreement" ? "Vendor Agreement" : "Order Quotation";
}
// Unused pdf-lib helpers removed
export async function getVendorQuotationById(quotationId) {
    const result = await marketplacePool.query(`${vendorQuotationSelect} WHERE q.id = $1`, [quotationId]);
    return result.rows[0] ?? null;
}
export async function getVendorQuotationByToken(rawToken) {
    const tokenHash = hashToken(rawToken);
    const result = await marketplacePool.query(`${vendorQuotationSelect} WHERE q.token_hash = $1`, [tokenHash]);
    return result.rows[0] ?? null;
}
export async function listVendorQuotations() {
    const result = await marketplacePool.query(`${vendorQuotationSelect} ORDER BY q.created_at DESC`);
    return result.rows;
}
export async function listVendorQuotationsForUser(userId, quotationKind) {
    const values = [userId];
    let whereClause = `WHERE v.user_id = $1`;
    if (quotationKind) {
        values.push(quotationKind);
        whereClause += ` AND q.quotation_kind = $2`;
    }
    const result = await marketplacePool.query(`${vendorQuotationSelect} ${whereClause} ORDER BY q.created_at DESC`, values);
    return result.rows;
}
export async function listVendorQuotationsForEmail(email, quotationKind) {
    const values = [email.trim().toLowerCase()];
    let whereClause = `WHERE LOWER(vendor_user.email) = $1`;
    if (quotationKind) {
        values.push(quotationKind);
        whereClause += ` AND q.quotation_kind = $2`;
    }
    const result = await marketplacePool.query(`${vendorQuotationSelect} ${whereClause} ORDER BY q.created_at DESC`, values);
    return result.rows;
}
export async function serializeAdminQuotation(quotation) {
    let categories = [];
    try {
        const categoriesResult = await marketplacePool.query(`SELECT c.code, c.label, c.min_commision_percentage, c.max_commision_percentage 
             FROM vendor_categories vc
             JOIN product_category c ON c.id = vc.category_id
             WHERE vc.vendor_id = $1`, [quotation.vendor_id]);
        categories = categoriesResult.rows;
    }
    catch (err) {
        console.error("Error fetching categories for serialization:", err);
    }
    return {
        id: quotation.id,
        quotation_number: quotation.quotation_number,
        quotation_kind: quotation.quotation_kind,
        vendor_id: quotation.vendor_id,
        product_id: quotation.product_id,
        created_by_admin_id: quotation.created_by_admin_id,
        sent_to_email: quotation.sent_to_email,
        title: quotation.title,
        quantity: Number(quotation.quantity),
        unit: quotation.unit,
        target_price: quotation.target_price === null ? null : Number(quotation.target_price),
        requested_moq: quotation.requested_moq,
        request_notes: quotation.request_notes,
        validity_date: quotation.validity_date,
        status: quotation.status,
        vendor_price: quotation.vendor_price === null ? null : Number(quotation.vendor_price),
        vendor_moq: quotation.vendor_moq,
        vendor_notes: quotation.vendor_notes,
        admin_signature_data: quotation.admin_signature_data,
        vendor_signature_data: quotation.vendor_signature_data,
        token_expires_at: quotation.token_expires_at,
        vendor_opened_at: quotation.vendor_opened_at,
        vendor_responded_at: quotation.vendor_responded_at,
        vendor_response_ip: quotation.vendor_response_ip,
        vendor_response_user_agent: quotation.vendor_response_user_agent,
        admin_reviewed_at: quotation.admin_reviewed_at,
        reviewed_by_admin_id: quotation.reviewed_by_admin_id,
        admin_review_notes: quotation.admin_review_notes,
        vendor_rejection_reason: quotation.vendor_rejection_reason,
        email_sent_at: quotation.email_sent_at,
        email_last_error: quotation.email_last_error,
        created_at: quotation.created_at,
        updated_at: quotation.updated_at,
        vendor_name: quotation.vendor_name,
        vendor_email: quotation.vendor_email,
        vendor_phone: quotation.vendor_phone,
        company_name: quotation.company_name,
        created_by_admin_name: quotation.created_by_admin_name,
        created_by_admin_email: quotation.created_by_admin_email,
        categories,
    };
}
export async function serializePublicQuotation(quotation) {
    let categories = [];
    try {
        const categoriesResult = await marketplacePool.query(`SELECT c.code, c.label, c.min_commision_percentage, c.max_commision_percentage 
             FROM vendor_categories vc
             JOIN product_category c ON c.id = vc.category_id
             WHERE vc.vendor_id = $1`, [quotation.vendor_id]);
        categories = categoriesResult.rows;
    }
    catch (err) {
        console.error("Error fetching categories for serialization:", err);
    }
    return {
        id: quotation.id,
        quotation_number: quotation.quotation_number,
        quotation_kind: quotation.quotation_kind,
        vendor_id: quotation.vendor_id,
        product_id: quotation.product_id,
        sent_to_email: quotation.sent_to_email,
        title: quotation.title,
        quantity: Number(quotation.quantity),
        unit: quotation.unit,
        target_price: quotation.target_price === null ? null : Number(quotation.target_price),
        requested_moq: quotation.requested_moq,
        request_notes: quotation.request_notes,
        validity_date: quotation.validity_date,
        status: quotation.status,
        vendor_price: quotation.vendor_price === null ? null : Number(quotation.vendor_price),
        vendor_moq: quotation.vendor_moq,
        vendor_notes: quotation.vendor_notes,
        vendor_rejection_reason: quotation.vendor_rejection_reason,
        token_expires_at: quotation.token_expires_at,
        vendor_opened_at: quotation.vendor_opened_at,
        vendor_responded_at: quotation.vendor_responded_at,
        company_name: quotation.company_name,
        vendor_name: quotation.vendor_name,
        business_type: quotation.business_type,
        gst_number: quotation.gst_number,
        company_website: quotation.company_website,
        alternative_number: quotation.alternative_number,
        designation: quotation.designation,
        business_description: quotation.business_description,
        credit_cycle: quotation.credit_cycle,
        minimum_commision_percentage: quotation.minimum_commision_percentage,
        maximum_commision_percentage: quotation.maximum_commision_percentage,
        created_by_admin_name: quotation.created_by_admin_name,
        admin_reviewed_at: quotation.admin_reviewed_at,
        admin_review_notes: quotation.admin_review_notes,
        categories,
    };
}
let logoBase64 = "";
async function getLogoBase64() {
    const logoUrl = "https://res.cloudinary.com/deudvpcgx/image/upload/v1779186769/favicon_somltc.jpg";
    if (logoBase64)
        return logoBase64;
    try {
        const response = await fetch(logoUrl);
        const arrayBuffer = await response.arrayBuffer();
        logoBase64 = `data:image/jpeg;base64,${Buffer.from(arrayBuffer).toString("base64")}`;
        return logoBase64;
    }
    catch (err) {
        console.error("Failed to fetch company logo:", err);
        return "";
    }
}
export async function generateVendorQuotationPdf(quotation) {
    const PdfPrinter = (await import("pdfmake")).default;
    const fonts = {
        Helvetica: {
            normal: "Helvetica",
            bold: "Helvetica-Bold",
            italics: "Helvetica-Oblique",
            bolditalics: "Helvetica-BoldOblique",
        },
    };
    const printer = new PdfPrinter(fonts);
    const isAgreement = quotation.quotation_kind === "vendor_agreement";
    const companyName = "MTWO Groups";
    const companyAddress = "Plot No. 42, Bopodi Industrial Estate, Pune 411003";
    let vendorCategories = [];
    let vendorCategoriesStr = "Not specified";
    try {
        const categoriesResult = await marketplacePool.query(`SELECT c.label, c.min_commision_percentage, c.max_commision_percentage 
             FROM vendor_categories vc
             JOIN product_category c ON c.id = vc.category_id
             WHERE vc.vendor_id = $1`, [quotation.vendor_id]);
        vendorCategories = categoriesResult.rows;
        if (vendorCategories.length > 0) {
            vendorCategoriesStr = vendorCategories.map((row) => row.label).join(", ");
        }
    }
    catch (err) {
        console.error("Error fetching vendor categories for PDF:", err);
    }
    let vendorAddressStr = "Not specified";
    try {
        const addressResult = await marketplacePool.query(`SELECT a.address, a.city, a.state, a.country, a.pincode 
             FROM addresses a
             JOIN vendors v ON v.user_id = a.user_id
             WHERE v.id = $1`, [quotation.vendor_id]);
        if (addressResult.rows.length > 0) {
            const addr = addressResult.rows[0];
            vendorAddressStr = `${addr.address}, ${addr.city}, ${addr.state}, ${addr.country} - ${addr.pincode}`;
        }
    }
    catch (err) {
        console.error("Error fetching vendor address for PDF:", err);
    }
    const logo = await getLogoBase64();
    function getSignatureNode(sigData) {
        if (!sigData) {
            return { text: "Pending Signature", italics: true, color: "#9ca3af", margin: [0, 10, 0, 10] };
        }
        if (sigData === AUTO_SIGNATURE_MARKER) {
            return {
                stack: [
                    { text: "Digitally prepared by", fontSize: 9, color: "#4b5563" },
                    { text: quotation.created_by_admin_name, fontSize: 13, bold: true, color: "#0f4c81" }
                ],
                margin: [0, 10, 0, 10]
            };
        }
        try {
            return { image: sigData, fit: [150, 40], margin: [0, 5, 0, 5] };
        }
        catch (err) {
            console.error("Error embedding signature in pdfmake:", err);
            return { text: "Signature Error", italics: true, color: "red", margin: [0, 10, 0, 10] };
        }
    }
    const bulletList = [];
    if (vendorCategories && vendorCategories.length > 0) {
        const catLines = vendorCategories.map((cat) => ({
            text: `• ${cat.label}: ${cat.min_commision_percentage}% - ${cat.max_commision_percentage}%`,
            margin: [12, 2, 0, 2],
            fontSize: 9,
            color: "#4b5563"
        }));
        bulletList.push({
            stack: [
                {
                    text: [
                        { text: "Platform Commission: ", bold: true },
                        "The platform will charge a service fee commission based on product category as follows:"
                    ]
                },
                ...catLines
            ],
            style: "bulletItem"
        });
    }
    else {
        bulletList.push({
            text: [
                { text: "Platform Commission: ", bold: true },
                `The platform will charge a service fee commission between ${quotation.minimum_commision_percentage ?? 0}% and ${quotation.maximum_commision_percentage ?? 0}% of the gross order value, depending on the product category.`
            ],
            style: "bulletItem"
        });
    }
    bulletList.push({
        text: [
            { text: "Credit Cycle Settlement: ", bold: true },
            `Settlements will be completed according to the agreed credit terms of ${quotation.credit_cycle || "Standard Platform Terms"} from the date of successful order delivery.`
        ],
        style: "bulletItem"
    });
    bulletList.push({
        text: [
            { text: "Price Protection: ", bold: true },
            "The Vendor agrees that prices listed on the B2B marketplace will be competitive and shall not exceed prices offered on other online channels or direct sales."
        ],
        style: "bulletItem"
    });
    const docContent = [
        {
            columns: [
                logo ? { image: logo, width: 45, margin: [0, 0, 10, 0] } : {},
                {
                    stack: [
                        { text: companyName, fontSize: 24, bold: true, color: "#0f4c81" },
                        { text: companyAddress, fontSize: 10, color: "#6b7280", margin: [0, 2, 0, 0] }
                    ]
                }
            ],
            margin: [0, 0, 0, 10]
        },
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: "#0f4c81" }], margin: [0, 0, 0, 20] }
    ];
    if (isAgreement) {
        const startDate = formatDate(new Date());
        docContent.push({ text: "VENDOR AGREEMENT", fontSize: 20, bold: true, color: "#0f4c81", alignment: "center", margin: [0, 0, 0, 4], characterSpacing: 2 }, { text: `Reference: ${quotation.quotation_number} | Date: ${startDate}`, fontSize: 10, color: "#6b7280", alignment: "center", margin: [0, 0, 0, 15] }, { text: "1. Parties Involved", style: "sectionHeader" }, { text: `This Vendor Agreement is made between ${companyName}, located at ${companyAddress}, and ${quotation.company_name} (Vendor ID: ${quotation.vendor_id}), located at the registered corporate address: ${vendorAddressStr}. Hereinafter referred to collectively as "the Parties".`, style: "paragraph" }, { text: "2. Term of Agreement", style: "sectionHeader" }, { text: `The Agreement shall commence on ${startDate} and shall remain in effect for a standard initial term of twelve (12) months, automatically renewing unless terminated earlier by either party in accordance with Section 8.`, style: "paragraph" }, { text: "3. Scope of Work & Approved Profile", style: "sectionHeader" }, { text: "The Vendor is authorized to list, sell, and distribute goods on the platform strictly within the approved categories and business profile detailed below. Please note that platform administration reserves the right to adjust trading categories during verification, and the listed approved categories represent the finalized scope:", style: "paragraph" }, {
            table: {
                widths: ["30%", "70%"],
                body: [
                    [{ text: "Approved Trading Categories", bold: true }, { text: vendorCategoriesStr, bold: true, color: "#0f4c81" }],
                    [{ text: "Business Type", bold: true }, { text: quotation.business_type || "Not specified" }],
                    [{ text: "Company Website", bold: true }, { text: quotation.company_website || "Not specified", color: "#0f4c81" }],
                    [{ text: "Registered Address", bold: true }, { text: vendorAddressStr }],
                    [{ text: "GSTIN (Tax Identifier)", bold: true }, { text: quotation.gst_number || "Not specified" }],
                    [{ text: "Business Profile Description", bold: true }, { text: quotation.business_description || "Not specified" }]
                ]
            },
            layout: {
                hLineWidth: function () { return 1; },
                vLineWidth: function () { return 1; },
                hLineColor: function () { return "#e5e7eb"; },
                vLineColor: function () { return "#e5e7eb"; },
                paddingLeft: function () { return 10; },
                paddingRight: function () { return 10; },
                paddingTop: function () { return 6; },
                paddingBottom: function () { return 6; }
            },
            margin: [0, 5, 0, 8]
        }, { text: "* Note: The categories above represent the official authorized trading classifications. Initial category selections edited or reassigned by administration are finalized herein to enforce catalog accuracy.", fontSize: 8, color: "#ef4444", italics: true, margin: [0, 4, 0, 15] }, { text: "4. Commercial Terms & Commission Structure", style: "sectionHeader" }, { text: "Transactions initiated through the platform shall be settled based on the following agreed financial terms:", style: "paragraph" }, {
            ul: bulletList,
            margin: [0, 0, 0, 10]
        }, { text: "5. Fulfillment, Logistics & Product Handovers", style: "sectionHeader" }, { text: "To ensure high service standards, the Vendor agrees to adhere to the following fulfillment SLA:", style: "paragraph" }, {
            ul: [
                {
                    text: [
                        { text: "Order Packaging: ", bold: true },
                        "Vendor is responsible for industrial-grade packaging of all products, ensuring compliance with transport regulations."
                    ],
                    style: "bulletItem"
                },
                {
                    text: [
                        { text: "Dispatch Timeline (SLA): ", bold: true },
                        'Vendor must package and mark orders as "Ready for Dispatch" within 48 hours of order confirmation.'
                    ],
                    style: "bulletItem"
                },
                {
                    text: [
                        { text: "Dispatch Origin: ", bold: true },
                        `All items must be dispatched from the registered warehouse address: ${vendorAddressStr}, or an approved fulfillment center.`
                    ],
                    style: "bulletItem"
                }
            ],
            margin: [0, 0, 0, 10]
        }, { text: "6. Quality Assurance, Defect Rate & Returns", style: "sectionHeader" }, { text: "The Vendor warrants that all goods supplied are brand new, genuine, and free of defects:", style: "paragraph" }, {
            ul: [
                {
                    text: [
                        { text: "Quality Standards: ", bold: true },
                        "Defect rates exceeding 1.5% in any quarterly period will result in immediate catalog suspension."
                    ],
                    style: "bulletItem"
                },
                {
                    text: [
                        { text: "Counterfeit Goods: ", bold: true },
                        "Listing counterfeit or unauthorized refurbished goods will lead to immediate termination and legal action."
                    ],
                    style: "bulletItem"
                },
                {
                    text: [
                        { text: "Platform Returns: ", bold: true },
                        "MTWO Groups reserves the right to return any damaged, defective, or incorrect items at the Vendor's sole cost, with refunds processed within the standard cycle."
                    ],
                    style: "bulletItem"
                }
            ],
            margin: [0, 0, 0, 10]
        }, { text: "7. Intellectual Property & Brand Listing", style: "sectionHeader" }, { text: "The Vendor grants MTWO Groups a non-exclusive, worldwide, royalty-free license to display, use, and promote the Vendor's trade names, trademarks, logos, product catalog descriptions, and product images solely for listing and marketing purposes on the B2B marketplace.", style: "paragraph" }, { text: "8. Suspension and Termination", style: "sectionHeader" }, { text: "This Agreement can be terminated by either party with a 30-day written notice. However, MTWO Groups reserves the right to immediately suspend or block the Vendor's account without notice in cases of tax non-compliance, severe delivery delays, fraudulent listings, or low quality ratings.", style: "paragraph" }, { text: "9. Confidentiality and Customer Data", style: "sectionHeader" }, { text: "The Vendor shall protect and keep strictly confidential all customer data, purchase order quantities, special pricing terms, and platform technology details. Under no circumstances shall the Vendor share customer contact info or bypass the platform to trade directly.", style: "paragraph" }, { text: "10. Dispute Resolution & Legal Jurisdiction", style: "sectionHeader" }, { text: "In case of disputes, both Parties agree to undergo constructive mediation. If unresolved, disputes will be settled via arbitration under the Arbitration and Conciliation Act. The legal jurisdiction for all proceedings shall lie exclusively in the courts of Pune, Maharashtra, India.", style: "paragraph" });
    }
    else {
        docContent.push({ text: "ORDER QUOTATION", fontSize: 22, bold: true, color: "#0f4c81", alignment: "center", margin: [0, 0, 0, 5], characterSpacing: 2 }, { text: `Reference: ${quotation.quotation_number}`, fontSize: 11, color: "#6b7280", alignment: "center", margin: [0, 0, 0, 20] }, {
            columns: [
                {
                    width: "48%",
                    stack: [
                        { text: "Request Details", bold: true, color: "#0f4c81", margin: [0, 0, 0, 5] },
                        { canvas: [{ type: "line", x1: 0, y1: 0, x2: 240, y2: 0, lineWidth: 1, lineColor: "#e5e7eb" }], margin: [0, 0, 0, 10] },
                        {
                            table: {
                                widths: [80, "*"],
                                body: [
                                    [{ text: "Title:", color: "#6b7280", fontSize: 10 }, { text: quotation.title || "", bold: true, fontSize: 10 }],
                                    [{ text: "Quantity:", color: "#6b7280", fontSize: 10 }, { text: `${quotation.quantity} ${quotation.unit}`, bold: true, fontSize: 10 }],
                                    [{ text: "Target Price:", color: "#6b7280", fontSize: 10 }, { text: formatCurrency(quotation.target_price), bold: true, fontSize: 10 }],
                                    [{ text: "Requested MOQ:", color: "#6b7280", fontSize: 10 }, { text: quotation.requested_moq ?? "Not specified", bold: true, fontSize: 10 }]
                                ]
                            },
                            layout: "noBorders"
                        }
                    ]
                },
                { text: "", width: "4%" },
                {
                    width: "48%",
                    stack: [
                        { text: "Vendor Information", bold: true, color: "#0f4c81", margin: [0, 0, 0, 5] },
                        { canvas: [{ type: "line", x1: 0, y1: 0, x2: 240, y2: 0, lineWidth: 1, lineColor: "#e5e7eb" }], margin: [0, 0, 0, 10] },
                        {
                            table: {
                                widths: [80, "*"],
                                body: [
                                    [{ text: "Company:", color: "#6b7280", fontSize: 10 }, { text: quotation.company_name || "", bold: true, fontSize: 10 }],
                                    [{ text: "Contact:", color: "#6b7280", fontSize: 10 }, { text: quotation.vendor_name || "", bold: true, fontSize: 10 }],
                                    [{ text: "Email:", color: "#6b7280", fontSize: 10 }, { text: quotation.sent_to_email || "", bold: true, fontSize: 10 }],
                                    [{ text: "Status:", color: "#6b7280", fontSize: 10 }, { text: formatStatus(quotation.status), bold: true, color: "#0f4c81", fontSize: 10 }]
                                ]
                            },
                            layout: "noBorders"
                        }
                    ]
                }
            ],
            margin: [0, 0, 0, 20]
        }, { text: "Admin Notes", bold: true, color: "#0f4c81", margin: [0, 10, 0, 5] }, { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#e5e7eb" }], margin: [0, 0, 0, 10] }, {
            table: {
                widths: ["*"],
                body: [
                    [
                        { text: quotation.request_notes || "No specific notes provided.", fontSize: 10, margin: [10, 10, 10, 10] }
                    ]
                ]
            },
            layout: {
                hLineWidth: function () { return 1; },
                vLineWidth: function () { return 1; },
                hLineColor: function () { return "#e5e7eb"; },
                vLineColor: function () { return "#e5e7eb"; }
            },
            fillColor: "#f9fafb",
            margin: [0, 0, 0, 20]
        }, { text: "Vendor Response", bold: true, color: "#0f4c81", margin: [0, 10, 0, 5] }, { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#e5e7eb" }], margin: [0, 0, 0, 10] }, {
            table: {
                widths: ["30%", "70%"],
                body: [
                    [{ text: "Vendor Price", bold: true, fontSize: 10 }, { text: formatCurrency(quotation.vendor_price), fontSize: 10 }],
                    [{ text: "Vendor MOQ", bold: true, fontSize: 10 }, { text: quotation.vendor_moq ?? "Not specified", fontSize: 10 }],
                    [{ text: "Responded At", bold: true, fontSize: 10 }, { text: formatDateTime(quotation.vendor_responded_at), fontSize: 10 }],
                    [{ text: "Vendor Notes", bold: true, fontSize: 10 }, { text: quotation.vendor_notes || "No notes provided.", fontSize: 10 }],
                    ...(quotation.vendor_rejection_reason ? [
                        [{ text: "Rejection Reason", bold: true, color: "#ef4444", fontSize: 10 }, { text: quotation.vendor_rejection_reason, color: "#ef4444", fontSize: 10 }]
                    ] : [])
                ]
            },
            layout: {
                hLineWidth: function () { return 1; },
                vLineWidth: function () { return 1; },
                hLineColor: function () { return "#e5e7eb"; },
                vLineColor: function () { return "#e5e7eb"; }
            },
            margin: [0, 0, 0, 20]
        });
    }
    docContent.push({ text: "Signatures", style: "sectionHeader" }, { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#e5e7eb" }], margin: [0, 0, 0, 15] }, {
        columns: [
            {
                width: "48%",
                stack: [
                    { text: `For ${companyName}`, bold: true, fontSize: 11, color: "#1f2937", margin: [0, 0, 0, 5] },
                    getSignatureNode(quotation.admin_signature_data),
                    { canvas: [{ type: "line", x1: 0, y1: 0, x2: 240, y2: 0, lineWidth: 1, lineColor: "#1f2937" }], margin: [0, 5, 0, 5] },
                    { text: `Name: ${quotation.created_by_admin_name}`, bold: true, fontSize: 10 },
                    { text: `Date: ${formatDateTime(quotation.created_at)}`, fontSize: 9, color: "#6b7280" }
                ]
            },
            { text: "", width: "4%" },
            {
                width: "48%",
                stack: [
                    { text: `For ${quotation.company_name}`, bold: true, fontSize: 11, color: "#1f2937", margin: [0, 0, 0, 5] },
                    getSignatureNode(quotation.vendor_signature_data),
                    { canvas: [{ type: "line", x1: 0, y1: 0, x2: 240, y2: 0, lineWidth: 1, lineColor: "#1f2937" }], margin: [0, 5, 0, 5] },
                    { text: `Name: ${quotation.vendor_name || "Pending"}`, bold: true, fontSize: 10 },
                    { text: `Date: ${quotation.vendor_responded_at ? formatDateTime(quotation.vendor_responded_at) : "Pending"}`, fontSize: 9, color: "#6b7280" }
                ]
            }
        ],
        margin: [0, 10, 0, 20]
    }, { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#f3f4f6" }], margin: [0, 10, 0, 5] }, {
        text: `Document Generated: ${formatDateTime(new Date())} | Ref: ${quotation.quotation_number}\nAudit Trail: Sent ${formatDateTime(quotation.email_sent_at)} | IP: ${quotation.vendor_response_ip || "N/A"}`,
        fontSize: 9,
        color: "#9ca3af",
        alignment: "center"
    });
    const docDefinition = {
        defaultStyle: {
            font: "Helvetica",
            fontSize: 10,
            lineHeight: 1.45,
            color: "#1f2937"
        },
        pageMargins: [50, 50, 50, 50],
        content: docContent,
        styles: {
            sectionHeader: { fontSize: 13, bold: true, color: "#0f4c81", margin: [0, 20, 0, 10] },
            paragraph: { fontSize: 10, color: "#1f2937", margin: [0, 0, 0, 12], alignment: "justify" },
            bulletItem: { fontSize: 10, color: "#1f2937", margin: [0, 3, 0, 3] }
        }
    };
    const pdfDoc = await printer.createPdfKitDocument(docDefinition);
    return new Promise((resolve, reject) => {
        const chunks = [];
        pdfDoc.on("data", (chunk) => chunks.push(chunk));
        pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
        pdfDoc.on("error", (err) => reject(err));
        pdfDoc.end();
    });
}
async function sendQuotationEmail({ quotation, rawToken, pdfBuffer }) {
    const transporter = getMailTransporter();
    const vendorLink = getVendorQuotationAppUrl(rawToken);
    const isAgreement = quotation.quotation_kind === "vendor_agreement";
    const documentLabel = isAgreement ? "agreement" : "quotation request";
    const actionLabel = isAgreement
        ? "review the attached agreement, sign it, and submit your response"
        : "review the attached PDF, update pricing, add your notes, sign, and submit";
    await transporter.sendMail({
        from: getMailFrom(),
        to: quotation.sent_to_email,
        subject: `${isAgreement ? "Agreement" : "Quotation"} ${quotation.quotation_number} from ${quotation.created_by_admin_name}`,
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
                <!-- Header with Company Logo -->
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <img src="https://res.cloudinary.com/deudvpcgx/image/upload/v1779186769/favicon_somltc.jpg" alt="Logo" style="height: 40px; width: 40px; border-radius: 8px; object-fit: cover;" />
                        <span style="font-size: 18px; font-weight: 700; color: #0f4c81; letter-spacing: 0.5px;">MTWO GROUPS</span>
                    </div>
                    <span style="font-size: 12px; font-weight: 600; color: #64748b; background-color: #f1f5f9; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">B2B Marketplace</span>
                </div>

                <!-- Invitation Context -->
                <h2 style="font-size: 20px; font-weight: 700; color: #0f4c81; margin-top: 0; margin-bottom: 12px;">
                    ${isAgreement ? "New B2B Vendor Agreement" : "B2B Quotation Request"}
                </h2>
                <p style="font-size: 14px; color: #475569; margin-top: 0; margin-bottom: 20px; line-height: 1.5;">
                    Dear Partner,
                </p>
                <p style="font-size: 14px; color: #475569; margin-top: 0; margin-bottom: 20px; line-height: 1.5;">
                    An official ${documentLabel} has been generated by <strong>${quotation.created_by_admin_name}</strong> for your business (<strong>${quotation.company_name}</strong>) regarding the product/scope detailed below.
                </p>

                <!-- Transaction Details Table -->
                <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                        <thead>
                            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                                <th style="padding: 10px 14px; font-weight: 600; color: #475569; width: 40%;">Specification</th>
                                <th style="padding: 10px 14px; font-weight: 600; color: #475569;">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 10px 14px; color: #64748b; font-weight: 500;">Document Ref</td>
                                <td style="padding: 10px 14px; color: #0f4c81; font-weight: 700; font-family: monospace; font-size: 14px;">${quotation.quotation_number}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 10px 14px; color: #64748b; font-weight: 500;">Scope / Item</td>
                                <td style="padding: 10px 14px; color: #1e293b; font-weight: 600;">${quotation.title}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 10px 14px; color: #64748b; font-weight: 500;">Quantity</td>
                                <td style="padding: 10px 14px; color: #1e293b; font-weight: 600;">${quotation.quantity} ${quotation.unit}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 10px 14px; color: #64748b; font-weight: 500;">Target Unit Price</td>
                                <td style="padding: 10px 14px; color: #16a34a; font-weight: 700;">${formatCurrency(quotation.target_price)}</td>
                            </tr>
                            ${quotation.requested_moq ? `
                            <tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding: 10px 14px; color: #64748b; font-weight: 500;">Requested MOQ</td>
                                <td style="padding: 10px 14px; color: #1e293b; font-weight: 600;">${quotation.requested_moq} units</td>
                            </tr>` : ''}
                            <tr>
                                <td style="padding: 10px 14px; color: #64748b; font-weight: 500;">Valid Until</td>
                                <td style="padding: 10px 14px; color: #ef4444; font-weight: 600;">${formatDate(quotation.validity_date)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Call to Action -->
                <p style="font-size: 14px; color: #475569; margin-top: 0; margin-bottom: 20px; line-height: 1.5;">
                    Please click the button below to access the secure partner portal, review the complete contract terms, and sign/respond electronically.
                </p>
                
                <div style="text-align: center; margin-bottom: 24px;">
                    <a href="${vendorLink}" style="display: inline-block; padding: 12px 24px; background-color: #0f4c81; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 8px; transition: background-color 0.2s;">
                        Access Secure ${isAgreement ? "Agreement" : "Quotation"} Portal
                    </a>
                </div>

                <!-- Attachment and Link Expiry Notice -->
                <div style="background-color: #f8fafc; border: 1px dashed #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 24px;">
                    <p style="font-size: 12px; color: #64748b; margin: 0; line-height: 1.6;">
                        📌 <strong>Document Attached:</strong> A high-resolution copy of the generated PDF agreement is attached to this email for your local records.
                    </p>
                    <p style="font-size: 12px; color: #64748b; margin: 6px 0 0 0; line-height: 1.6;">
                        ⏳ <strong>Portal Expiry:</strong> The secure portal access link is valid until <strong>${formatDateTime(quotation.token_expires_at)}</strong>.
                    </p>
                </div>

                <!-- Professional Footer -->
                <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; text-align: center;">
                    <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5;">
                        This is a secure business transaction transmission from MTWO Groups B2B Platform.
                    </p>
                    <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0 0; line-height: 1.5;">
                        Confidentiality Warning: This transmission contains privileged information intended solely for the recipient partner.
                    </p>
                </div>
            </div>
        `,
        attachments: [
            {
                filename: quotation.quotation_kind === "vendor_agreement"
                    ? `MTWO_Agreement_${quotation.id}.pdf`
                    : `MTWO_VQ_${quotation.id}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
            },
        ],
    });
}
async function sendAdminNotificationEmail(quotation) {
    const transporter = getMailTransporter();
    const adminLink = getAdminQuotationAppUrl(quotation.id);
    const documentLabel = quotation.quotation_kind === "vendor_agreement" ? "agreement" : "quotation";
    const vendorSummary = quotation.status === "vendor_rejected"
        ? `The vendor rejected this ${documentLabel}. Reason: ${quotation.vendor_rejection_reason || "Not provided"}.`
        : `The vendor submitted pricing ${formatCurrency(quotation.vendor_price)} with MOQ ${quotation.vendor_moq ?? "Not specified"}.`;
    await transporter.sendMail({
        from: getMailFrom(),
        to: quotation.created_by_admin_email,
        subject: `Vendor response for ${documentLabel} ${quotation.quotation_number}`,
        html: `
            <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                <h2 style="margin-bottom: 8px;">Vendor Response Received</h2>
                <p>Hello ${quotation.created_by_admin_name},</p>
                <p>${quotation.company_name} has responded to ${documentLabel} <strong>${quotation.quotation_number}</strong>.</p>
                <p>${vendorSummary}</p>
                ${adminLink ? `<p><a href="${adminLink}" style="display: inline-block; padding: 10px 18px; background: #0f4c81; color: #ffffff; text-decoration: none; border-radius: 6px;">Review ${quotation.quotation_kind === "vendor_agreement" ? "Agreement" : "Quotation"}</a></p>` : ""}
            </div>
        `,
    });
}
export async function createAndSendVendorQuotation(input) {
    const quotationKind = (normalizeOptionalText(input.quotationKind) || "order_request").toLowerCase();
    if (quotationKind !== "vendor_agreement" && quotationKind !== "order_request") {
        throw new Error("quotationKind must be either vendor_agreement or order_request.");
    }
    if (quotationKind === "vendor_agreement") {
        throw new Error("Vendor agreement signing has been replaced by mandatory signature image upload during vendor registration.");
    }
    const title = normalizeRequiredText(input.title, "title");
    const quantity = quotationKind === "vendor_agreement" ? 1 : parsePositiveNumber(input.quantity, "quantity");
    const unit = quotationKind === "vendor_agreement" ? "agreement" : normalizeRequiredText(input.unit, "unit");
    const targetPrice = parseOptionalCurrency(input.targetPrice, "targetPrice");
    const requestedMoq = parseOptionalInteger(input.requestedMoq, "requestedMoq");
    const requestNotes = normalizeOptionalText(input.requestNotes);
    const validityDate = parseValidityDate(input.validityDate);
    const adminSignatureData = normalizeAdminSignatureData(input.adminSignatureData ?? process.env.ADMIN_SIGNATURE_DATA_URL);
    const token = generateToken();
    const tokenHash = hashToken(token);
    const tokenTtlHours = Number(process.env.QUOTATION_TOKEN_TTL_HOURS || 168);
    const tokenExpiry = new Date(Date.now() + tokenTtlHours * 60 * 60 * 1000);
    const client = await marketplacePool.connect();
    try {
        await client.query("BEGIN");
        const vendorResult = await client.query(`
                SELECT
                    v.id,
                    v.company_name,
                    v.phone,
                    v.approval_status,
                    u.name AS vendor_name,
                    u.email AS vendor_email
                FROM vendors v
                JOIN users u ON u.id = v.user_id
                WHERE v.id = $1
            `, [input.vendorId]);
        if (!vendorResult.rows.length) {
            await client.query("ROLLBACK");
            throw new Error("Vendor not found.");
        }
        const vendor = vendorResult.rows[0];
        let productId = null;
        if (quotationKind === "vendor_agreement") {
            if (vendor.approval_status !== "pending") {
                await client.query("ROLLBACK");
                throw new Error("Agreement can only be sent once while the vendor is pending approval.");
            }
            const existingAgreement = await client.query(`
                    SELECT id
                    FROM vendor_quotations
                    WHERE vendor_id = $1
                      AND quotation_kind = 'vendor_agreement'
                    LIMIT 1
                `, [input.vendorId]);
            if (existingAgreement.rows.length) {
                await client.query("ROLLBACK");
                throw new Error("Agreement has already been sent for this vendor.");
            }
            if (input.vendorUpdates) {
                const vu = input.vendorUpdates;
                await client.query(`
                    UPDATE vendors
                    SET
                        company_name = COALESCE($1, company_name),
                        business_type = COALESCE($2, business_type),
                        gst_number = COALESCE($3, gst_number),
                        gst_certificate_link = COALESCE($4, gst_certificate_link),
                        company_website = COALESCE($5, company_website),
                        alternative_number = COALESCE($6, alternative_number),
                        designation = COALESCE($7, designation),
                        business_description = COALESCE($8, business_description),
                        credit_cycle = COALESCE($9, credit_cycle),
                        minimum_commision_percentage = COALESCE($10, minimum_commision_percentage),
                        maximum_commision_percentage = COALESCE($11, maximum_commision_percentage),
                        updated_at = NOW()
                    WHERE id = $12
                `, [
                    vu.companyName ?? null, vu.businessType ?? null, vu.gstNumber ?? null, vu.gstCertificateLink ?? null,
                    vu.companyWebsite ?? null, vu.alternativeNumber ?? null, vu.designation ?? null, vu.businessDescription ?? null,
                    vu.creditCycle ?? null, vu.minimumCommissionPercentage ?? null, vu.maximumCommissionPercentage ?? null,
                    input.vendorId
                ]);
                if (vu.vendorCategories && Array.isArray(vu.vendorCategories)) {
                    await client.query(`DELETE FROM vendor_categories WHERE vendor_id = $1`, [input.vendorId]);
                    for (const catCode of vu.vendorCategories) {
                        if (typeof catCode === 'string' && catCode.trim()) {
                            const catResult = await client.query(`SELECT id FROM product_category WHERE code = $1`, [catCode.trim()]);
                            if (catResult.rows.length > 0) {
                                await client.query(`
                                    INSERT INTO vendor_categories (vendor_id, category_id)
                                    VALUES ($1, $2) ON CONFLICT DO NOTHING
                                `, [input.vendorId, catResult.rows[0].id]);
                            }
                        }
                    }
                }
            }
        }
        else {
            productId = normalizeRequiredText(input.productId, "productId");
            const linkedProduct = await client.query(`
                    SELECT
                        p.id,
                        p.name,
                        vp.quotation_min_qty
                    FROM vendor_products vp
                    JOIN products p ON p.id = vp.product_id
                    JOIN vendors v ON v.id = vp.vendor_id
                    JOIN users u ON u.id = v.user_id
                    WHERE vp.product_id = $1
                      AND vp.vendor_id = $2
                      AND vp.is_active = TRUE
                      AND p.approval_status = 'approved'
                      AND p.is_active = TRUE
                      AND v.approval_status = 'approved'
                      AND v.is_active = TRUE
                      AND v.is_blocked = FALSE
                      AND u.is_active = TRUE
                    LIMIT 1
                `, [productId, input.vendorId]);
            if (!linkedProduct.rows.length) {
                await client.query("ROLLBACK");
                throw new Error("Selected vendor does not have an active listing for this product.");
            }
            const minimumQuotationQty = linkedProduct.rows[0].quotation_min_qty === null
                ? null
                : Number(linkedProduct.rows[0].quotation_min_qty);
            if (minimumQuotationQty !== null && quantity < minimumQuotationQty) {
                await client.query("ROLLBACK");
                throw new Error(`Quotation is only required for quantities of ${minimumQuotationQty} or higher for this vendor listing.`);
            }
        }
        let adminResult = await client.query(`SELECT id, name, email FROM users WHERE id = $1`, [input.createdByAdminId]);
        if (!adminResult.rows.length && input.createdByAdminEmail?.trim()) {
            adminResult = await client.query(`SELECT id, name, email FROM users WHERE LOWER(email::text) = LOWER($1)`, [input.createdByAdminEmail.trim()]);
        }
        if (!adminResult.rows.length) {
            await client.query("ROLLBACK");
            throw new Error("Admin user not found. Please log out and log in again.");
        }
        const resolvedAdmin = adminResult.rows[0];
        const quotationNumber = `VQ-${Date.now()}`;
        const inserted = await client.query(`
                INSERT INTO vendor_quotations (
                    quotation_number,
                    quotation_kind,
                    vendor_id,
                    product_id,
                    created_by_admin_id,
                    sent_to_email,
                    title,
                    quantity,
                    unit,
                    target_price,
                    requested_moq,
                    request_notes,
                    validity_date,
                    status,
                    admin_signature_data,
                    token_hash,
                    token_expires_at
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'sent', $14, $15, $16
                )
                RETURNING id
            `, [
            quotationNumber,
            quotationKind,
            input.vendorId,
            productId,
            resolvedAdmin.id,
            vendor.vendor_email,
            title,
            quantity,
            unit,
            targetPrice,
            requestedMoq,
            requestNotes,
            validityDate,
            adminSignatureData,
            tokenHash,
            tokenExpiry,
        ]);
        if (quotationKind === "vendor_agreement") {
            await client.query(`
                    UPDATE vendors
                    SET approval_status = 'agreement_sent', approval_notes = 'Agreement sent to vendor', updated_at = NOW()
                    WHERE id = $1
                `, [input.vendorId]);
        }
        await client.query("COMMIT");
        const quotation = await getVendorQuotationById(inserted.rows[0].id);
        if (!quotation) {
            throw new Error("Quotation could not be loaded after creation.");
        }
        const pdfBuffer = await generateVendorQuotationPdf(quotation);
        try {
            await sendQuotationEmail({ quotation, rawToken: token, pdfBuffer });
            await marketplacePool.query(`
                    UPDATE vendor_quotations
                    SET email_sent_at = NOW(), email_last_error = NULL, updated_at = NOW()
                    WHERE id = $1
                `, [quotation.id]);
        }
        catch (emailError) {
            const message = emailError instanceof Error ? emailError.message : "Failed to send quotation email.";
            await marketplacePool.query(`
                    UPDATE vendor_quotations
                    SET email_last_error = $2, updated_at = NOW()
                    WHERE id = $1
                `, [quotation.id, message]);
            throw emailError;
        }
        return {
            quotation: await getVendorQuotationById(quotation.id),
            vendorLink: getVendorQuotationAppUrl(token),
        };
    }
    catch (error) {
        try {
            await client.query("ROLLBACK");
        }
        catch {
            // ignore nested rollback failures
        }
        throw error;
    }
    finally {
        client.release();
    }
}
export async function markQuotationOpened(rawToken) {
    const quotation = await getVendorQuotationByToken(rawToken);
    if (!quotation) {
        return null;
    }
    if (new Date(quotation.token_expires_at).getTime() < Date.now()) {
        throw new Error("Quotation token has expired.");
    }
    if (quotation.status === "sent" && !quotation.vendor_opened_at) {
        await marketplacePool.query(`
                UPDATE vendor_quotations
                SET status = 'vendor_opened', vendor_opened_at = NOW(), updated_at = NOW()
                WHERE id = $1
            `, [quotation.id]);
    }
    else if (!quotation.vendor_opened_at) {
        await marketplacePool.query(`UPDATE vendor_quotations SET vendor_opened_at = NOW(), updated_at = NOW() WHERE id = $1`, [quotation.id]);
    }
    return getVendorQuotationById(quotation.id);
}
export async function submitVendorQuotationResponse(input) {
    const quotation = await getVendorQuotationByToken(input.rawToken);
    if (!quotation) {
        throw new Error("Quotation not found.");
    }
    if (new Date(quotation.token_expires_at).getTime() < Date.now()) {
        throw new Error("Quotation token has expired.");
    }
    if (["vendor_approved", "vendor_rejected", "admin_approved", "admin_rejected"].includes(quotation.status)) {
        throw new Error("Quotation response has already been submitted.");
    }
    const decision = normalizeRequiredText(input.decision, "decision").toLowerCase();
    if (decision !== "approved" && decision !== "rejected") {
        throw new Error("decision must be either approved or rejected.");
    }
    if (decision === "approved") {
        const vendorPrice = parseOptionalCurrency(input.vendorPrice, "vendorPrice");
        const vendorMoq = parseOptionalInteger(input.vendorMoq, "vendorMoq");
        const vendorNotes = normalizeOptionalText(input.vendorNotes);
        const vendorSignatureData = normalizeRequiredText(input.vendorSignatureData, "vendorSignatureData");
        dataUrlToBytes(vendorSignatureData);
        const nextStatus = quotation.quotation_kind === "vendor_agreement" ? "admin_approved" : "vendor_approved";
        const adminReviewUpdate = quotation.quotation_kind === "vendor_agreement" ? ", admin_reviewed_at = NOW(), admin_review_notes = 'Auto-approved by system upon vendor acceptance'" : "";
        await marketplacePool.query(`
                UPDATE vendor_quotations
                SET
                    status = $8,
                    vendor_price = $2,
                    vendor_moq = $3,
                    vendor_notes = $4,
                    vendor_signature_data = $5,
                    vendor_response_ip = $6,
                    vendor_response_user_agent = $7,
                    vendor_rejection_reason = NULL,
                    vendor_responded_at = NOW(),
                    vendor_opened_at = COALESCE(vendor_opened_at, NOW()),
                    updated_at = NOW()
                    ${adminReviewUpdate}
                WHERE id = $1
            `, [quotation.id, vendorPrice, vendorMoq, vendorNotes, vendorSignatureData, input.responseIp ?? null, input.responseUserAgent ?? null, nextStatus]);
        if (quotation.quotation_kind === "vendor_agreement") {
            // Automatically approve the vendor, mark them active and certified
            await marketplacePool.query(`
                    UPDATE vendors
                    SET
                        is_active = true,
                        is_approved = true,
                        approval_status = 'approved',
                        approval_notes = 'Approved automatically upon signing the vendor agreement',
                        updated_at = NOW()
                    WHERE id = $1
                `, [quotation.vendor_id]);
            // Ensure the associated user account is active as well
            await marketplacePool.query(`
                    UPDATE users
                    SET
                        is_active = true,
                        updated_at = NOW()
                    WHERE id = (SELECT user_id FROM vendors WHERE id = $1)
                `, [quotation.vendor_id]);
        }
    }
    else {
        const rejectionReason = normalizeRequiredText(input.rejectionReason, "rejectionReason");
        await marketplacePool.query(`
                UPDATE vendor_quotations
                SET
                    status = 'vendor_rejected',
                    vendor_rejection_reason = $2,
                    vendor_price = NULL,
                    vendor_moq = NULL,
                    vendor_notes = NULL,
                    vendor_signature_data = NULL,
                    vendor_response_ip = $3,
                    vendor_response_user_agent = $4,
                    vendor_responded_at = NOW(),
                    vendor_opened_at = COALESCE(vendor_opened_at, NOW()),
                    updated_at = NOW()
                WHERE id = $1
            `, [quotation.id, rejectionReason, input.responseIp ?? null, input.responseUserAgent ?? null]);
        if (quotation.quotation_kind === "vendor_agreement") {
            // Automatically set vendor status to rejected
            await marketplacePool.query(`
                    UPDATE vendors
                    SET
                        is_active = false,
                        is_approved = false,
                        approval_status = 'rejected',
                        approval_notes = $2,
                        updated_at = NOW()
                    WHERE id = $1
                `, [quotation.vendor_id, rejectionReason]);
            // Lock/deactivate user account associated with the rejected vendor
            await marketplacePool.query(`
                    UPDATE users
                    SET
                        is_active = false,
                        updated_at = NOW()
                    WHERE id = (SELECT user_id FROM vendors WHERE id = $1)
                `, [quotation.vendor_id]);
        }
    }
    const updated = await getVendorQuotationById(quotation.id);
    if (!updated) {
        throw new Error("Quotation not found after update.");
    }
    await sendAdminNotificationEmail(updated);
    return updated;
}
export async function reviewVendorQuotation(input) {
    const quotation = await getVendorQuotationById(input.quotationId);
    if (!quotation) {
        throw new Error("Quotation not found.");
    }
    if (!["vendor_approved", "vendor_rejected"].includes(quotation.status)) {
        throw new Error("Quotation is not ready for admin review.");
    }
    const decision = normalizeRequiredText(input.decision, "decision").toLowerCase();
    if (decision !== "approved" && decision !== "rejected") {
        throw new Error("decision must be either approved or rejected.");
    }
    const finalStatus = decision === "approved" ? "admin_approved" : "admin_rejected";
    const adminReviewNotes = normalizeOptionalText(input.adminReviewNotes);
    let reviewerResult = await marketplacePool.query(`SELECT id, email FROM users WHERE id = $1`, [input.reviewedByAdminId]);
    if (!reviewerResult.rows.length && input.reviewedByAdminEmail?.trim()) {
        reviewerResult = await marketplacePool.query(`SELECT id, email FROM users WHERE LOWER(email::text) = LOWER($1)`, [input.reviewedByAdminEmail.trim()]);
    }
    if (!reviewerResult.rows.length) {
        throw new Error("Reviewing admin user not found. Please log out and log in again.");
    }
    const resolvedReviewer = reviewerResult.rows[0];
    await marketplacePool.query(`
            UPDATE vendor_quotations
            SET
                status = $2,
                admin_review_notes = $3,
                admin_reviewed_at = NOW(),
                reviewed_by_admin_id = $4,
                updated_at = NOW()
            WHERE id = $1
        `, [input.quotationId, finalStatus, adminReviewNotes, resolvedReviewer.id]);
    if (quotation.quotation_kind === "vendor_agreement") {
        const vendorApprovalStatus = decision === "approved" ? "approved" : "rejected";
        const isApproved = decision === "approved";
        await marketplacePool.query(`
                UPDATE vendors
                SET
                    approval_status = $2,
                    approval_notes = $3,
                    is_active = $4,
                    is_blocked = $5,
                    updated_at = NOW()
                WHERE id = $1
            `, [
            quotation.vendor_id,
            vendorApprovalStatus,
            adminReviewNotes || (isApproved ? "Agreement approved by admin" : "Agreement rejected by admin"),
            isApproved,
            !isApproved,
        ]);
        await marketplacePool.query(`
                UPDATE users
                SET is_active = $2, updated_at = NOW()
                WHERE id = (
                    SELECT user_id
                    FROM vendors
                    WHERE id = $1
                )
            `, [quotation.vendor_id, isApproved]);
    }
    return getVendorQuotationById(input.quotationId);
}
//# sourceMappingURL=vendorQuotation.service.js.map