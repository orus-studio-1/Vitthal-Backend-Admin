import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { marketplacePool } from "../lib/marketplace.js";
import {
    getVendorAnalyticsData,
    getVendorDashboardData,
    getVendorIdByUserId,
} from "../services/vendorInsights.service.js";

const adminRoles = ["admin", "super_admin"];

function ensureAdmin(req: Request, res: Response) {
    const { role } = (req as any).user ?? {};
    if (!adminRoles.includes(role)) {
        res.status(403).json({ message: "Unauthorized! Only admins can access this area." });
        return null;
    }

    return (req as any).user as { userId: string; role: string };
}

export const getDashboardStats = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const [
            totalUsers,
            totalProducts,
            totalOrders,
            totalVendors,
            activeVendors,
            pendingVendors,
            pendingProducts,
            orderStats,
            recentOrders,
            orderDetails,
            monthlyRevenue,
        ] = await Promise.all([
            marketplacePool.query(`SELECT COUNT(*)::int AS count FROM users`),
            marketplacePool.query(`SELECT COUNT(*)::int AS count FROM products`),
            marketplacePool.query(`SELECT COUNT(*)::int AS count FROM orders`),
            marketplacePool.query(`SELECT COUNT(*)::int AS count FROM vendors`),
            marketplacePool.query(`SELECT COUNT(*)::int AS count FROM vendors WHERE is_active = TRUE AND approval_status = 'approved'`),
            marketplacePool.query(`SELECT COUNT(*)::int AS count FROM vendors WHERE approval_status = 'pending'`),
            marketplacePool.query(`SELECT COUNT(*)::int AS count FROM products WHERE approval_status = 'pending'`),
            marketplacePool.query(`SELECT status, COUNT(*)::int AS count FROM orders GROUP BY status`),
            marketplacePool.query(`
                SELECT
                    o.id,
                    COALESCE(o.customer_name, u.name) AS customer_name,
                    v.company_name AS vendor_name,
                    p.name AS product_name,
                    o.total_amount,
                    o.status,
                    o.source,
                    o.created_at,
                    o.updated_at
                FROM orders o
                LEFT JOIN users u ON u.id = o.user_id
                JOIN vendors v ON v.id = o.vendor_id
                LEFT JOIN LATERAL (
                    SELECT pr.name
                    FROM order_items oi
                    JOIN products pr ON pr.id = oi.product_id
                    WHERE oi.order_id = o.id
                    ORDER BY oi.created_at ASC
                    LIMIT 1
                ) p ON true
                WHERE NOT (o.status = 'pending' AND o.payment_status = 'pending' AND o.source IN ('client', 'quotation'))
                ORDER BY o.created_at DESC
                LIMIT 5
            `),
            marketplacePool.query(`
                SELECT
                    o.id,
                    COALESCE(o.customer_name, u.name) AS customer_name,
                    v.company_name AS vendor_name,
                    p.name AS product_name,
                    o.total_amount,
                    o.status,
                    o.source,
                    o.created_at,
                    o.updated_at
                FROM orders o
                LEFT JOIN users u ON u.id = o.user_id
                JOIN vendors v ON v.id = o.vendor_id
                LEFT JOIN LATERAL (
                    SELECT pr.name
                    FROM order_items oi
                    JOIN products pr ON pr.id = oi.product_id
                    WHERE oi.order_id = o.id
                    ORDER BY oi.created_at ASC
                    LIMIT 1
                ) p ON true
                WHERE NOT (o.status = 'pending' AND o.payment_status = 'pending' AND o.source IN ('client', 'quotation'))
                ORDER BY o.created_at DESC
                LIMIT 100
            `),
            marketplacePool.query(`
                SELECT COALESCE(SUM(total_amount), 0)::float AS revenue
                FROM orders
                WHERE status = 'delivered'
                  AND created_at >= DATE_TRUNC('month', NOW())
            `),
        ]);

        const stats = {
            totals: {
                users: totalUsers.rows[0].count,
                products: totalProducts.rows[0].count,
                orders: totalOrders.rows[0].count,
                vendors: totalVendors.rows[0].count,
                activeVendors: activeVendors.rows[0].count,
                pendingVendors: pendingVendors.rows[0].count,
                pendingProducts: pendingProducts.rows[0].count,
            },
            orderStats: orderStats.rows.reduce((acc, row) => {
                acc[row.status] = row.count;
                return acc;
            }, {} as Record<string, number>),
            recentOrders: recentOrders.rows,
            orderDetails: orderDetails.rows,
            monthlyRevenue: monthlyRevenue.rows[0].revenue,
        };

        return res.status(200).json({ message: "Dashboard stats retrieved successfully", data: stats });
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getAnalytics = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const period = Number(req.query.period || 30);
    const safePeriod = Number.isFinite(period) && period > 0 ? period : 30;
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : "";
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : "";
    const hasDateRange = Boolean(startDate && endDate);
    const dateFilter = hasDateRange
        ? "o.created_at >= $1::date AND o.created_at < ($2::date + INTERVAL '1 day')"
        : "o.created_at >= NOW() - ($1::text || ' days')::interval";
    const orderDateFilter = hasDateRange
        ? "created_at >= $1::date AND created_at < ($2::date + INTERVAL '1 day')"
        : "created_at >= NOW() - ($1::text || ' days')::interval";
    const analyticsValues: any[] = hasDateRange ? [startDate, endDate] : [safePeriod];

    try {
        const [
            ordersOverTime,
            topProducts,
            topVendors,
            statusDistribution,
            topCustomers,
            topCities,
            purchaseTimeOfDay,
            categoryDistribution
        ] = await Promise.all([
            marketplacePool.query(
                `
                    SELECT
                        DATE(o.created_at)::text AS date,
                        COUNT(*)::int AS count,
                        COALESCE(SUM(o.total_amount), 0)::float AS revenue
                    FROM orders o
                    WHERE ${dateFilter}
                    GROUP BY DATE(o.created_at)
                    ORDER BY DATE(o.created_at) ASC
                `,
                analyticsValues
            ),
            marketplacePool.query(
                `
                    SELECT
                        oi.product_id,
                        COUNT(*)::int AS order_count,
                        COALESCE(SUM(oi.quantity * oi.price), 0)::float AS total_revenue,
                        p.name
                    FROM order_items oi
                    JOIN orders o ON o.id = oi.order_id
                    JOIN products p ON p.id = oi.product_id
                    WHERE ${dateFilter}
                    GROUP BY oi.product_id, p.name
                    ORDER BY order_count DESC, total_revenue DESC
                    LIMIT 10
                `,
                analyticsValues
            ),
            marketplacePool.query(
                `
                    SELECT
                        o.vendor_id,
                        COUNT(*)::int AS order_count,
                        COALESCE(SUM(o.total_amount), 0)::float AS total_revenue,
                        v.company_name
                    FROM orders o
                    JOIN vendors v ON v.id = o.vendor_id
                    WHERE ${dateFilter}
                    GROUP BY o.vendor_id, v.company_name
                    ORDER BY total_revenue DESC, order_count DESC
                    LIMIT 10
                `,
                analyticsValues
            ),
            marketplacePool.query(
                `
                    SELECT status, COUNT(*)::int AS count
                    FROM orders
                    WHERE ${orderDateFilter}
                    GROUP BY status
                `,
                analyticsValues
            ),
            marketplacePool.query(
                `
                    SELECT
                        u.id AS user_id,
                        u.name,
                        u.email,
                        COUNT(o.id)::int AS order_count,
                        COALESCE(SUM(o.total_amount), 0)::float AS total_spent
                    FROM orders o
                    JOIN users u ON u.id = o.user_id
                    WHERE ${dateFilter}
                    GROUP BY u.id, u.name, u.email
                    ORDER BY total_spent DESC, order_count DESC
                    LIMIT 10
                `,
                analyticsValues
            ),
            marketplacePool.query(
                `
                    SELECT
                        COALESCE(NULLIF(o.city, ''), 'Unknown') AS city,
                        COUNT(o.id)::int AS order_count,
                        COALESCE(SUM(o.total_amount), 0)::float AS total_revenue
                    FROM orders o
                    WHERE ${dateFilter}
                    GROUP BY o.city
                    ORDER BY total_revenue DESC, order_count DESC
                    LIMIT 10
                `,
                analyticsValues
            ),
            marketplacePool.query(
                `
                    SELECT
                        EXTRACT(HOUR FROM o.created_at)::int AS hour_of_day,
                        COUNT(o.id)::int AS order_count,
                        COALESCE(SUM(o.total_amount), 0)::float AS total_revenue
                    FROM orders o
                    WHERE ${dateFilter}
                    GROUP BY EXTRACT(HOUR FROM o.created_at)
                    ORDER BY hour_of_day ASC
                `,
                analyticsValues
            ),
            marketplacePool.query(
                `
                    SELECT
                        p.category,
                        COUNT(DISTINCT o.id)::int AS order_count,
                        COALESCE(SUM(oi.quantity), 0)::int AS total_quantity,
                        COALESCE(SUM(oi.quantity * oi.price), 0)::float AS total_revenue
                    FROM order_items oi
                    JOIN orders o ON o.id = oi.order_id
                    JOIN products p ON p.id = oi.product_id
                    WHERE ${dateFilter}
                    GROUP BY p.category
                    ORDER BY total_revenue DESC, order_count DESC
                `,
                analyticsValues
            ),
        ]);

        const analytics = {
            period: hasDateRange ? `${startDate} to ${endDate}` : `${safePeriod} days`,
            ordersOverTime: ordersOverTime.rows,
            topProducts: topProducts.rows.map((row) => ({
                product_id: row.product_id,
                _count: { product_id: row.order_count },
                _sum: { total_amount: row.total_revenue },
                product: { id: row.product_id, name: row.name },
            })),
            topVendors: topVendors.rows.map((row) => ({
                vendor_id: row.vendor_id,
                _count: { vendor_id: row.order_count },
                _sum: { total_amount: row.total_revenue },
                vendor: { id: row.vendor_id, name: row.company_name },
            })),
            statusDistribution: statusDistribution.rows.reduce((acc, row) => {
                acc[row.status] = row.count;
                return acc;
            }, {} as Record<string, number>),
            topCustomers: topCustomers.rows,
            topCities: topCities.rows,
            purchaseTimeOfDay: purchaseTimeOfDay.rows,
            categoryDistribution: categoryDistribution.rows,
        };

        return res.status(200).json({ message: "Analytics data retrieved successfully", data: analytics });
    } catch (error) {
        console.error("Error fetching analytics:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getMyVendorAnalytics = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const vendorId = await getVendorIdByUserId(authUser.userId);
        if (!vendorId) {
            return res.status(404).json({ message: "Vendor profile not found for this user." });
        }

        const [dashboard, analytics] = await Promise.all([
            getVendorDashboardData(vendorId),
            getVendorAnalyticsData(vendorId, typeof req.query.timeframe === "string" ? req.query.timeframe : undefined),
        ]);

        return res.status(200).json({
            message: "Vendor analytics retrieved successfully",
            data: {
                vendorId,
                dashboard,
                analytics,
            },
        });
    } catch (error) {
        console.error("Error fetching current admin-linked vendor analytics:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const createDeliveryAgent = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const { name, email, password, contact_phone, vehicle_type, vehicle_number, fulfillment_center_id } = req.body;

    if (!name || !email || !password || !fulfillment_center_id) {
        return res.status(400).json({ message: "Name, email, password, and fulfillment center ID are required." });
    }

    const client = await marketplacePool.connect();
    try {
        await client.query("BEGIN");

        const normalizedEmail = String(email).trim().toLowerCase();

        // Check if email already exists
        const userCheck = await client.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
        if (userCheck.rows.length > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({ message: "Email is already registered." });
        }

        // Get Fulfillment Center code
        const fcCheck = await client.query("SELECT code FROM fulfillment_centers WHERE id = $1", [fulfillment_center_id]);
        if (fcCheck.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Fulfillment center not found." });
        }
        const fcCode = fcCheck.rows[0].code;

        // Create User
        const hashedPassword = await bcrypt.hash(password, 10);
        const userRes = await client.query(
            `INSERT INTO users (name, email, password_hash, role, is_active, is_verified)
             VALUES ($1, $2, $3, 'delivery_agent', TRUE, TRUE)
             RETURNING id`,
            [name.trim(), normalizedEmail, hashedPassword]
        );
        const riderUserId = userRes.rows[0].id;

        // Generate special rider code (e.g. RID-PUNE-01)
        const riderCountRes = await client.query(
            `SELECT COUNT(*) FROM delivery_agents WHERE fulfillment_center_id = $1`,
            [fulfillment_center_id]
        );
        const sequence = parseInt(riderCountRes.rows[0].count, 10) + 1;
        const specialRiderId = `RID-${fcCode}-${sequence.toString().padStart(3, "0")}`;

        // Insert delivery agent profile
        await client.query(
            `INSERT INTO delivery_agents (user_id, fulfillment_center_id, special_rider_id, contact_phone, vehicle_type, vehicle_number)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [riderUserId, fulfillment_center_id, specialRiderId, contact_phone, vehicle_type, vehicle_number]
        );

        await client.query("COMMIT");
        return res.status(201).json({
            message: "Delivery agent registered successfully",
            data: { specialRiderId, name, email: normalizedEmail }
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error creating delivery agent:", error);
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        client.release();
    }
};

export const getDeliveryAgents = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const result = await marketplacePool.query(`
            SELECT da.id, da.special_rider_id, da.contact_phone, da.vehicle_type, da.vehicle_number, 
                   da.status, da.is_online, da.created_at, u.name as rider_name, u.email as rider_email,
                   fc.name as center_name, fc.code as center_code
            FROM delivery_agents da
            JOIN users u ON da.user_id = u.id
            JOIN fulfillment_centers fc ON da.fulfillment_center_id = fc.id
            WHERE da.status != 'deleted'
            ORDER BY da.created_at DESC
        `);

        return res.status(200).json({
            message: "Delivery agents retrieved successfully",
            data: result.rows
        });
    } catch (error) {
        console.error("Error retrieving delivery agents:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getUserManagement = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const result = await marketplacePool.query(`
            SELECT id, name, email, role::text AS role, is_active, created_at
            FROM users
            WHERE role::text = 'client'
            ORDER BY created_at DESC
        `);

        const users = result.rows;
        const stats = {
            total: users.length,
            active: users.filter((user) => user.is_active).length,
            inactive: users.filter((user) => !user.is_active).length,
            byRole: users.reduce((acc, user) => {
                acc[user.role] = (acc[user.role] || 0) + 1;
                return acc;
            }, {} as Record<string, number>),
        };

        return res.status(200).json({ message: "User management data retrieved successfully", data: { users, stats } });
    } catch (error) {
        console.error("Error fetching user management data:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getUserDetails = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const userId = String(req.params.id ?? "");

        const [userResult, ordersResult] = await Promise.all([
            marketplacePool.query(
                `
                    SELECT
                        u.id,
                        u.name,
                        u.email,
                        u.role::text AS role,
                        u.is_active,
                        u.created_at,
                        u.updated_at,
                        a.address,
                        a.city,
                        a.state,
                        a.country,
                        a.pincode,
                        c.phone AS client_phone,
                        v.id AS vendor_id,
                        v.company_name,
                        v.gst_number,
                        v.phone AS vendor_phone,
                        v.approval_status,
                        v.approval_notes,
                        v.is_blocked,
                        COALESCE(vendor_order_stats.order_count, 0) AS vendor_order_count,
                        COALESCE(vendor_order_stats.total_revenue, 0)::float AS vendor_total_revenue,
                        COALESCE(customer_order_stats.order_count, 0) AS customer_order_count,
                        COALESCE(customer_order_stats.total_spent, 0)::float AS customer_total_spent
                    FROM users u
                    LEFT JOIN addresses a ON a.user_id = u.id
                    LEFT JOIN client c ON c.user_id = u.id
                    LEFT JOIN vendors v ON v.user_id = u.id
                    LEFT JOIN LATERAL (
                        SELECT
                            COUNT(*)::int AS order_count,
                            COALESCE(SUM(o.total_amount), 0) AS total_revenue
                        FROM orders o
                        WHERE o.vendor_id = v.id
                    ) vendor_order_stats ON true
                    LEFT JOIN LATERAL (
                        SELECT
                            COUNT(*)::int AS order_count,
                            COALESCE(SUM(o.total_amount), 0) AS total_spent
                        FROM orders o
                        WHERE o.user_id = u.id
                    ) customer_order_stats ON true
                    WHERE u.id = $1
                `,
                [userId]
            ),
            marketplacePool.query(
                `
                    SELECT
                        o.id,
                        o.status,
                        o.total_amount,
                        o.created_at,
                        o.order_reference,
                        v.company_name AS vendor_name
                    FROM orders o
                    LEFT JOIN vendors v ON v.id = o.vendor_id
                    WHERE o.user_id = $1
                    ORDER BY o.created_at DESC
                    LIMIT 5
                `,
                [userId]
            ),
        ]);

        if (!userResult.rows.length) {
            return res.status(404).json({ message: "User not found" });
        }

        const row = userResult.rows[0];
        const totalSpent = ordersResult.rows.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

        return res.status(200).json({
            message: "User details retrieved successfully",
            data: {
                user: {
                    id: row.id,
                    name: row.name,
                    email: row.email,
                    role: row.role,
                    is_active: row.is_active,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                },
                address: row.address ? {
                    address: row.address,
                    city: row.city,
                    state: row.state,
                    country: row.country,
                    pincode: row.pincode,
                } : null,
                clientProfile: row.client_phone ? {
                    phone: row.client_phone,
                } : null,
                vendorProfile: row.vendor_id ? {
                    id: row.vendor_id,
                    company_name: row.company_name,
                    gst_number: row.gst_number,
                    phone: row.vendor_phone,
                    approval_status: row.approval_status,
                    approval_notes: row.approval_notes,
                    is_blocked: row.is_blocked,
                    order_count: Number(row.vendor_order_count || 0),
                    total_revenue: Number(row.vendor_total_revenue || 0),
                } : null,
                customerStats: {
                    totalOrders: Number(row.customer_order_count || 0),
                    totalSpent: Number(row.customer_total_spent || 0),
                    lastOrderAt: ordersResult.rows[0]?.created_at ?? null,
                },
                recentOrders: ordersResult.rows.map((order) => ({
                    id: order.id,
                    status: order.status,
                    total_amount: Number(order.total_amount || 0),
                    created_at: order.created_at,
                    order_reference: order.order_reference,
                    vendor_name: order.vendor_name,
                })),
            },
        });
    } catch (error) {
        console.error("Error fetching user details:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const updateUserStatus = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const { is_active } = req.body as { is_active?: boolean };
    if (typeof is_active !== "boolean") {
        return res.status(400).json({ message: "is_active must be a boolean." });
    }

    try {
        const result = await marketplacePool.query(
            `
                UPDATE users
                SET is_active = $1, updated_at = NOW()
                WHERE id = $2
                RETURNING id, name, email, role::text AS role, is_active, created_at
            `,
            [is_active, req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({ message: "User status updated successfully", data: result.rows[0] });
    } catch (error) {
        console.error("Error updating user status:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getAllPayments = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const result = await marketplacePool.query(`
            SELECT
                p.id,
                p.user_id,
                p.amount,
                p.currency,
                p.status,
                p.payment_method,
                p.razorpay_order_id,
                p.razorpay_payment_id,
                p.razorpay_signature,
                p.order_ids,
                p.quotation_request_id,
                p.split_number,
                p.split_percentage,
                p.created_at,
                p.updated_at,
                u.name AS user_name,
                u.email AS user_email
            FROM payments p
            JOIN users u ON u.id = p.user_id
            ORDER BY p.created_at DESC
        `);

        return res.status(200).json({
            message: "Payments retrieved successfully",
            data: result.rows,
        });
    } catch (error) {
        console.error("Error fetching payments:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getRiderLiveDetails = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    const { riderId } = req.params;

    try {
        // 1. Fetch Rider details
        const riderRes = await marketplacePool.query(
            `SELECT da.id, da.special_rider_id, da.contact_phone, da.vehicle_type, da.vehicle_number, 
                    da.status, da.is_online, da.current_latitude, da.current_longitude, da.last_located_at,
                    u.name as rider_name, u.email as rider_email
             FROM delivery_agents da
             JOIN users u ON da.user_id = u.id
             WHERE da.id = $1`,
            [riderId]
        );

        if (riderRes.rows.length === 0) {
            return res.status(404).json({ message: "Rider not found." });
        }

        const rider = riderRes.rows[0];

        // 2. Fetch Active Drop-off Job
        const activeDeliveryRes = await marketplacePool.query(
            `SELECT o.id as order_id, o.order_reference, o.customer_name, o.customer_phone,
                    o.address_line, o.city, o.state, o.pincode, o.latitude as destination_lat, o.langitude as destination_lng,
                    (
                        SELECT json_agg(json_build_object('name', p.name, 'quantity', oi.quantity))
                        FROM order_items oi
                        JOIN products p ON oi.product_id = p.id
                        WHERE oi.order_id = o.id
                    ) as items
             FROM orders o
             JOIN order_fulfillment_tracking oft ON o.id = oft.order_id
             WHERE oft.delivery_agent_id = $1 
               AND oft.status = 'handed_over'
               AND NOT EXISTS (
                   SELECT 1 FROM order_fulfillment_tracking oft2 
                   WHERE oft2.order_id = o.id AND oft2.status = 'delivered'
               )
             LIMIT 1`,
            [riderId]
        );

        let activeJob = null;
        if (activeDeliveryRes.rows.length > 0) {
            const job = activeDeliveryRes.rows[0];
            activeJob = {
                type: 'delivery',
                order_id: job.order_id,
                order_reference: job.order_reference,
                destination_name: job.customer_name,
                destination_phone: job.customer_phone,
                destination_address: `${job.address_line || ''}, ${job.city || ''}, ${job.state || ''} - ${job.pincode || ''}`,
                destination_lat: job.destination_lat,
                destination_lng: job.destination_lng,
                items: job.items
            };
        } else {
            // 3. Fetch Active Pickup Job (if no active delivery job)
            const activePickupRes = await marketplacePool.query(
                `SELECT orp.id as stop_id, orp.order_id,
                        o.order_reference, o.customer_name,
                        v.company_name as vendor_name,
                        (SELECT phone FROM client WHERE user_id = v.user_id LIMIT 1) as vendor_phone,
                        a.address as vendor_address, a.city as vendor_city, 
                        a.state as vendor_state, a.pincode as vendor_pincode,
                        a.latitude as vendor_lat, a.longitude as vendor_lng,
                        (
                            SELECT json_agg(json_build_object('name', p.name, 'quantity', oi.quantity))
                            FROM order_items oi
                            JOIN products p ON oi.product_id = p.id
                            WHERE oi.order_id = orp.order_id
                        ) as items
                 FROM order_route_plan orp
                 JOIN orders o ON orp.order_id = o.id
                 JOIN vendors v ON o.vendor_id = v.id
                 LEFT JOIN addresses a ON a.user_id = v.user_id
                 WHERE orp.pickup_rider_id = $1 AND orp.status = 'pickup_assigned'
                 LIMIT 1`,
                [riderId]
            );
            if (activePickupRes.rows.length > 0) {
                const job = activePickupRes.rows[0];
                activeJob = {
                    type: 'pickup',
                    order_id: job.order_id,
                    order_reference: job.order_reference,
                    destination_name: job.vendor_name,
                    destination_phone: job.vendor_phone,
                    destination_address: `${job.vendor_address || ''}, ${job.vendor_city || ''}, ${job.vendor_state || ''} - ${job.vendor_pincode || ''}`,
                    destination_lat: job.vendor_lat,
                    destination_lng: job.vendor_lng,
                    items: job.items
                };
            }
        }

        return res.status(200).json({
            message: "Rider live details retrieved successfully",
            data: {
                rider,
                activeJob
            }
        });
    } catch (error) {
        console.error("Error retrieving rider live details:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
