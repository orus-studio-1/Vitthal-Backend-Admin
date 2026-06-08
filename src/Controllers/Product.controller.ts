import type { Request, Response } from "express";
import { marketplacePool } from "../lib/marketplace.js";
import { getPresignedUrlOrOriginal, s3Client, BUCKET_NAME } from "../services/s3.service.js";
import { createAndEmitNotification } from "../lib/notificationEmitter.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const adminRoles = ["admin", "super_admin"];
const reviewDecisions = ["approved", "rejected"] as const;

function ensureAdmin(req: Request, res: Response) {
    const { role } = (req as any).user ?? {};
    if (!adminRoles.includes(role)) {
        res.status(403).json({ message: "Unauthorized! Only admins can manage products." });
        return null;
    }

    return (req as any).user as { userId: string; role: string };
}

async function resolveCategoryId(categoryInput: string): Promise<string> {
    if (!categoryInput || typeof categoryInput !== "string") {
        throw new Error("Category must be a non-empty string.");
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(categoryInput)) {
        return categoryInput;
    }

    const codeQuery = await marketplacePool.query(
        `SELECT id FROM product_category WHERE LOWER(code) = LOWER($1) AND is_active = TRUE`,
        [categoryInput.trim()]
    );
    if (codeQuery.rows.length > 0) {
        return codeQuery.rows[0].id;
    }

    const labelQuery = await marketplacePool.query(
        `SELECT id FROM product_category WHERE LOWER(label) = LOWER($1) AND is_active = TRUE`,
        [categoryInput.trim()]
    );
    if (labelQuery.rows.length > 0) {
        return labelQuery.rows[0].id;
    }

    throw new Error(`Category "${categoryInput}" could not be resolved to a valid active product category.`);
}

function parseSpecifications(specifications: unknown) {
    if (specifications === undefined) {
        return undefined;
    }

    if (typeof specifications === "string") {
        return JSON.parse(specifications) as Record<string, unknown> | unknown[];
    }

    if (typeof specifications === "object" && specifications !== null) {
        return specifications as Record<string, unknown> | unknown[];
    }

    throw new Error("Specifications must be a JSON object, array, or valid JSON string.");
}

const productSelect = `
    SELECT
        p.id,
        p.name,
        p.description,
        p.category,
        p.product_type,
        p.item_code,
        p.specifications,
        p.attributes,
        p.attributes->>'material' AS material,
        p.attributes->>'grade' AS grade,
        p.attributes->>'application' AS application,
        p.attributes->>'standard' AS standard,
        p.approval_status,
        p.approval_notes,
        p.created_at,
        p.updated_at,
        p.created_by_user_id,
        p.is_active,
        CASE WHEN v.id IS NOT NULL THEN v.id ELSE NULL END AS created_by_vendor_id,
        creator.name AS creator_name,
        creator.email AS creator_email,
        CASE
            WHEN v.id IS NOT NULL THEN 'vendor'
            WHEN p.created_by_user_id IS NULL THEN 'admin'
            ELSE creator.role::text
        END AS creator_role,
        v.company_name AS creator_vendor_name,
        COALESCE(vp_stats.vendor_count, 0) AS vendor_count
    FROM products p
    LEFT JOIN users creator ON creator.id = p.created_by_user_id
    LEFT JOIN vendors v ON v.user_id = creator.id
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS vendor_count
        FROM vendor_products vp
        WHERE vp.product_id = p.id
    ) vp_stats ON true
`;

export const addProductController = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const { name, description, category, productType, specifications, itemCode, item_code, material, grade, application, standard, attributes } = req.body;
    const finalItemCode = itemCode || item_code || null;

    if (!name || !category || !productType) {
        return res.status(400).json({ message: "Name, category, and productType are required." });
    }

    try {
        const parsedSpecifications = parseSpecifications(specifications ?? {});
        const resolvedCategoryId = await resolveCategoryId(category);

        const attributesObj: Record<string, string> = {};
        if (attributes && typeof attributes === 'object') {
            Object.entries(attributes).forEach(([key, val]) => {
                attributesObj[key.trim()] = String(val).trim();
            });
        }
        if (material) attributesObj.material = String(material).trim();
        if (grade) attributesObj.grade = String(grade).trim();
        if (application) attributesObj.application = String(application).trim();
        if (standard) attributesObj.standard = String(standard).trim();

        const quotationLimit = req.body.quotationLimit || req.body.quotation_limit || null;
        const parsedQuotationLimit = quotationLimit ? Number(quotationLimit) : null;
        if (parsedQuotationLimit !== null && (isNaN(parsedQuotationLimit) || parsedQuotationLimit < 1)) {
            return res.status(400).json({ message: "Quotation limit must be a positive integer" });
        }

        const result = await marketplacePool.query(
            `
                INSERT INTO products (
                    name,
                    description,
                    category,
                    product_type,
                    specifications,
                    attributes,
                    approval_status,
                    is_active,
                    item_code,
                    quotation_limit,
                    created_by_user_id
                )
                VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'approved', TRUE, $7, $8, $9)
                RETURNING id
            `,
            [
                name.trim(),
                description ? description.trim() : null,
                resolvedCategoryId,
                String(productType).trim(),
                JSON.stringify(parsedSpecifications),
                JSON.stringify(attributesObj),
                finalItemCode,
                parsedQuotationLimit,
                authUser.userId
            ]
        );

        const productId = result.rows[0].id;

        // Insert specifications into dynamic specifications table
        if (parsedSpecifications) {
            const specEntries = Array.isArray(parsedSpecifications)
                ? parsedSpecifications
                : typeof parsedSpecifications === "object"
                    ? Object.entries(parsedSpecifications).map(([key, value]) => ({ key, value }))
                    : [];

            for (const spec of specEntries) {
                const specKey = String((spec as any).key ?? (spec as any).spec_key ?? "").trim();
                const specValue = String((spec as any).value ?? (spec as any).spec_value ?? "").trim();
                if (specKey) {
                    await marketplacePool.query(
                        `
                            INSERT INTO product_specification (
                                product_id,
                                spec_key,
                                spec_value,
                                approval_status,
                                created_by_user_id
                            )
                            VALUES ($1, $2, $3, 'approved', $4)
                        `,
                        [productId, specKey, specValue, authUser.userId]
                    );
                }
            }
        }

        const product = await marketplacePool.query(
            `${productSelect} WHERE p.id = $1`,
            [productId]
        );

        return res.status(201).json({ message: "Product created successfully", data: product.rows[0] });
    } catch (error) {
        console.error("Error while creating product:", error);
        return res.status(400).json({ message: error instanceof Error ? error.message : "Internal server error" });
    }
};

export const getAllProducts = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const result = await marketplacePool.query(
            `${productSelect} ORDER BY p.created_at DESC`
        );

        return res.status(200).json({ message: "Products fetched successfully", data: result.rows });
    } catch (error) {
        console.error("Error while fetching products:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getProductById = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const result = await marketplacePool.query(
            `${productSelect} WHERE p.id = $1`,
            [req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "Product not found" });
        }

        const product = result.rows[0];

        const specsResult = await marketplacePool.query(
            `SELECT id, spec_key, spec_value, approval_status, approval_notes, created_at, created_by_user_id
             FROM product_specification
             WHERE product_id = $1
             ORDER BY created_at ASC`,
            [req.params.id]
        );

        const imagesResult = await marketplacePool.query(
            `SELECT id, image_url, is_primary, display_order, approval_status, is_approved, created_by_user_id
             FROM products_images
             WHERE product_id = $1
             ORDER BY display_order ASC, created_at ASC`,
            [req.params.id]
        );

        product.detailed_specifications = specsResult.rows;
        
        for (const img of imagesResult.rows) {
            img.image_url = await getPresignedUrlOrOriginal(img.image_url);
        }
        product.detailed_images = imagesResult.rows;

        const vendorsResult = await marketplacePool.query(
            `SELECT vp.id, vp.price, vp.moq, vp.stock_quantity, vp.is_active, vp.status, vp.created_at, v.company_name, u.name AS vendor_name, u.email AS vendor_email
             FROM vendor_products vp
             JOIN vendors v ON vp.vendor_id = v.id
             JOIN users u ON v.user_id = u.id
             WHERE vp.product_id = $1
             ORDER BY vp.created_at ASC`,
            [req.params.id]
        );
        product.detailed_vendors = vendorsResult.rows;

        return res.status(200).json({ message: "Product fetched successfully", data: product });
    } catch (error) {
        console.error("Error while fetching product:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const updateProduct = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const productId = (req.params.id || req.body.productId) as string | undefined;
    if (!productId) {
        return res.status(400).json({ message: "Product ID is required." });
    }

    const { name, description, category, productType, specifications, is_active, itemCode, item_code, material, grade, application, standard, attributes } = req.body;
    const finalItemCode = itemCode !== undefined ? itemCode : item_code;

    try {
        const existing = await marketplacePool.query(`SELECT id, attributes FROM products WHERE id = $1`, [productId]);
        if (!existing.rows.length) {
            return res.status(404).json({ message: "Product not found" });
        }

        const existingAttributes = existing.rows[0]?.attributes || {};

        const updates: string[] = [];
        const values: unknown[] = [];
        let index = 1;

        if (name !== undefined) {
            updates.push(`name = $${index++}`);
            values.push(String(name).trim());
        }
        if (description !== undefined) {
            updates.push(`description = $${index++}`);
            values.push(String(description).trim());
        }
        if (category !== undefined) {
            updates.push(`category = $${index++}`);
            values.push(await resolveCategoryId(category));
        }
        if (productType !== undefined) {
            updates.push(`product_type = $${index++}`);
            values.push(String(productType).trim());
        }
        if (finalItemCode !== undefined) {
            updates.push(`item_code = $${index++}`);
            values.push(finalItemCode ? String(finalItemCode).trim() : null);
        }
        if (specifications !== undefined) {
            updates.push(`specifications = $${index++}::jsonb`);
            values.push(JSON.stringify(parseSpecifications(specifications)));
        }

        const newAttributes = { ...existingAttributes };
        let attributesUpdated = false;

        if (attributes && typeof attributes === 'object') {
            Object.entries(attributes).forEach(([key, val]) => {
                newAttributes[key.trim()] = String(val).trim();
            });
            attributesUpdated = true;
        }

        if (material !== undefined) {
            if (material === null || material === "") {
                delete newAttributes.material;
            } else {
                newAttributes.material = String(material).trim();
            }
            attributesUpdated = true;
        }
        if (grade !== undefined) {
            if (grade === null || grade === "") {
                delete newAttributes.grade;
            } else {
                newAttributes.grade = String(grade).trim();
            }
            attributesUpdated = true;
        }
        if (application !== undefined) {
            if (application === null || application === "") {
                delete newAttributes.application;
            } else {
                newAttributes.application = String(application).trim();
            }
            attributesUpdated = true;
        }
        if (standard !== undefined) {
            if (standard === null || standard === "") {
                delete newAttributes.standard;
            } else {
                newAttributes.standard = String(standard).trim();
            }
            attributesUpdated = true;
        }

        if (attributesUpdated) {
            updates.push(`attributes = $${index++}::jsonb`);
            values.push(JSON.stringify(newAttributes));
        }

        if (typeof is_active === "boolean") {
            updates.push(`is_active = $${index++}`);
            values.push(is_active);
        }

        if (!updates.length) {
            return res.status(400).json({ message: "No valid product fields were provided." });
        }

        updates.push(`updated_at = NOW()`);
        values.push(productId);

        await marketplacePool.query(
            `UPDATE products SET ${updates.join(", ")} WHERE id = $${index}`,
            values
        );

        const updated = await marketplacePool.query(`${productSelect} WHERE p.id = $1`, [productId]);
        return res.status(200).json({ message: "Product updated successfully", data: updated.rows[0] });
    } catch (error) {
        console.error("Error while updating product:", error);
        return res.status(400).json({ message: error instanceof Error ? error.message : "Internal server error" });
    }
};

export const reviewProduct = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const id = req.params.id as string;
    const { decision, notes } = req.body as { decision?: string; notes?: string };

    if (!decision || !reviewDecisions.includes(decision as (typeof reviewDecisions)[number])) {
        return res.status(400).json({ message: "Decision must be either approved or rejected." });
    }

    try {
        const result = await marketplacePool.query(
            `
                UPDATE products
                SET
                    approval_status = $1,
                    approval_notes = $2,
                    is_active = $3,
                    updated_at = NOW()
                WHERE id = $4
                RETURNING id
            `,
            [decision, notes?.trim() || null, decision === "approved", id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "Product not found" });
        }

        if (decision === "approved") {
            // Auto-approve all pending images
            await marketplacePool.query(
                `
                    UPDATE products_images
                    SET approval_status = 'approved', is_approved = true, reviewed_by_user_id = $1
                    WHERE product_id = $2 AND approval_status = 'pending'
                `,
                [authUser.userId, id]
            );

            // Auto-approve all pending specifications
            await marketplacePool.query(
                `
                    UPDATE product_specification
                    SET approval_status = 'approved', reviewed_by_user_id = $1, reviewed_at = NOW(), updated_at = NOW()
                    WHERE product_id = $2 AND approval_status = 'pending'
                `,
                [authUser.userId, id]
            );

            // Auto-approve all waiting vendor product mappings for this product
            await marketplacePool.query(
                `
                    UPDATE vendor_products
                    SET is_active = true, status = 'active', updated_at = NOW()
                    WHERE product_id = $1 AND status = 'waiting'
                `,
                [id]
            );
        } else if (decision === "rejected") {
            // Auto-reject all pending images
            await marketplacePool.query(
                `
                    UPDATE products_images
                    SET approval_status = 'rejected', is_approved = false, reviewed_by_user_id = $1
                    WHERE product_id = $2 AND approval_status = 'pending'
                `,
                [authUser.userId, id]
            );

            // Auto-reject all pending specifications
            await marketplacePool.query(
                `
                    UPDATE product_specification
                    SET approval_status = 'rejected', reviewed_by_user_id = $1, reviewed_at = NOW(), updated_at = NOW()
                    WHERE product_id = $2 AND approval_status = 'pending'
                `,
                [authUser.userId, id]
            );

            // Auto-reject and deactivate all waiting vendor product mappings for this product
            await marketplacePool.query(
                `
                    UPDATE vendor_products
                    SET is_active = false, status = 'inactive', updated_at = NOW()
                    WHERE product_id = $1 AND status = 'waiting'
                `,
                [id]
            );
        }

        // Synchronize products.specifications JSONB column with approved specs in product_specification table
        const approvedSpecs = await marketplacePool.query(
            `SELECT spec_key, spec_value FROM product_specification WHERE product_id = $1 AND approval_status = 'approved'`,
            [id]
        );
        const specsObj: Record<string, string> = {};
        for (const row of approvedSpecs.rows) {
            specsObj[row.spec_key] = row.spec_value;
        }
        await marketplacePool.query(
            `UPDATE products SET specifications = $1::jsonb, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(specsObj), id]
        );

        const product = await marketplacePool.query(`${productSelect} WHERE p.id = $1`, [id]);
        const productName = product.rows[0]?.name || "Unknown Product";

        // Notify the product creator (if vendor)
        const creatorUserId = product.rows[0]?.created_by_user_id;
        if (creatorUserId) {
            createAndEmitNotification({
                userId: creatorUserId,
                type: decision === "approved" ? "product_approved" : "product_rejected",
                title: decision === "approved" ? "Product Approved ✅" : "Product Rejected ❌",
                body: decision === "approved"
                    ? `Your product "${productName}" has been approved by the admin and is now live.`
                    : `Your product "${productName}" has been rejected by the admin.${notes ? ` Reason: ${notes}` : ""}`,
                referenceType: "product",
                referenceId: id,
            }).catch(() => {});
        }

        // Notify all vendors with waiting mappings for this product
        const affectedVendors = await marketplacePool.query(
            `SELECT DISTINCT u.id AS user_id FROM vendor_products vp
             JOIN vendors v ON vp.vendor_id = v.id
             JOIN users u ON v.user_id = u.id
             WHERE vp.product_id = $1 AND u.id != COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`,
            [id, creatorUserId]
        );
        for (const vendor of affectedVendors.rows) {
            createAndEmitNotification({
                userId: vendor.user_id,
                type: decision === "approved" ? "vendor_product_approved" : "vendor_product_rejected",
                title: decision === "approved" ? "Catalog Listing Activated ✅" : "Catalog Listing Deactivated",
                body: decision === "approved"
                    ? `Your listing for "${productName}" has been activated. It is now visible to customers.`
                    : `Your listing for "${productName}" has been deactivated.`,
                referenceType: "product",
                referenceId: id,
            }).catch(() => {});
        }

        return res.status(200).json({ message: `Product ${decision} successfully`, data: product.rows[0] });
    } catch (error) {
        console.error("Error while reviewing product:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const deleteProduct = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const productId = (req.params.id || req.body.productId) as string | undefined;
    if (!productId) {
        return res.status(400).json({ message: "Product ID is required." });
    }

    try {
        const result = await marketplacePool.query(`DELETE FROM products WHERE id = $1 RETURNING id`, [productId]);
        if (!result.rows.length) {
            return res.status(404).json({ message: "Product not found" });
        }

        return res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
        console.error("Error while deleting product:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const reviewProductImage = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const id = req.params.id as string;
    const { decision } = req.body as { decision?: string };

    if (!decision || !reviewDecisions.includes(decision as (typeof reviewDecisions)[number])) {
        return res.status(400).json({ message: "Decision must be either approved or rejected." });
    }

    try {
        const result = await marketplacePool.query(
            `
                UPDATE products_images
                SET
                    approval_status = $1,
                    is_approved = $2,
                    reviewed_by_user_id = $3
                WHERE id = $4
                RETURNING id, product_id, image_url, is_primary, approval_status, is_approved, created_by_user_id
            `,
            [decision, decision === "approved", authUser.userId, id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "Product image not found" });
        }

        // Notify the image creator
        const imgCreatorId = result.rows[0].created_by_user_id;
        if (imgCreatorId) {
            const prodResult = await marketplacePool.query(`SELECT name FROM products WHERE id = $1`, [result.rows[0].product_id]);
            const prodName = prodResult.rows[0]?.name || "a product";
            createAndEmitNotification({
                userId: imgCreatorId,
                type: decision === "approved" ? "image_approved" : "image_rejected",
                title: decision === "approved" ? "Image Approved ✅" : "Image Rejected ❌",
                body: decision === "approved"
                    ? `Your image for "${prodName}" has been approved.`
                    : `Your image for "${prodName}" has been rejected.`,
                referenceType: "product",
                referenceId: result.rows[0].product_id,
            }).catch(() => {});
        }

        return res.status(200).json({ message: `Product image ${decision} successfully`, data: result.rows[0] });
    } catch (error) {
        console.error("Error while reviewing product image:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const reviewProductSpecification = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const id = req.params.id as string;
    const { decision, notes } = req.body as { decision?: string; notes?: string };

    if (!decision || !reviewDecisions.includes(decision as (typeof reviewDecisions)[number])) {
        return res.status(400).json({ message: "Decision must be either approved or rejected." });
    }

    try {
        const result = await marketplacePool.query(
            `
                UPDATE product_specification
                SET
                    approval_status = $1,
                    approval_notes = $2,
                    reviewed_by_user_id = $3,
                    reviewed_at = NOW(),
                    updated_at = NOW()
                WHERE id = $4
                RETURNING id, product_id, spec_key, spec_value, approval_status, approval_notes
            `,
            [decision, notes?.trim() || null, authUser.userId, id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "Product specification not found" });
        }

        const spec = result.rows[0];
        const productId = spec.product_id;

        // Synchronize products.specifications JSONB column with approved specs in product_specification table
        const approvedSpecs = await marketplacePool.query(
            `SELECT spec_key, spec_value FROM product_specification WHERE product_id = $1 AND approval_status = 'approved'`,
            [productId]
        );
        const specsObj: Record<string, string> = {};
        for (const row of approvedSpecs.rows) {
            specsObj[row.spec_key] = row.spec_value;
        }
        await marketplacePool.query(
            `UPDATE products SET specifications = $1::jsonb, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(specsObj), productId]
        );

        return res.status(200).json({ message: `Product specification ${decision} successfully`, data: spec });
    } catch (error) {
        console.error("Error while reviewing product specification:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getPendingVendorProducts = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const query = `
            SELECT 
                vp.id AS vendor_product_id,
                vp.price,
                vp.moq,
                vp.stock_quantity,
                vp.status AS vendor_product_status,
                vp.is_active AS vendor_product_active,
                vp.created_at,
                p.id AS product_id,
                p.name AS product_name,
                p.description AS product_description,
                p.approval_status AS product_approval_status,
                v.id AS vendor_id,
                v.company_name AS vendor_company_name,
                u.name AS vendor_user_name,
                u.email AS vendor_user_email
            FROM vendor_products vp
            JOIN products p ON vp.product_id = p.id
            JOIN vendors v ON vp.vendor_id = v.id
            JOIN users u ON v.user_id = u.id
            WHERE vp.status = 'waiting' OR vp.is_active = false
            ORDER BY vp.created_at DESC
        `;
        const result = await marketplacePool.query(query);
        return res.status(200).json({ message: "Pending vendor catalog entries fetched successfully", data: result.rows });
    } catch (error) {
        console.error("Error fetching pending vendor products:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const reviewVendorProduct = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const id = req.params.id as string; // vendor_product id
    const { decision } = req.body as { decision?: 'approved' | 'rejected' };

    if (!decision || (decision !== 'approved' && decision !== 'rejected')) {
        return res.status(400).json({ message: "Decision must be approved or rejected." });
    }

    try {
        const isActive = decision === 'approved';
        const status = decision === 'approved' ? 'active' : 'inactive';

        const result = await marketplacePool.query(
            `
                UPDATE vendor_products
                SET
                    is_active = $1,
                    status = $2,
                    updated_at = NOW()
                WHERE id = $3
                RETURNING id, product_id, vendor_id, price, moq, stock_quantity, status, is_active
            `,
            [isActive, status, id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "Vendor product catalog entry not found." });
        }

        // Notify the vendor
        const vendorInfo = await marketplacePool.query(
            `SELECT u.id AS user_id, p.name AS product_name FROM vendor_products vp
             JOIN vendors v ON vp.vendor_id = v.id
             JOIN users u ON v.user_id = u.id
             JOIN products p ON vp.product_id = p.id
             WHERE vp.id = $1`,
            [id]
        );
        if (vendorInfo.rows.length) {
            const { user_id, product_name } = vendorInfo.rows[0];
            createAndEmitNotification({
                userId: user_id,
                type: decision === "approved" ? "vendor_product_approved" : "vendor_product_rejected",
                title: decision === "approved" ? "Catalog Listing Activated ✅" : "Catalog Listing Deactivated ❌",
                body: decision === "approved"
                    ? `Your listing for "${product_name}" has been approved and is now visible to customers.`
                    : `Your listing for "${product_name}" has been deactivated by the admin.`,
                referenceType: "product",
                referenceId: result.rows[0].product_id,
            }).catch(() => {});
        }

        return res.status(200).json({ message: `Vendor catalog entry ${decision} successfully`, data: result.rows[0] });
    } catch (error) {
        console.error("Error while reviewing vendor product:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const setProductPrimaryImage = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const { productId, imageId } = req.body;
    if (!productId || !imageId) {
        return res.status(400).json({ message: "Product ID and Image ID are required." });
    }

    try {
        // Verify image belongs to product
        const imgCheck = await marketplacePool.query(
            `SELECT id FROM products_images WHERE id = $1 AND product_id = $2`,
            [imageId, productId]
        );
        if (!imgCheck.rows.length) {
            return res.status(404).json({ message: "Image not found for this product." });
        }

        // Unset current primary images
        await marketplacePool.query(
            `UPDATE products_images SET is_primary = false WHERE product_id = $1`,
            [productId]
        );

        // Set target image as primary and make sure it is approved/active
        await marketplacePool.query(
            `UPDATE products_images SET is_primary = true, approval_status = 'approved', is_approved = true WHERE id = $1`,
            [imageId]
        );

        return res.status(200).json({ message: "Primary image updated successfully." });
    } catch (error) {
        console.error("Error setting primary image:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getCategories = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const result = await marketplacePool.query(
            `SELECT id, code, label, description, image, min_commision_percentage, max_commision_percentage, sort_order, is_active
             FROM product_category
             ORDER BY sort_order ASC, label ASC`
        );
        return res.status(200).json({ message: "Categories fetched successfully", data: result.rows });
    } catch (e) {
        console.error("Error while fetching categories: ", e);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

export const addCategoryController = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const { code, label, description, image, min_commision_percentage, max_commision_percentage, sort_order, is_active } = req.body;

    if (!code || !label || !image) {
        return res.status(400).json({ message: "Code, Label, and Image are required." });
    }

    try {
        const codeCheck = await marketplacePool.query(
            `SELECT id FROM product_category WHERE LOWER(code) = LOWER($1)`,
            [code.trim()]
        );
        if (codeCheck.rows.length > 0) {
            return res.status(400).json({ message: `Category with code "${code}" already exists.` });
        }

        const result = await marketplacePool.query(
            `
                INSERT INTO product_category (
                    code,
                    label,
                    description,
                    image,
                    min_commision_percentage,
                    max_commision_percentage,
                    sort_order,
                    is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id, code, label, description, image, min_commision_percentage, max_commision_percentage, sort_order, is_active
            `,
            [
                code.trim().toLowerCase(),
                label.trim(),
                description ? description.trim() : null,
                image.trim(),
                Number(min_commision_percentage) || 0,
                max_commision_percentage !== undefined ? Number(max_commision_percentage) : 10,
                Number(sort_order) || 0,
                is_active !== undefined ? Boolean(is_active) : true
            ]
        );

        return res.status(201).json({ message: "Category created successfully", data: result.rows[0] });
    } catch (error) {
        console.error("Error while creating category:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const updateCategoryController = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const { id } = req.params;
    const { code, label, description, image, min_commision_percentage, max_commision_percentage, sort_order, is_active } = req.body;

    try {
        const existing = await marketplacePool.query(
            `SELECT id FROM product_category WHERE id = $1`,
            [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ message: "Category not found." });
        }

        if (code) {
            const codeCheck = await marketplacePool.query(
                `SELECT id FROM product_category WHERE LOWER(code) = LOWER($1) AND id != $2`,
                [code.trim(), id]
            );
            if (codeCheck.rows.length > 0) {
                return res.status(400).json({ message: `Category with code "${code}" already exists.` });
            }
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        let index = 1;

        if (code !== undefined) {
            updates.push(`code = $${index++}`);
            values.push(code.trim().toLowerCase());
        }
        if (label !== undefined) {
            updates.push(`label = $${index++}`);
            values.push(label.trim());
        }
        if (description !== undefined) {
            updates.push(`description = $${index++}`);
            values.push(description ? description.trim() : null);
        }
        if (image !== undefined) {
            updates.push(`image = $${index++}`);
            values.push(image.trim());
        }
        if (min_commision_percentage !== undefined) {
            updates.push(`min_commision_percentage = $${index++}`);
            values.push(Number(min_commision_percentage));
        }
        if (max_commision_percentage !== undefined) {
            updates.push(`max_commision_percentage = $${index++}`);
            values.push(Number(max_commision_percentage));
        }
        if (sort_order !== undefined) {
            updates.push(`sort_order = $${index++}`);
            values.push(Number(sort_order));
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${index++}`);
            values.push(Boolean(is_active));
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: "No fields to update." });
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const query = `
            UPDATE product_category
            SET ${updates.join(", ")}
            WHERE id = $${index}
            RETURNING id, code, label, description, image, min_commision_percentage, max_commision_percentage, sort_order, is_active
        `;

        const result = await marketplacePool.query(query, values);
        return res.status(200).json({ message: "Category updated successfully", data: result.rows[0] });
    } catch (error) {
        console.error("Error while updating category:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const deleteCategoryController = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const { id } = req.params;

    try {
        const result = await marketplacePool.query(
            `DELETE FROM product_category WHERE id = $1 RETURNING id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Category not found." });
        }

        return res.status(200).json({ message: "Category deleted successfully" });
    } catch (error: any) {
        console.error("Error while deleting category:", error);
        if (error.code === '23503') { // Foreign key constraint violation
            return res.status(400).json({
                message: "Cannot delete this category because it has products associated with it. Please delete the products or deactivate the category instead."
            });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const uploadProductImagesController = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const { productId } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!productId) {
        return res.status(400).json({ message: "Product ID is required." });
    }

    if (!files || files.length === 0) {
        return res.status(400).json({ message: "No images provided." });
    }

    try {
        const productResult = await marketplacePool.query(
            `SELECT id FROM products WHERE id = $1`,
            [productId]
        );
        if (productResult.rows.length === 0) {
            return res.status(404).json({ message: "Product not found." });
        }

        const targetPrimaryIndex = req.body.primaryImageIndex !== undefined ? Number(req.body.primaryImageIndex) : -1;

        if (targetPrimaryIndex >= 0 && targetPrimaryIndex < files.length) {
            await marketplacePool.query(
                `UPDATE products_images SET is_primary = false WHERE product_id = $1`,
                [productId]
            );
        }

        // Check if product already has a primary image
        const existingImages = await marketplacePool.query(
            `SELECT id FROM products_images WHERE product_id = $1 AND is_primary = true`,
            [productId]
        );
        let hasPrimary = existingImages.rows.length > 0;

        const uploadedImages = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file) continue;
            const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
            const fileName = `products/${productId}/${Date.now()}_${originalName}`;

            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileName,
                Body: file.buffer,
                ContentType: file.mimetype,
            });

            await s3Client.send(command);

            let isPrimary = false;
            if (targetPrimaryIndex >= 0) {
                isPrimary = (i === targetPrimaryIndex);
            } else {
                isPrimary = !hasPrimary && i === 0;
                if (isPrimary) hasPrimary = true;
            }

            const fullUrl = `https://${BUCKET_NAME}.s3.${(process.env.AWS_REGION || "ap-south-1").trim()}.amazonaws.com/${fileName}`;
            const values = [productId, fullUrl, isPrimary, i, 'approved', true, authUser.userId];
            const insertQuery = `
                INSERT INTO products_images (product_id, image_url, is_primary, display_order, approval_status, is_approved, created_by_user_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;
            const result = await marketplacePool.query(insertQuery, values);
            uploadedImages.push(result.rows[0]);
        }

        return res.status(201).json({ message: "Images uploaded successfully", data: uploadedImages });
    } catch (error) {
        console.error("Error uploading product images:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

