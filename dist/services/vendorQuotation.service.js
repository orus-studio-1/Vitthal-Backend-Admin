import "dotenv/config";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { marketplacePool } from "../lib/marketplace.js";
const vendorQuotationSelect = `
    SELECT
        q.id,
        q.quotation_number,
        q.vendor_id,
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
function getVendorQuotationAppUrl(rawToken) {
    const baseUrl = requireEnv("VENDOR_QUOTATION_APP_URL");
    return `${baseUrl.replace(/\/$/, "")}?token=${encodeURIComponent(rawToken)}`;
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
async function embedSignature(pdfDoc, signatureDataUrl) {
    const { mimeType, bytes } = dataUrlToBytes(signatureDataUrl);
    if (mimeType === "image/png") {
        return pdfDoc.embedPng(bytes);
    }
    return pdfDoc.embedJpg(bytes);
}
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
    return `INR ${new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(numeric)}`;
}
function formatStatus(status) {
    return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
function sanitizePdfText(value) {
    return value
        .replace(/₹/g, "INR ")
        .replace(/[•]/g, "-")
        .replace(/[–—]/g, "-")
        .replace(/[“”]/g, "\"")
        .replace(/[‘’]/g, "'")
        .replace(/\u00a0/g, " ")
        .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}
function wrapText(text, maxWidth, font, size) {
    const safeText = sanitizePdfText(text);
    const words = safeText.split(/\s+/);
    const lines = [];
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
function drawWrappedBlock(page, label, value, x, y, width, labelFont, valueFont) {
    page.drawText(sanitizePdfText(label), { x, y, size: 11, font: labelFont, color: rgb(0.12, 0.12, 0.12) });
    const lines = wrapText(value, width, valueFont, 11);
    let nextY = y - 16;
    for (const line of lines) {
        page.drawText(sanitizePdfText(line), { x, y: nextY, size: 11, font: valueFont, color: rgb(0.2, 0.2, 0.2) });
        nextY -= 14;
    }
    return nextY - 8;
}
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
export function serializeAdminQuotation(quotation) {
    return {
        id: quotation.id,
        quotation_number: quotation.quotation_number,
        vendor_id: quotation.vendor_id,
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
export function serializePublicQuotation(quotation) {
    return {
        id: quotation.id,
        quotation_number: quotation.quotation_number,
        vendor_id: quotation.vendor_id,
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
        created_by_admin_name: quotation.created_by_admin_name,
        admin_reviewed_at: quotation.admin_reviewed_at,
        admin_review_notes: quotation.admin_review_notes,
    };
}
export async function generateVendorQuotationPdf(quotation) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    page.drawRectangle({ x: 0, y: height - 110, width, height: 110, color: rgb(0.08, 0.2, 0.35) });
    page.drawText("Vendor Quotation", {
        x: 40,
        y: height - 55,
        size: 24,
        font: boldFont,
        color: rgb(1, 1, 1),
    });
    page.drawText(sanitizePdfText(`Quotation No: ${quotation.quotation_number}`), {
        x: 40,
        y: height - 80,
        size: 12,
        font: regularFont,
        color: rgb(0.93, 0.96, 1),
    });
    let cursorY = height - 145;
    page.drawText(sanitizePdfText(`Status: ${formatStatus(quotation.status)}`), {
        x: 40,
        y: cursorY,
        size: 11,
        font: boldFont,
        color: rgb(0.12, 0.12, 0.12),
    });
    cursorY -= 24;
    cursorY = drawWrappedBlock(page, "Vendor", `${quotation.company_name} (${quotation.vendor_name})`, 40, cursorY, 240, boldFont, regularFont);
    cursorY = drawWrappedBlock(page, "Vendor Email", quotation.sent_to_email, 40, cursorY, 240, boldFont, regularFont);
    cursorY = drawWrappedBlock(page, "Prepared By", `${quotation.created_by_admin_name} (${quotation.created_by_admin_email})`, 320, height - 169, 235, boldFont, regularFont);
    drawWrappedBlock(page, "Validity Date", formatDate(quotation.validity_date), 320, height - 223, 235, boldFont, regularFont);
    cursorY -= 8;
    page.drawRectangle({ x: 40, y: cursorY - 155, width: width - 80, height: 150, borderColor: rgb(0.8, 0.84, 0.9), borderWidth: 1 });
    page.drawText("Quotation Request", { x: 52, y: cursorY - 20, size: 13, font: boldFont, color: rgb(0.08, 0.2, 0.35) });
    page.drawText(sanitizePdfText(`Title: ${quotation.title}`), { x: 52, y: cursorY - 42, size: 11, font: regularFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(sanitizePdfText(`Quantity: ${quotation.quantity} ${quotation.unit}`), { x: 52, y: cursorY - 62, size: 11, font: regularFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(sanitizePdfText(`Target Price: ${formatCurrency(quotation.target_price)}`), { x: 52, y: cursorY - 82, size: 11, font: regularFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(sanitizePdfText(`Requested MOQ: ${quotation.requested_moq ?? "Not specified"}`), { x: 52, y: cursorY - 102, size: 11, font: regularFont, color: rgb(0.2, 0.2, 0.2) });
    const requestLines = wrapText(quotation.request_notes || "No notes provided.", width - 104, regularFont, 10);
    page.drawText("Admin Notes:", { x: 52, y: cursorY - 124, size: 11, font: boldFont, color: rgb(0.12, 0.12, 0.12) });
    let notesY = cursorY - 140;
    for (const line of requestLines.slice(0, 3)) {
        page.drawText(sanitizePdfText(line), { x: 52, y: notesY, size: 10, font: regularFont, color: rgb(0.2, 0.2, 0.2) });
        notesY -= 12;
    }
    let responseY = cursorY - 190;
    page.drawRectangle({ x: 40, y: responseY - 125, width: width - 80, height: 120, borderColor: rgb(0.84, 0.88, 0.93), borderWidth: 1 });
    page.drawText("Vendor Response", { x: 52, y: responseY - 20, size: 13, font: boldFont, color: rgb(0.08, 0.2, 0.35) });
    page.drawText(sanitizePdfText(`Vendor Price: ${formatCurrency(quotation.vendor_price)}`), { x: 52, y: responseY - 42, size: 11, font: regularFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(sanitizePdfText(`Vendor MOQ: ${quotation.vendor_moq ?? "Not specified"}`), { x: 52, y: responseY - 62, size: 11, font: regularFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(sanitizePdfText(`Vendor Response At: ${formatDateTime(quotation.vendor_responded_at)}`), { x: 52, y: responseY - 82, size: 11, font: regularFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(sanitizePdfText(`Vendor Rejection Reason: ${quotation.vendor_rejection_reason || "Not rejected"}`), { x: 52, y: responseY - 102, size: 10, font: regularFont, color: rgb(0.2, 0.2, 0.2) });
    const vendorNotesLines = wrapText(quotation.vendor_notes || "No vendor notes provided.", width - 104, regularFont, 10);
    let vendorNotesY = responseY - 120;
    for (const line of vendorNotesLines.slice(0, 2)) {
        page.drawText(sanitizePdfText(line), { x: 52, y: vendorNotesY, size: 10, font: regularFont, color: rgb(0.2, 0.2, 0.2) });
        vendorNotesY -= 12;
    }
    page.drawText("Admin Signature", {
        x: 40,
        y: 124,
        size: 10,
        font: boldFont,
        color: rgb(0.12, 0.12, 0.12),
    });
    if (quotation.admin_signature_data === AUTO_SIGNATURE_MARKER) {
        page.drawText(`Digitally prepared by`, {
            x: 40,
            y: 94,
            size: 10,
            font: regularFont,
            color: rgb(0.2, 0.2, 0.2),
        });
        page.drawText(sanitizePdfText(quotation.created_by_admin_name), {
            x: 40,
            y: 80,
            size: 12,
            font: boldFont,
            color: rgb(0.08, 0.2, 0.35),
        });
    }
    else {
        const adminSignature = await embedSignature(pdfDoc, quotation.admin_signature_data);
        page.drawImage(adminSignature, { x: 40, y: 70, width: 120, height: 40 });
    }
    if (quotation.vendor_signature_data) {
        const vendorSignature = await embedSignature(pdfDoc, quotation.vendor_signature_data);
        page.drawText("Vendor Signature", {
            x: 220,
            y: 124,
            size: 10,
            font: boldFont,
            color: rgb(0.12, 0.12, 0.12),
        });
        page.drawImage(vendorSignature, { x: 220, y: 70, width: 120, height: 40 });
    }
    page.drawText(sanitizePdfText(`Audit: vendor email ${quotation.sent_to_email} | vendor opened ${formatDateTime(quotation.vendor_opened_at)} | admin reviewed ${formatDateTime(quotation.admin_reviewed_at)}`), {
        x: 40,
        y: 35,
        size: 8,
        font: regularFont,
        color: rgb(0.4, 0.4, 0.4),
    });
    if (quotation.vendor_response_ip || quotation.vendor_response_user_agent) {
        page.drawText(sanitizePdfText(`Vendor audit: IP ${quotation.vendor_response_ip || "n/a"} | UA ${quotation.vendor_response_user_agent || "n/a"}`), {
            x: 40,
            y: 23,
            size: 8,
            font: regularFont,
            color: rgb(0.4, 0.4, 0.4),
        });
    }
    return Buffer.from(await pdfDoc.save());
}
async function sendQuotationEmail({ quotation, rawToken, pdfBuffer }) {
    const transporter = getMailTransporter();
    const vendorLink = getVendorQuotationAppUrl(rawToken);
    await transporter.sendMail({
        from: getMailFrom(),
        to: quotation.sent_to_email,
        subject: `Quotation ${quotation.quotation_number} from ${quotation.created_by_admin_name}`,
        html: `
            <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                <h2 style="margin-bottom: 8px;">New Vendor Quotation Request</h2>
                <p>Hello ${quotation.vendor_name},</p>
                <p>${quotation.created_by_admin_name} has sent you a quotation request for <strong>${quotation.title}</strong>.</p>
                <p>
                    Quantity: <strong>${quotation.quantity} ${quotation.unit}</strong><br />
                    Target price: <strong>${formatCurrency(quotation.target_price)}</strong><br />
                    Requested MOQ: <strong>${quotation.requested_moq ?? "Not specified"}</strong><br />
                    Valid until: <strong>${formatDate(quotation.validity_date)}</strong>
                </p>
                <p>Please review the attached PDF, then open the secure quotation page below to update pricing, add your notes, sign, and submit.</p>
                <p>
                    <a href="${vendorLink}" style="display: inline-block; padding: 10px 18px; background: #0f4c81; color: #ffffff; text-decoration: none; border-radius: 6px;">
                        Open Secure Quotation Page
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
async function sendAdminNotificationEmail(quotation) {
    const transporter = getMailTransporter();
    const adminLink = getAdminQuotationAppUrl(quotation.id);
    const vendorSummary = quotation.status === "vendor_rejected"
        ? `The vendor rejected this quotation. Reason: ${quotation.vendor_rejection_reason || "Not provided"}.`
        : `The vendor submitted pricing ${formatCurrency(quotation.vendor_price)} with MOQ ${quotation.vendor_moq ?? "Not specified"}.`;
    await transporter.sendMail({
        from: getMailFrom(),
        to: quotation.created_by_admin_email,
        subject: `Vendor response for ${quotation.quotation_number}`,
        html: `
            <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
                <h2 style="margin-bottom: 8px;">Vendor Response Received</h2>
                <p>Hello ${quotation.created_by_admin_name},</p>
                <p>${quotation.company_name} has responded to quotation <strong>${quotation.quotation_number}</strong>.</p>
                <p>${vendorSummary}</p>
                ${adminLink ? `<p><a href="${adminLink}" style="display: inline-block; padding: 10px 18px; background: #0f4c81; color: #ffffff; text-decoration: none; border-radius: 6px;">Review Quotation</a></p>` : ""}
            </div>
        `,
    });
}
export async function createAndSendVendorQuotation(input) {
    const title = normalizeRequiredText(input.title, "title");
    const quantity = parsePositiveNumber(input.quantity, "quantity");
    const unit = normalizeRequiredText(input.unit, "unit");
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
                    vendor_id,
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
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'sent', $12, $13, $14
                )
                RETURNING id
            `, [
            quotationNumber,
            input.vendorId,
            resolvedAdmin.id,
            vendorResult.rows[0].vendor_email,
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
        throw new Error("Quotation not found.");
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
        await marketplacePool.query(`
                UPDATE vendor_quotations
                SET
                    status = 'vendor_approved',
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
                WHERE id = $1
            `, [quotation.id, vendorPrice, vendorMoq, vendorNotes, vendorSignatureData, input.responseIp ?? null, input.responseUserAgent ?? null]);
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
    return getVendorQuotationById(input.quotationId);
}
//# sourceMappingURL=vendorQuotation.service.js.map