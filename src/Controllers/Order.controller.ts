import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { marketplacePool } from "../lib/marketplace.js";
import { getPresignedUrlOrOriginal } from "../services/s3.service.js";

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

const statusTrackingText: Record<(typeof allowedStatuses)[number], { title: string; note: string }> = {
    pending: {
        title: "Order placed",
        note: "Order was created and is waiting for confirmation.",
    },
    confirmed: {
        title: "Order confirmed",
        note: "Order was confirmed and vendor fulfillment can begin.",
    },
    shipped: {
        title: "Order shipped",
        note: "Order has left the vendor or fulfillment center.",
    },
    delivered: {
        title: "Order delivered",
        note: "Order was delivered to the customer location.",
    },
    cancelled: {
        title: "Order cancelled",
        note: "Order was cancelled before completion.",
    },
};

async function recordOrderTracking(client: any, orderId: string, status: (typeof allowedStatuses)[number], note?: string) {
    const tracking = statusTrackingText[status];
    const trackingNote = note?.trim() || tracking.note;

    await client.query(
        `
            INSERT INTO order_status_history (order_id, status, note)
            VALUES ($1, $2, $3)
        `,
        [orderId, status, trackingNote]
    );

    await client.query(
        `
            INSERT INTO order_fulfillment_tracking (order_id, status, note)
            VALUES ($1, $2, $3)
        `,
        [orderId, status, `${tracking.title}: ${trackingNote}`]
    );
}

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

        await client.query(
            `INSERT INTO vendor_payouts (order_id, vendor_id, status)
             VALUES ($1, $2, 'pending')
             ON CONFLICT (order_id) DO NOTHING`,
            [orderResult.rows[0].id, vendor_id]
        );

        await recordOrderTracking(client, orderResult.rows[0].id, "pending", "Admin created this order.");

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
            `${orderSelect} WHERE NOT (o.status = 'pending' AND o.payment_status = 'pending' AND o.source IN ('client', 'quotation')) ORDER BY o.created_at DESC`
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
        const query = `
            SELECT 
                o.id AS id,
                o.status,
                o.payment_status,
                o.total_amount,
                o.created_at,
                o.updated_at,
                o.address_line,
                o.city,
                o.state,
                o.country,
                o.pincode,
                o.order_reference,
                o.order_notes,
                COALESCE(o.customer_name, u.name) AS customer_name,
                COALESCE(o.customer_email, u.email) AS customer_email,
                COALESCE(o.customer_phone, c.phone) AS customer_phone,
                v.company_name AS vendor_name,
                v.id AS vendor_id,
                (
                    SELECT json_agg(
                        json_build_object(
                            'product_id', oi.product_id,
                            'product_name', p.name,
                            'product_description', p.description,
                            'image_url', (SELECT image_url FROM products_images pi WHERE pi.product_id = p.id AND pi.is_primary = true LIMIT 1),
                            'quantity', oi.quantity,
                            'price', oi.price
                        ) ORDER BY oi.created_at
                    )
                    FROM order_items oi
                    JOIN products p ON oi.product_id = p.id
                    WHERE oi.order_id = o.id
                ) AS items,
                (
                    SELECT json_agg(
                        json_build_object(
                            'id', osh.id,
                            'status', osh.status,
                            'note', osh.note,
                            'created_at', osh.created_at
                        ) ORDER BY osh.created_at ASC
                    )
                    FROM order_status_history osh
                    WHERE osh.order_id = o.id
                ) AS status_history,
                (
                    SELECT json_agg(
                        json_build_object(
                            'id', oft.id,
                            'status', oft.status,
                            'note', oft.note,
                            'created_at', oft.created_at,
                            'fulfillment_center_id', oft.fulfillment_center_id,
                            'fulfillment_center', fc.name,
                            'city', fc.city,
                            'state', fc.state,
                            'country', fc.country,
                            'pincode', fc.pincode
                        ) ORDER BY oft.created_at ASC
                    )
                    FROM order_fulfillment_tracking oft
                    LEFT JOIN fulfillment_centers fc ON fc.id = oft.fulfillment_center_id
                    WHERE oft.order_id = o.id
                ) AS fulfillment_tracking,
                                 (
                    SELECT json_build_object(
                        'lr_number', odd.lr_number,
                        'eway_bill_number', odd.eway_bill_number,
                        'transporter_name', odd.transporter_name,
                        'eway_bill_url', odd.eway_bill_url,
                        'delivery_challan_url', odd.delivery_challan_url,
                        'invoice_url', odd.invoice_url,
                        'lr_document_url', odd.lr_document_url,
                        'updated_at', odd.updated_at
                    )
                    FROM order_dispatch_details odd
                    WHERE odd.order_id = o.id
                    LIMIT 1
                ) AS dispatch_details
            FROM orders o
            LEFT JOIN users u ON u.id = o.user_id
            LEFT JOIN client c ON c.user_id = o.user_id
            JOIN vendors v ON v.id = o.vendor_id
            WHERE o.id = $1
              AND NOT (o.status = 'pending' AND o.payment_status = 'pending' AND o.source IN ('client', 'quotation'))
            LIMIT 1;
        `;
        const result = await marketplacePool.query(query, [req.params.id]);

        if (!result.rows.length) {
            return res.status(404).json({ message: "Order not found" });
        }

        const order = result.rows[0];

        if (order.dispatch_details) {
            const resolveDocument = async (url: string | null) =>
                url ? await getPresignedUrlOrOriginal(url) : null;

            order.dispatch_details.eway_bill_url =
                await resolveDocument(order.dispatch_details.eway_bill_url);

            order.dispatch_details.delivery_challan_url =
                await resolveDocument(order.dispatch_details.delivery_challan_url);

            order.dispatch_details.invoice_url =
                await resolveDocument(order.dispatch_details.invoice_url);

            order.dispatch_details.lr_document_url =
                await resolveDocument(order.dispatch_details.lr_document_url);
        }

        return res.status(200).json({ message: "Order retrieved successfully", data: order });
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
    const orderId = String(req.params.id ?? "");

    const client = await marketplacePool.connect();

    try {
        await client.query("BEGIN");

        const result = await client.query(
            `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
            [mappedStatus, orderId]
        );

        if (!result.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Order not found" });
        }

        const trackingNote = typeof req.body.note === "string" ? req.body.note : undefined;
        await recordOrderTracking(client, orderId, mappedStatus, trackingNote);

        if (mappedStatus === "delivered") {
            await client.query(
                `INSERT INTO vendor_payouts (order_id, vendor_id, status, delivered_at, due_date)
                 SELECT 
                     o.id,
                     o.vendor_id,
                     'pending',
                     NOW(),
                     NOW() + (
                         COALESCE(
                             CASE 
                                 WHEN LOWER(v.credit_cycle) LIKE '%immediate%' THEN 0
                                 WHEN substring(v.credit_cycle from '\\d+') IS NOT NULL THEN substring(v.credit_cycle from '\\d+')::integer
                                 ELSE 15
                             END, 
                             15
                         ) * INTERVAL '1 day'
                     )
                 FROM orders o
                 JOIN vendors v ON o.vendor_id = v.id
                 WHERE o.id = $1
                 ON CONFLICT (order_id) DO UPDATE SET
                     delivered_at = EXCLUDED.delivered_at,
                     due_date = EXCLUDED.due_date,
                     updated_at = NOW()`,
                [orderId]
            );
        }

        await client.query("COMMIT");

        const updated = await marketplacePool.query(`${orderSelect} WHERE o.id = $1`, [orderId]);
        return res.status(200).json({ message: "Order status updated successfully", data: updated.rows[0] });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error updating order status:", error);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
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

export const getAllPayouts = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const query = `
            SELECT 
                vp.id AS payout_id,
                vp.order_id,
                vp.vendor_id,
                vp.payout_percentage,
                vp.payout_amount,
                vp.status AS payout_status,
                vp.delivered_at,
                vp.due_date,
                vp.last_paid_at,
                vp.notes AS payout_notes,
                o.total_amount AS order_total_amount,
                o.status AS order_status,
                o.payment_status AS client_payment_status,
                COALESCE(o.customer_name, u.name) AS customer_name,
                v.company_name AS vendor_name,
                v.credit_cycle AS vendor_credit_cycle,
                -- Successful client payments total
                COALESCE((
                    SELECT SUM(p.amount)
                    FROM payments p
                    WHERE p.status = 'successful'
                      AND (
                          vp.order_id = ANY(p.order_ids) 
                          OR p.quotation_request_id = (SELECT id FROM quotation_requests WHERE order_id = vp.order_id LIMIT 1)
                      )
                ), 0) AS client_paid_amount,
                -- Successful client payments split percentage sum
                COALESCE((
                    SELECT SUM(p.split_percentage)
                    FROM payments p
                    WHERE p.status = 'successful'
                      AND (
                          vp.order_id = ANY(p.order_ids) 
                          OR p.quotation_request_id = (SELECT id FROM quotation_requests WHERE order_id = vp.order_id LIMIT 1)
                      )
                ), 0) AS client_paid_percentage
            FROM vendor_payouts vp
            JOIN orders o ON o.id = vp.order_id
            JOIN vendors v ON v.id = vp.vendor_id
            LEFT JOIN users u ON u.id = o.user_id
            WHERE o.status NOT IN ('pending', 'cancelled')
              AND (o.source = 'admin' OR o.payment_status = 'paid')
            ORDER BY vp.created_at DESC
        `;
        const result = await marketplacePool.query(query);
        return res.status(200).json({ message: "Vendor payouts retrieved successfully", data: result.rows });
    } catch (error) {
        console.error("Error fetching vendor payouts:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const updatePayout = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const { orderId } = req.params;
    const { payoutPercentage, notes } = req.body;

    if (payoutPercentage == null || payoutPercentage < 0 || payoutPercentage > 100) {
        return res.status(400).json({ message: "payoutPercentage must be between 0 and 100" });
    }

    const client = await marketplacePool.connect();

    try {
        await client.query("BEGIN");

        // Fetch payout and order total amount
        const payoutQ = await client.query(
            `SELECT vp.id, o.total_amount 
             FROM vendor_payouts vp 
             JOIN orders o ON o.id = vp.order_id 
             WHERE vp.order_id = $1`,
            [orderId]
        );

        if (payoutQ.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Payout record not found for this order" });
        }

        const payout = payoutQ.rows[0];
        const amount = (Number(payoutPercentage) / 100) * Number(payout.total_amount);

        let status = "pending";
        if (Number(payoutPercentage) >= 100) {
            status = "paid";
        } else if (Number(payoutPercentage) > 0) {
            status = "partially_paid";
        }

        const updateQ = await client.query(
            `UPDATE vendor_payouts 
             SET payout_percentage = $1,
                 payout_amount = $2,
                 status = $3,
                 notes = $4,
                 last_paid_at = NOW(),
                 updated_at = NOW()
             WHERE order_id = $5
             RETURNING *`,
            [payoutPercentage, amount, status, notes || null, orderId]
        );

        await client.query("COMMIT");
        return res.status(200).json({ message: "Payout updated successfully", data: updateQ.rows[0] });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error updating vendor payout:", error);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
};
