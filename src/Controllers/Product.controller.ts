import type { Request, Response } from "express";
import { marketplacePool } from "../lib/marketplace.js";

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

function normalizeCategory(category: unknown) {
    if (category === undefined) {
        return undefined;
    }

    if (typeof category !== "string" || !category.trim()) {
        throw new Error("Category must be a non-empty string.");
    }

    const normalized = category.trim().toLowerCase();
    if (normalized === "plastic" || normalized === "metal" || normalized === "steel") {
        return normalized;
    }

    throw new Error("Category must be either plastic, metal, or steel.");
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
        p.specifications,
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

    const { name, description, category, productType, specifications } = req.body;

    if (!name || !description || !category || !productType) {
        return res.status(400).json({ message: "Name, description, category, and productType are required." });
    }

    try {
        const parsedSpecifications = parseSpecifications(specifications ?? {});
        const normalizedCategory = normalizeCategory(category);

        const result = await marketplacePool.query(
            `
                INSERT INTO products (
                    name,
                    description,
                    category,
                    product_type,
                    specifications,
                    approval_status,
                    is_active
                )
                VALUES ($1, $2, $3, $4, $5::jsonb, 'approved', TRUE)
                RETURNING id
            `,
            [name.trim(), description.trim(), normalizedCategory, String(productType).trim(), JSON.stringify(parsedSpecifications)]
        );

        const product = await marketplacePool.query(
            `${productSelect} WHERE p.id = $1`,
            [result.rows[0].id]
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

        return res.status(200).json({ message: "Product fetched successfully", data: result.rows[0] });
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

    const { name, description, category, productType, specifications, is_active } = req.body;

    try {
        const existing = await marketplacePool.query(`SELECT id FROM products WHERE id = $1`, [productId]);
        if (!existing.rows.length) {
            return res.status(404).json({ message: "Product not found" });
        }

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
            values.push(normalizeCategory(category));
        }
        if (productType !== undefined) {
            updates.push(`product_type = $${index++}`);
            values.push(String(productType).trim());
        }
        if (specifications !== undefined) {
            updates.push(`specifications = $${index++}::jsonb`);
            values.push(JSON.stringify(parseSpecifications(specifications)));
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

    const { id } = req.params;
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

        const product = await marketplacePool.query(`${productSelect} WHERE p.id = $1`, [id]);
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
