import "dotenv/config";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { marketplacePool } from "../lib/marketplace.js";

export type VendorQuotationStatus =
    | "sent"
    | "vendor_opened"
    | "vendor_approved"
    | "vendor_rejected"
    | "admin_approved"
    | "admin_rejected";

export type VendorQuotationKind = "vendor_agreement" | "order_request";

type VendorQuotationRow = {
    id: string;
    quotation_number: string;
    quotation_kind: VendorQuotationKind;
    vendor_id: string;
    product_id: string | null;
    created_by_admin_id: string;
    sent_to_email: string;
    title: string;
    quantity: string | number;
    unit: string;
    target_price: string | number | null;
    requested_moq: number | null;
    request_notes: string | null;
    validity_date: string | Date | null;
    status: VendorQuotationStatus;
    vendor_price: string | number | null;
    vendor_moq: number | null;
    vendor_notes: string | null;
    admin_signature_data: string;
    vendor_signature_data: string | null;
    token_expires_at: string | Date;
    vendor_opened_at: string | Date | null;
    vendor_responded_at: string | Date | null;
    vendor_response_ip: string | null;
    vendor_response_user_agent: string | null;
    admin_reviewed_at: string | Date | null;
    reviewed_by_admin_id: string | null;
    admin_review_notes: string | null;
    vendor_rejection_reason: string | null;
    email_sent_at: string | Date | null;
    email_last_error: string | null;
    created_at: string | Date;
    updated_at: string | Date;
    vendor_name: string;
    vendor_email: string;
    vendor_phone: string | null;
    company_name: string;
    business_type?: string;
    gst_number?: string;
    company_website?: string;
    alternative_number?: string;
    designation?: string;
    business_description?: string;
    credit_cycle?: string;
    minimum_commision_percentage?: number | null;
    maximum_commision_percentage?: number | null;
    created_by_admin_name: string;
    created_by_admin_email: string;
};

type SendQuotationEmailInput = {
    quotation: VendorQuotationRow;
    rawToken: string;
    pdfBuffer: Buffer;
};

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

let cachedTransporter: nodemailer.Transporter | null = null;

function requireEnv(name: string) {
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

function buildVendorDocumentUrl(baseUrl: string, rawToken: string) {
    return `${baseUrl.replace(/\/$/, "")}?token=${encodeURIComponent(rawToken)}`;
}

function getVendorQuotationAppUrl(rawToken: string) {
    return buildVendorDocumentUrl(requireEnv("VENDOR_QUOTATION_APP_URL"), rawToken);
}

function getAdminQuotationAppUrl(quotationId: string) {
    const baseUrl = process.env.ADMIN_QUOTATION_APP_URL?.trim();
    if (!baseUrl) {
        return null;
    }

    return `${baseUrl.replace(/\/$/, "")}/${quotationId}`;
}

function hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function generateToken() {
    return crypto.randomBytes(32).toString("hex");
}

function parsePositiveNumber(value: unknown, field: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`${field} must be a positive number.`);
    }

    return parsed;
}

function parseOptionalCurrency(value: unknown, field: string) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`${field} must be a valid amount.`);
    }

    return parsed;
}

function parseOptionalInteger(value: unknown, field: string) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${field} must be a positive integer.`);
    }

    return parsed;
}

function normalizeRequiredText(value: unknown, field: string) {
    if (value === undefined || value === null) {
        throw new Error(`${field} is required.`);
    }

    const normalized = String(value).trim();
    if (!normalized) {
        throw new Error(`${field} is required.`);
    }

    return normalized;
}

function normalizeOptionalText(value: unknown) {
    if (value === undefined || value === null) {
        return null;
    }

    const normalized = String(value).trim();
    return normalized || null;
}

function parseValidityDate(value: unknown) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
        throw new Error("validityDate must be a valid ISO date string.");
    }

    return date;
}

function dataUrlToBytes(dataUrl: string) {
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

async function embedSignature(pdfDoc: PDFDocument, signatureDataUrl: string) {
    const { mimeType, bytes } = dataUrlToBytes(signatureDataUrl);
    if (mimeType === "image/png") {
        return pdfDoc.embedPng(bytes);
    }

    return pdfDoc.embedJpg(bytes);
}

function normalizeAdminSignatureData(value: unknown) {
    const normalized = normalizeOptionalText(value);
    if (!normalized || normalized.includes("REPLACE_WITH_ADMIN_SIGNATURE")) {
        return AUTO_SIGNATURE_MARKER;
    }

    try {
        dataUrlToBytes(normalized);
        return normalized;
    } catch {
        return AUTO_SIGNATURE_MARKER;
    }
}

function formatDate(value: string | Date | null) {
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

function formatDateTime(value: string | Date | null) {
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

function formatCurrency(value: string | number | null) {
    if (value === null || value === undefined || value === "") {
        return "Not specified";
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return String(value);
    }

    return `INR ${new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(numeric)}`;
}

function formatStatus(status: VendorQuotationStatus) {
    return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatKindLabel(kind: VendorQuotationKind) {
    return kind === "vendor_agreement" ? "Vendor Agreement" : "Order Quotation";
}

function sanitizePdfText(value: string) {
    return value
        .replace(/₹/g, "INR ")
        .replace(/[•]/g, "-")
        .replace(/[–—]/g, "-")
        .replace(/[“”]/g, "\"")
        .replace(/[‘’]/g, "'")
        .replace(/\u00a0/g, " ")
        .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function wrapText(text: string, maxWidth: number, font: any, size: number) {
    const safeText = sanitizePdfText(text);
    const words = safeText.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(candidate, size);
        if (width <= maxWidth) {
            currentLine = candidate;
            continue;
        }

        if (currentLine) {
            lines.push(currentLine);
        }
        currentLine = word;
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines;
}

function drawWrappedBlock(
    page: any,
    label: string,
    value: string,
    x: number,
    y: number,
    width: number,
    labelFont: any,
    valueFont: any
) {
    page.drawText(sanitizePdfText(label), { x, y, size: 11, font: labelFont, color: rgb(0.12, 0.12, 0.12) });
    const lines = wrapText(value, width, valueFont, 11);
    let nextY = y - 16;
    for (const line of lines) {
        page.drawText(sanitizePdfText(line), { x, y: nextY, size: 11, font: valueFont, color: rgb(0.2, 0.2, 0.2) });
        nextY -= 14;
    }

    return nextY - 8;
}

export async function getVendorQuotationById(quotationId: string) {
    const result = await marketplacePool.query(`${vendorQuotationSelect} WHERE q.id = $1`, [quotationId]);
    return (result.rows[0] as VendorQuotationRow | undefined) ?? null;
}

export async function getVendorQuotationByToken(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    const result = await marketplacePool.query(
        `${vendorQuotationSelect} WHERE q.token_hash = $1`,
        [tokenHash]
    );

    return (result.rows[0] as VendorQuotationRow | undefined) ?? null;
}

export async function listVendorQuotations() {
    const result = await marketplacePool.query(`${vendorQuotationSelect} ORDER BY q.created_at DESC`);
    return result.rows as VendorQuotationRow[];
}

export async function listVendorQuotationsForUser(userId: string, quotationKind?: VendorQuotationKind) {
    const values: Array<string> = [userId];
    let whereClause = `WHERE v.user_id = $1`;

    if (quotationKind) {
        values.push(quotationKind);
        whereClause += ` AND q.quotation_kind = $2`;
    }

    const result = await marketplacePool.query(
        `${vendorQuotationSelect} ${whereClause} ORDER BY q.created_at DESC`,
        values
    );

    return result.rows as VendorQuotationRow[];
}

export async function listVendorQuotationsForEmail(email: string, quotationKind?: VendorQuotationKind) {
    const values: Array<string> = [email.trim().toLowerCase()];
    let whereClause = `WHERE LOWER(vendor_user.email) = $1`;

    if (quotationKind) {
        values.push(quotationKind);
        whereClause += ` AND q.quotation_kind = $2`;
    }

    const result = await marketplacePool.query(
        `${vendorQuotationSelect} ${whereClause} ORDER BY q.created_at DESC`,
        values
    );

    return result.rows as VendorQuotationRow[];
}

export function serializeAdminQuotation(quotation: VendorQuotationRow) {
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
    };
}

export function serializePublicQuotation(quotation: VendorQuotationRow) {
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
    };
}

export async function generateVendorQuotationPdf(quotation: VendorQuotationRow): Promise<Buffer> {
    const isAgreement = quotation.quotation_kind === "vendor_agreement";
    const titleLabel = isAgreement ? "Vendor Agreement" : "Order Quotation";

    const companyName = "MTWO Groups";
    const companyAddress = "Plot No. 42, Bopodi Industrial Estate, Pune 411003";
    const logoUrl = "https://res.cloudinary.com/deudvpcgx/image/upload/v1779186769/favicon_somltc.jpg";

    const adminSigHtml = quotation.admin_signature_data === AUTO_SIGNATURE_MARKER
        ? `<div style="font-size: 10px; color: #4b5563;">Digitally prepared by</div><div style="font-weight: 700; color: #0f4c81; font-size: 14px;">${quotation.created_by_admin_name}</div>`
        : `<img src="${quotation.admin_signature_data}" style="max-height: 40px; max-width: 150px;" alt="Admin Signature" />`;

    const vendorSigHtml = quotation.vendor_signature_data
        ? `<img src="${quotation.vendor_signature_data}" style="max-height: 40px; max-width: 150px;" alt="Vendor Signature" />`
        : `<div style="font-size: 12px; color: #9ca3af; font-style: italic;">Pending Signature</div>`;

    let contentHtml = "";

    if (isAgreement) {
        const startDate = formatDate(new Date());
        contentHtml = `
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #0f4c81; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; margin: 0;">VENDOR AGREEMENT</h2>
                <div style="color: #6b7280; font-size: 14px; margin-top: 5px;">Reference: ${quotation.quotation_number} | Date: ${startDate}</div>
            </div>

            <div class="legal-section">
                <h3>1. Parties Involved</h3>
                <p>This Vendor Agreement is made between <strong>${companyName}</strong>, located at ${companyAddress}, and <strong>${quotation.company_name}</strong> (representing ${quotation.vendor_name}), located at the registered address provided during onboarding. Hereinafter referred to collectively as "the Parties".</p>
            </div>

            <div class="legal-section">
                <h3>2. Term of Agreement</h3>
                <p>The Agreement shall commence on <strong>${startDate}</strong> and shall remain in effect for a standard initial term unless terminated earlier in accordance with Section 8.</p>
            </div>

            <div class="legal-section">
                <h3>3. Scope of Work & Business Profile</h3>
                <p>The Vendor agrees to supply products or services matching the following approved profile:</p>
                <table class="data-table">
                    <tr><td width="30%"><strong>Business Type</strong></td><td>${quotation.business_type || 'Not specified'}</td></tr>
                    <tr><td><strong>Description</strong></td><td>${quotation.business_description || 'Not specified'}</td></tr>
                    <tr><td><strong>GST Number</strong></td><td>${quotation.gst_number || 'Not specified'}</td></tr>
                </table>
            </div>

            <div class="legal-section">
                <h3>4. Pricing and Payment Terms</h3>
                <p>Transactions will be processed based on the following agreed commercial terms:</p>
                <ul>
                    <li><strong>Commission Structure:</strong> ${quotation.minimum_commision_percentage ?? 0}% to ${quotation.maximum_commision_percentage ?? 0}% (depending on category)</li>
                    <li><strong>Credit Cycle:</strong> ${quotation.credit_cycle || 'Standard Platform Terms'}</li>
                </ul>
            </div>

            <div class="legal-section">
                <h3>5. Delivery and Logistics</h3>
                <p>Vendor agrees to fulfill orders in a timely manner. Where applicable, inventory must be delivered to ${companyName}'s warehouse located at ${companyAddress}. Delivery schedules will be mutually agreed upon in advance.</p>
            </div>

            <div class="legal-section">
                <h3>6. Product Standards and Returns</h3>
                <p>All products provided must meet the quality and compliance standards set out in the agreed specifications. ${companyName} reserves the right to return any items not meeting these standards within the platform's standard return period from the delivery date.</p>
            </div>

            <div class="legal-section">
                <h3>7. Confidentiality</h3>
                <p>Both Parties agree to maintain strict confidentiality with respect to proprietary information, customer data, and business strategies exchanged during the term of this Agreement.</p>
            </div>

            <div class="legal-section">
                <h3>8. Termination</h3>
                <p>This contract may be terminated by either party providing a 30-day written notice. Grounds for immediate termination include breach of contract, nonperformance, or illegal activity.</p>
            </div>

            <div class="legal-section">
                <h3>9. Liability and Insurance</h3>
                <p>The Vendor shall maintain adequate product liability and business insurance during the term of this Agreement. ${companyName} holds no liability for damages arising from defective products supplied by the Vendor.</p>
            </div>

            <div class="legal-section">
                <h3>10. Governing Law</h3>
                <p>This Agreement shall be governed by the laws of Pune, Maharashtra jurisdiction.</p>
            </div>
        `;
    } else {
        contentHtml = `
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #0f4c81; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; margin: 0;">ORDER QUOTATION</h2>
                <div style="color: #6b7280; font-size: 14px; margin-top: 5px;">Reference: ${quotation.quotation_number}</div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
                <div style="width: 48%;">
                    <div style="font-weight: bold; color: #0f4c81; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 10px;">Request Details</div>
                    <table style="width: 100%; font-size: 12px; line-height: 1.6;">
                        <tr><td style="color: #6b7280; width: 100px;">Title:</td><td style="font-weight: 500;">${quotation.title}</td></tr>
                        <tr><td style="color: #6b7280;">Quantity:</td><td style="font-weight: 500;">${quotation.quantity} ${quotation.unit}</td></tr>
                        <tr><td style="color: #6b7280;">Target Price:</td><td style="font-weight: 500;">${formatCurrency(quotation.target_price)}</td></tr>
                        <tr><td style="color: #6b7280;">Requested MOQ:</td><td style="font-weight: 500;">${quotation.requested_moq ?? 'Not specified'}</td></tr>
                    </table>
                </div>
                <div style="width: 48%;">
                    <div style="font-weight: bold; color: #0f4c81; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 10px;">Vendor Information</div>
                    <table style="width: 100%; font-size: 12px; line-height: 1.6;">
                        <tr><td style="color: #6b7280; width: 100px;">Company:</td><td style="font-weight: 500;">${quotation.company_name}</td></tr>
                        <tr><td style="color: #6b7280;">Contact:</td><td style="font-weight: 500;">${quotation.vendor_name}</td></tr>
                        <tr><td style="color: #6b7280;">Email:</td><td style="font-weight: 500;">${quotation.sent_to_email}</td></tr>
                        <tr><td style="color: #6b7280;">Status:</td><td style="font-weight: 500; color: #0f4c81;">${formatStatus(quotation.status)}</td></tr>
                    </table>
                </div>
            </div>

            <div style="margin-bottom: 30px;">
                <div style="font-weight: bold; color: #0f4c81; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 10px;">Admin Notes</div>
                <div style="background: #f9fafb; padding: 15px; border-radius: 6px; font-size: 13px; border: 1px solid #e5e7eb;">
                    ${quotation.request_notes || 'No specific notes provided.'}
                </div>
            </div>

            <div style="margin-bottom: 30px;">
                <div style="font-weight: bold; color: #0f4c81; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 10px;">Vendor Response</div>
                <table class="data-table">
                    <tr><td width="30%"><strong>Vendor Price</strong></td><td>${formatCurrency(quotation.vendor_price)}</td></tr>
                    <tr><td><strong>Vendor MOQ</strong></td><td>${quotation.vendor_moq ?? 'Not specified'}</td></tr>
                    <tr><td><strong>Responded At</strong></td><td>${formatDateTime(quotation.vendor_responded_at)}</td></tr>
                    <tr><td><strong>Vendor Notes</strong></td><td>${quotation.vendor_notes || 'No notes provided.'}</td></tr>
                    ${quotation.vendor_rejection_reason ? `<tr><td><strong>Rejection Reason</strong></td><td style="color: #ef4444;">${quotation.vendor_rejection_reason}</td></tr>` : ''}
                </table>
            </div>
        `;
    }

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 40px; font-size: 12px; line-height: 1.5; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f4c81; padding-bottom: 20px; margin-bottom: 30px; }
                .logo-container { display: flex; align-items: center; gap: 15px; }
                .logo { height: 50px; border-radius: 8px; }
                .company-info h1 { margin: 0; color: #0f4c81; font-size: 24px; letter-spacing: 0.5px; }
                .company-info p { margin: 2px 0 0 0; color: #6b7280; font-size: 11px; }
                .legal-section { margin-bottom: 20px; }
                .legal-section h3 { color: #0f4c81; font-size: 14px; margin: 0 0 8px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
                .legal-section p, .legal-section ul { margin: 0 0 10px 0; text-align: justify; }
                .legal-section li { margin-bottom: 4px; }
                .data-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                .data-table td { border: 1px solid #e5e7eb; padding: 8px 12px; }
                .data-table tr:nth-child(even) { background-color: #f9fafb; }
                .signatures { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 30px; border-top: 1px solid #e5e7eb; }
                .signature-box { width: 45%; }
                .signature-line { border-bottom: 1px solid #1f2937; margin-bottom: 5px; min-height: 40px; display: flex; align-items: flex-end; }
                .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 15px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo-container">
                    <img src="${logoUrl}" class="logo" alt="MTWO Groups Logo" />
                    <div class="company-info">
                        <h1>${companyName}</h1>
                        <p>${companyAddress}</p>
                    </div>
                </div>
            </div>

            ${contentHtml}

            <div class="legal-section">
                <h3>Signatures</h3>
                <div class="signatures">
                    <div class="signature-box">
                        <div style="font-weight: bold; margin-bottom: 10px;">For ${companyName}</div>
                        <div class="signature-line">${adminSigHtml}</div>
                        <div>Name: <strong>${quotation.created_by_admin_name}</strong></div>
                        <div style="font-size: 11px; color: #6b7280;">Date: ${formatDateTime(quotation.created_at)}</div>
                    </div>
                    <div class="signature-box">
                        <div style="font-weight: bold; margin-bottom: 10px;">For ${quotation.company_name}</div>
                        <div class="signature-line">${vendorSigHtml}</div>
                        <div>Name: <strong>${quotation.vendor_name}</strong></div>
                        <div style="font-size: 11px; color: #6b7280;">Date: ${formatDateTime(quotation.vendor_responded_at) || 'Pending'}</div>
                    </div>
                </div>
            </div>

            <div class="footer">
                Document Generated: ${formatDateTime(new Date())} | Ref: ${quotation.quotation_number}<br/>
                Audit Trail: Sent ${formatDateTime(quotation.email_sent_at)} | IP: ${quotation.vendor_response_ip || 'N/A'}
            </div>
        </body>
        </html>
    `;

    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "load" });

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "0", right: "0", bottom: "0", left: "0" },
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}

async function sendQuotationEmail({ quotation, rawToken, pdfBuffer }: SendQuotationEmailInput) {
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
            <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                <h2 style="margin-bottom: 8px;">New ${isAgreement ? "Vendor Agreement" : "Vendor Quotation Request"}</h2>
                <p>Hello ${quotation.vendor_name},</p>
                <p>${quotation.created_by_admin_name} has sent you a ${documentLabel} for <strong>${quotation.title}</strong>.</p>
                <p>
                    Quantity: <strong>${quotation.quantity} ${quotation.unit}</strong><br />
                    Target price: <strong>${formatCurrency(quotation.target_price)}</strong><br />
                    Requested MOQ: <strong>${quotation.requested_moq ?? "Not specified"}</strong><br />
                    Valid until: <strong>${formatDate(quotation.validity_date)}</strong>
                </p>
                <p>Please ${actionLabel}.</p>
                <p>
                    <a href="${vendorLink}" style="display: inline-block; padding: 10px 18px; background: #0f4c81; color: #ffffff; text-decoration: none; border-radius: 6px;">
                        Open Secure ${isAgreement ? "Agreement" : "Quotation"} Page
                    </a>
                </p>
                <p>This secure link expires on <strong>${formatDateTime(quotation.token_expires_at)}</strong>.</p>
            </div>
        `,
        attachments: [
            {
                filename: `${quotation.quotation_number}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
            },
        ],
    });
}

async function sendAdminNotificationEmail(quotation: VendorQuotationRow) {
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

export async function createAndSendVendorQuotation(input: {
    vendorId: string;
    quotationKind?: unknown;
    productId?: unknown;
    createdByAdminId: string;
    createdByAdminEmail?: string;
    title: unknown;
    quantity: unknown;
    unit: unknown;
    targetPrice: unknown;
    requestedMoq: unknown;
    requestNotes: unknown;
    validityDate: unknown;
    adminSignatureData?: unknown;
    vendorUpdates?: any;
}) {
    const quotationKind = (normalizeOptionalText(input.quotationKind) || "vendor_agreement").toLowerCase() as VendorQuotationKind;
    if (quotationKind !== "vendor_agreement" && quotationKind !== "order_request") {
        throw new Error("quotationKind must be either vendor_agreement or order_request.");
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

        const vendorResult = await client.query(
            `
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
            `,
            [input.vendorId]
        );

        if (!vendorResult.rows.length) {
            await client.query("ROLLBACK");
            throw new Error("Vendor not found.");
        }

        const vendor = vendorResult.rows[0] as {
            id: string;
            company_name: string;
            phone: string | null;
            approval_status: string;
            vendor_name: string;
            vendor_email: string;
        };

        let productId: string | null = null;
        if (quotationKind === "vendor_agreement") {
            if (vendor.approval_status !== "pending") {
                await client.query("ROLLBACK");
                throw new Error("Agreement can only be sent once while the vendor is pending approval.");
            }

            const existingAgreement = await client.query(
                `
                    SELECT id
                    FROM vendor_quotations
                    WHERE vendor_id = $1
                      AND quotation_kind = 'vendor_agreement'
                    LIMIT 1
                `,
                [input.vendorId]
            );

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
                            const catResult = await client.query(
                                `SELECT id FROM product_category WHERE code = $1`,
                                [catCode.trim()]
                            );
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
        } else {
            productId = normalizeRequiredText(input.productId, "productId");
            const linkedProduct = await client.query(
                `
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
                `,
                [productId, input.vendorId]
            );

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

        let adminResult = await client.query(
            `SELECT id, name, email FROM users WHERE id = $1`,
            [input.createdByAdminId]
        );

        if (!adminResult.rows.length && input.createdByAdminEmail?.trim()) {
            adminResult = await client.query(
                `SELECT id, name, email FROM users WHERE LOWER(email::text) = LOWER($1)`,
                [input.createdByAdminEmail.trim()]
            );
        }

        if (!adminResult.rows.length) {
            await client.query("ROLLBACK");
            throw new Error("Admin user not found. Please log out and log in again.");
        }

        const resolvedAdmin = adminResult.rows[0] as { id: string; name: string; email: string };

        const quotationNumber = `VQ-${Date.now()}`;
        const inserted = await client.query(
            `
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
            `,
            [
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
            ]
        );

        if (quotationKind === "vendor_agreement") {
            await client.query(
                `
                    UPDATE vendors
                    SET approval_status = 'agreement_sent', approval_notes = 'Agreement sent to vendor', updated_at = NOW()
                    WHERE id = $1
                `,
                [input.vendorId]
            );
        }

        await client.query("COMMIT");

        const quotation = await getVendorQuotationById(inserted.rows[0].id);
        if (!quotation) {
            throw new Error("Quotation could not be loaded after creation.");
        }

        const pdfBuffer = await generateVendorQuotationPdf(quotation);

        try {
            await sendQuotationEmail({ quotation, rawToken: token, pdfBuffer });
            await marketplacePool.query(
                `
                    UPDATE vendor_quotations
                    SET email_sent_at = NOW(), email_last_error = NULL, updated_at = NOW()
                    WHERE id = $1
                `,
                [quotation.id]
            );
        } catch (emailError) {
            const message = emailError instanceof Error ? emailError.message : "Failed to send quotation email.";
            await marketplacePool.query(
                `
                    UPDATE vendor_quotations
                    SET email_last_error = $2, updated_at = NOW()
                    WHERE id = $1
                `,
                [quotation.id, message]
            );
            throw emailError;
        }

        return {
            quotation: await getVendorQuotationById(quotation.id),
            vendorLink: getVendorQuotationAppUrl(token),
        };
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch {
            // ignore nested rollback failures
        }
        throw error;
    } finally {
        client.release();
    }
}

export async function markQuotationOpened(rawToken: string) {
    const quotation = await getVendorQuotationByToken(rawToken);
    if (!quotation) {
        return null;
    }

    if (new Date(quotation.token_expires_at).getTime() < Date.now()) {
        throw new Error("Quotation token has expired.");
    }

    if (quotation.status === "sent" && !quotation.vendor_opened_at) {
        await marketplacePool.query(
            `
                UPDATE vendor_quotations
                SET status = 'vendor_opened', vendor_opened_at = NOW(), updated_at = NOW()
                WHERE id = $1
            `,
            [quotation.id]
        );
    } else if (!quotation.vendor_opened_at) {
        await marketplacePool.query(
            `UPDATE vendor_quotations SET vendor_opened_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [quotation.id]
        );
    }

    return getVendorQuotationById(quotation.id);
}

export async function submitVendorQuotationResponse(input: {
    rawToken: string;
    decision: unknown;
    vendorPrice: unknown;
    vendorMoq: unknown;
    vendorNotes: unknown;
    vendorSignatureData: unknown;
    rejectionReason: unknown;
    responseIp?: string | null;
    responseUserAgent?: string | null;
}) {
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

        await marketplacePool.query(
            `
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
            `,
            [quotation.id, vendorPrice, vendorMoq, vendorNotes, vendorSignatureData, input.responseIp ?? null, input.responseUserAgent ?? null, nextStatus]
        );

        if (quotation.quotation_kind === "vendor_agreement") {
            // Automatically approve the vendor, mark them active and certified
            await marketplacePool.query(
                `
                    UPDATE vendors
                    SET
                        is_active = true,
                        is_approved = true,
                        approval_status = 'approved',
                        approval_notes = 'Approved automatically upon signing the vendor agreement',
                        updated_at = NOW()
                    WHERE id = $1
                `,
                [quotation.vendor_id]
            );
            // Ensure the associated user account is active as well
            await marketplacePool.query(
                `
                    UPDATE users
                    SET
                        is_active = true,
                        updated_at = NOW()
                    WHERE id = (SELECT user_id FROM vendors WHERE id = $1)
                `,
                [quotation.vendor_id]
            );
        }
    } else {
        const rejectionReason = normalizeRequiredText(input.rejectionReason, "rejectionReason");
        await marketplacePool.query(
            `
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
            `,
            [quotation.id, rejectionReason, input.responseIp ?? null, input.responseUserAgent ?? null]
        );

        if (quotation.quotation_kind === "vendor_agreement") {
            // Automatically set vendor status to rejected
            await marketplacePool.query(
                `
                    UPDATE vendors
                    SET
                        is_active = false,
                        is_approved = false,
                        approval_status = 'rejected',
                        approval_notes = $2,
                        updated_at = NOW()
                    WHERE id = $1
                `,
                [quotation.vendor_id, rejectionReason]
            );
            // Lock/deactivate user account associated with the rejected vendor
            await marketplacePool.query(
                `
                    UPDATE users
                    SET
                        is_active = false,
                        updated_at = NOW()
                    WHERE id = (SELECT user_id FROM vendors WHERE id = $1)
                `,
                [quotation.vendor_id]
            );
        }
    }

    const updated = await getVendorQuotationById(quotation.id);
    if (!updated) {
        throw new Error("Quotation not found after update.");
    }

    await sendAdminNotificationEmail(updated);
    return updated;
}

export async function reviewVendorQuotation(input: {
    quotationId: string;
    decision: unknown;
    adminReviewNotes: unknown;
    reviewedByAdminId: string;
    reviewedByAdminEmail?: string;
}) {
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

    let reviewerResult = await marketplacePool.query(
        `SELECT id, email FROM users WHERE id = $1`,
        [input.reviewedByAdminId]
    );

    if (!reviewerResult.rows.length && input.reviewedByAdminEmail?.trim()) {
        reviewerResult = await marketplacePool.query(
            `SELECT id, email FROM users WHERE LOWER(email::text) = LOWER($1)`,
            [input.reviewedByAdminEmail.trim()]
        );
    }

    if (!reviewerResult.rows.length) {
        throw new Error("Reviewing admin user not found. Please log out and log in again.");
    }

    const resolvedReviewer = reviewerResult.rows[0] as { id: string; email: string };

    await marketplacePool.query(
        `
            UPDATE vendor_quotations
            SET
                status = $2,
                admin_review_notes = $3,
                admin_reviewed_at = NOW(),
                reviewed_by_admin_id = $4,
                updated_at = NOW()
            WHERE id = $1
        `,
        [input.quotationId, finalStatus, adminReviewNotes, resolvedReviewer.id]
    );

    if (quotation.quotation_kind === "vendor_agreement") {
        const vendorApprovalStatus = decision === "approved" ? "approved" : "rejected";
        const isApproved = decision === "approved";

        await marketplacePool.query(
            `
                UPDATE vendors
                SET
                    approval_status = $2,
                    approval_notes = $3,
                    is_active = $4,
                    is_blocked = $5,
                    updated_at = NOW()
                WHERE id = $1
            `,
            [
                quotation.vendor_id,
                vendorApprovalStatus,
                adminReviewNotes || (isApproved ? "Agreement approved by admin" : "Agreement rejected by admin"),
                isApproved,
                !isApproved,
            ]
        );

        await marketplacePool.query(
            `
                UPDATE users
                SET is_active = $2, updated_at = NOW()
                WHERE id = (
                    SELECT user_id
                    FROM vendors
                    WHERE id = $1
                )
            `,
            [quotation.vendor_id, isApproved]
        );
    }

    return getVendorQuotationById(input.quotationId);
}
