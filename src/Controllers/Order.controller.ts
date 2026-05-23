import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { marketplacePool } from "../lib/marketplace.js";

const adminRoles = ["admin", "super_admin"];
const allowedStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;

function ensureAdmin(req: Request, res: Response) {
    const { role } = (req as any).user ?? {};
    if (!adminRoles.includes(role)) {
        res.status(403).json({ message: "Unauthorized! Only admins can manage orders." });
        return null;
    }

    return (req as any).user as { userId: string; role: string };
}

function normalizeStatus(status: string) {
    const normalized = status.trim().toLowerCase();
    const legacyStatusMap: Record<string, (typeof allowedStatuses)[number]> = {
        placed: "pending",
        payment_pending: "pending",
        payment_completed: "confirmed",
        processing: "confirmed",
        shipped: "shipped",
        delivered: "delivered",
        cancelled: "cancelled",
        refunded: "cancelled",
        pending: "pending",
        confirmed: "confirmed",
    };

    return legacyStatusMap[normalized];
}

const orderSelect = `
    SELECT
        o.id,
        COALESCE(o.customer_name, u.name) AS customer_name,
        COALESCE(o.customer_email, u.email) AS customer_email,
        COALESCE(o.customer_phone, c.phone) AS customer_phone,
        o.vendor_id,
        first_item.product_id,
        COALESCE(item_stats.total_quantity, 0) AS quantity,
        o.total_amount,
        o.status,
        o.source,
        o.order_reference,
        o.order_notes,
        CONCAT_WS(', ', o.address_line, o.city, o.state, o.country, o.pincode) AS delivery_address,
        o.created_at,
        o.updated_at,
        CASE
            WHEN item_stats.item_count > 1 THEN first_product.name || ' +' || (item_stats.item_count - 1)::text || ' more'
            ELSE first_product.name
        END AS product_name,
        v.company_name AS vendor_name,
        first_product.category,
        first_product.product_type
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN client c ON c.user_id = o.user_id
    JOIN vendors v ON v.id = o.vendor_id
    LEFT JOIN LATERAL (
        SELECT
            COUNT(*)::int AS item_count,
            SUM(oi.quantity)::int AS total_quantity
        FROM order_items oi
        WHERE oi.order_id = o.id
    ) item_stats ON true
    LEFT JOIN LATERAL (
        SELECT oi.product_id
        FROM order_items oi
        WHERE oi.order_id = o.id
        ORDER BY oi.created_at ASC
        LIMIT 1
    ) first_item ON true
    LEFT JOIN products first_product ON first_product.id = first_item.product_id
`;

async function ensureClientUser(client: any, customerName: string, customerEmail: string, customerPhone?: string) {
    const normalizedEmail = customerEmail.trim().toLowerCase();
    const existingUser = await client.query(
        `SELECT id, role FROM users WHERE email = $1`,
        [normalizedEmail]
    );

    let userId: string;
    if (!existingUser.rows.length) {
        const tempPasswordHash = await bcrypt.hash(`Client@${Date.now()}`, 10);
        const createdUser = await client.query(
            `
                INSERT INTO users (name, email, password_hash, role, is_active, is_verified)
                VALUES ($1, $2, $3, 'client', TRUE, TRUE)
                RETURNING id
            `,
            [customerName.trim(), normalizedEmail, tempPasswordHash]
        );
        userId = createdUser.rows[0].id;
    } else {
        const user = existingUser.rows[0];
        if (user.role !== "client") {
            throw new Error("The provided customer email already belongs to a non-client account.");
        }

        userId = user.id;
        await client.query(
            `UPDATE users SET name = $1, is_active = TRUE, updated_at = NOW() WHERE id = $2`,
            [customerName.trim(), userId]
        );
    }

    await client.query(
        `
            INSERT INTO client (user_id, phone)
            VALUES ($1, $2)
            ON CONFLICT (user_id)
            DO UPDATE SET phone = EXCLUDED.phone, updated_at = NOW()
        `,
        [userId, customerPhone?.trim() || null]
    );

    return userId;
}

export const createOrder = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const {
        customer_name,
        customer_email,
        customer_phone,
        vendor_id,
        product_id,
        quantity,
        total_amount,
        address_line,
        city,
        state,
        country,
        pincode,
        order_notes,
    } = req.body;

    if (!customer_name || !customer_email || !vendor_id || !product_id || !quantity || !total_amount || !address_line || !city || !state || !country || !pincode) {
        return res.status(400).json({ message: "Customer, vendor, product, quantity, amount, and full delivery address are required." });
    }

    const client = await marketplacePool.connect();
    try {
        await client.query("BEGIN");

        const vendorProductResult = await client.query(
            `
                SELECT
                    v.id,
                    vp.price,
                    vp.quotation_enabled,
                    vp.quotation_min_qty
                FROM vendor_products vp
                JOIN vendors v ON v.id = vp.vendor_id
                JOIN users u ON u.id = v.user_id
                JOIN products p ON p.id = vp.product_id
                WHERE vp.vendor_id = $1
                  AND vp.product_id = $2
                  AND vp.is_active = TRUE
                  AND v.approval_status = 'approved'
                  AND v.is_active = TRUE
                  AND v.is_blocked = FALSE
                  AND u.is_active = TRUE
                  AND p.approval_status = 'approved'
                  AND p.is_active = TRUE
            `,
            [vendor_id, product_id]
        );
        if (!vendorProductResult.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Selected vendor does not have an active approved listing for this product." });
        }

        const vendorProduct = vendorProductResult.rows[0] as {
            id: string;
            price: string | number;
            quotation_enabled: boolean;
            quotation_min_qty: number | null;
        };
        const quantityNumber = Number(quantity);
        const quotationMinQty = vendorProduct.quotation_min_qty === null ? null : Number(vendorProduct.quotation_min_qty);

        if (Boolean(vendorProduct.quotation_enabled) && quotationMinQty !== null && quantityNumber >= quotationMinQty) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                message: `This vendor requires a quotation for quantities of ${quotationMinQty} or more. Send a quotation request instead of placing the order directly.`,
            });
        }

        const userId = await ensureClientUser(client, customer_name, customer_email, customer_phone);

        const orderResult = await client.query(
            `
                INSERT INTO orders (
                    user_id,
                    vendor_id,
                    status,
                    payment_status,
                    total_amount,
                    address_line,
                    city,
                    state,
                    country,
                    pincode,
                    latitude,
                    langitude,
                    source,
                    order_reference,
                    order_notes,
                    customer_name,
                    customer_email,
                    customer_phone,
                    created_by_admin_id
                )
                VALUES (
                    $1, $2, 'pending', 'pending', $3, $4, $5, $6, $7, $8, '0', '0',
                    'admin', $9, $10, $11, $12, $13, $14
                )
                RETURNING id
            `,
            [
                userId,
                vendor_id,
                Number(total_amount),
                String(address_line).trim(),
                String(city).trim(),
                String(state).trim(),
                String(country).trim(),
                String(pincode).trim(),
                `ADMIN-${Date.now()}`,
                order_notes?.trim() || null,
                String(customer_name).trim(),
                String(customer_email).trim().toLowerCase(),
                customer_phone?.trim() || null,
                authUser.userId,
            ]
        );

        await client.query(
            `
                INSERT INTO order_items (order_id, product_id, vendor_id, quantity, price)
                VALUES ($1, $2, $3, $4, $5)
            `,
            [orderResult.rows[0].id, product_id, vendor_id, quantityNumber, Number(total_amount) / quantityNumber]
        );

        await client.query("COMMIT");

        const created = await marketplacePool.query(`${orderSelect} WHERE o.id = $1`, [orderResult.rows[0].id]);
        return res.status(201).json({ message: "Order created successfully", data: created.rows[0] });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error creating order:", error);
        return res.status(400).json({ message: error instanceof Error ? error.message : "Internal server error" });
    } finally {
        client.release();
    }
};

export const getOrderProductVendors = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const productId = String(req.params.productId ?? "");
    if (!productId) {
        return res.status(400).json({ message: "Product ID is required." });
    }

    try {
        const result = await marketplacePool.query(
            `
                SELECT
                    v.id,
                    v.company_name,
                    vp.price,
                    vp.moq,
                    vp.stock_quantity,
                    vp.quotation_enabled,
                    vp.quotation_min_qty
                FROM vendor_products vp
                JOIN vendors v ON v.id = vp.vendor_id
                JOIN users u ON u.id = v.user_id
                JOIN products p ON p.id = vp.product_id
                WHERE vp.product_id = $1
                  AND vp.is_active = TRUE
                  AND v.approval_status = 'approved'
                  AND v.is_active = TRUE
                  AND v.is_blocked = FALSE
                  AND u.is_active = TRUE
                  AND p.approval_status = 'approved'
                  AND p.is_active = TRUE
                ORDER BY v.company_name ASC
            `,
            [productId]
        );

        return res.status(200).json({
            message: "Product vendors retrieved successfully",
            data: result.rows,
        });
    } catch (error) {
        console.error("Error fetching product vendors:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getAllOrders = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const result = await marketplacePool.query(
            `${orderSelect} ORDER BY o.created_at DESC`
        );

        return res.status(200).json({ message: "Orders retrieved successfully", data: result.rows });
    } catch (error) {
        console.error("Error fetching orders:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getOrderById = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const result = await marketplacePool.query(
            `${orderSelect} WHERE o.id = $1`,
            [req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "Order not found" });
        }

        return res.status(200).json({ message: "Order retrieved successfully", data: result.rows[0] });
    } catch (error) {
        console.error("Error fetching order:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const updateOrderStatus = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const mappedStatus = typeof req.body.status === "string" ? normalizeStatus(req.body.status) : undefined;
    if (!mappedStatus) {
        return res.status(400).json({ message: "A valid order status is required." });
    }

    try {
        const result = await marketplacePool.query(
            `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
            [mappedStatus, req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "Order not found" });
        }

        const updated = await marketplacePool.query(`${orderSelect} WHERE o.id = $1`, [req.params.id]);
        return res.status(200).json({ message: "Order status updated successfully", data: updated.rows[0] });
    } catch (error) {
        console.error("Error updating order status:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const deleteOrder = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const result = await marketplacePool.query(`DELETE FROM orders WHERE id = $1 RETURNING id`, [req.params.id]);
        if (!result.rows.length) {
            return res.status(404).json({ message: "Order not found" });
        }

        return res.status(200).json({ message: "Order deleted successfully" });
    } catch (error) {
        console.error("Error deleting order:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getOrdersByStatus = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const rawStatus = typeof req.params.status === "string" ? req.params.status : "";
    const mappedStatus = normalizeStatus(rawStatus);
    if (!mappedStatus) {
        return res.status(400).json({ message: "Invalid order status." });
    }

    try {
        const result = await marketplacePool.query(
            `${orderSelect} WHERE o.status = $1 ORDER BY o.created_at DESC`,
            [mappedStatus]
        );

        return res.status(200).json({ message: "Orders retrieved successfully", data: result.rows });
    } catch (error) {
        console.error("Error fetching orders by status:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
