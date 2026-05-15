import type { Request, Response } from "express";
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
                ORDER BY o.created_at DESC
                LIMIT 5
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

    try {
        const [ordersOverTime, topProducts, topVendors, statusDistribution] = await Promise.all([
            marketplacePool.query(
                `
                    SELECT
                        DATE(o.created_at)::text AS date,
                        COUNT(*)::int AS count,
                        COALESCE(SUM(o.total_amount), 0)::float AS revenue
                    FROM orders o
                    WHERE o.created_at >= NOW() - ($1::text || ' days')::interval
                    GROUP BY DATE(o.created_at)
                    ORDER BY DATE(o.created_at) ASC
                `,
                [safePeriod]
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
                    WHERE o.created_at >= NOW() - ($1::text || ' days')::interval
                    GROUP BY oi.product_id, p.name
                    ORDER BY order_count DESC, total_revenue DESC
                    LIMIT 10
                `,
                [safePeriod]
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
                    WHERE o.created_at >= NOW() - ($1::text || ' days')::interval
                    GROUP BY o.vendor_id, v.company_name
                    ORDER BY total_revenue DESC, order_count DESC
                    LIMIT 10
                `,
                [safePeriod]
            ),
            marketplacePool.query(
                `
                    SELECT status, COUNT(*)::int AS count
                    FROM orders
                    WHERE created_at >= NOW() - ($1::text || ' days')::interval
                    GROUP BY status
                `,
                [safePeriod]
            ),
        ]);

        const analytics = {
            period: `${safePeriod} days`,
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

export const getUserManagement = async (req: Request, res: Response): Promise<Response> => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res as Response;
    }

    try {
        const result = await marketplacePool.query(`
            SELECT id, name, email, role::text AS role, is_active, created_at
            FROM users
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
                        COALESCE(vendor_order_stats.total_revenue, 0)::float AS vendor_total_revenue
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
                    totalOrders: ordersResult.rows.length,
                    totalSpent,
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
