import { marketplacePool } from "../lib/marketplace.js";
const adminRoles = ["admin", "super_admin"];
function ensureAdmin(req, res) {
    const { role } = req.user ?? {};
    if (!adminRoles.includes(role)) {
        res.status(403).json({ message: "Unauthorized! Only admins can access this area." });
        return null;
    }
    return req.user;
}
export const getDashboardStats = async (req, res) => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res;
    }
    try {
        const [totalUsers, totalProducts, totalOrders, totalVendors, activeVendors, pendingVendors, pendingProducts, orderStats, recentOrders, monthlyRevenue,] = await Promise.all([
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
            }, {}),
            recentOrders: recentOrders.rows,
            monthlyRevenue: monthlyRevenue.rows[0].revenue,
        };
        return res.status(200).json({ message: "Dashboard stats retrieved successfully", data: stats });
    }
    catch (error) {
        console.error("Error fetching dashboard stats:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
export const getAnalytics = async (req, res) => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res;
    }
    const period = Number(req.query.period || 30);
    const safePeriod = Number.isFinite(period) && period > 0 ? period : 30;
    try {
        const [ordersOverTime, topProducts, topVendors, statusDistribution] = await Promise.all([
            marketplacePool.query(`
                    SELECT
                        DATE(o.created_at)::text AS date,
                        COUNT(*)::int AS count,
                        COALESCE(SUM(o.total_amount), 0)::float AS revenue
                    FROM orders o
                    WHERE o.created_at >= NOW() - ($1::text || ' days')::interval
                    GROUP BY DATE(o.created_at)
                    ORDER BY DATE(o.created_at) ASC
                `, [safePeriod]),
            marketplacePool.query(`
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
                `, [safePeriod]),
            marketplacePool.query(`
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
                `, [safePeriod]),
            marketplacePool.query(`
                    SELECT status, COUNT(*)::int AS count
                    FROM orders
                    WHERE created_at >= NOW() - ($1::text || ' days')::interval
                    GROUP BY status
                `, [safePeriod]),
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
            }, {}),
        };
        return res.status(200).json({ message: "Analytics data retrieved successfully", data: analytics });
    }
    catch (error) {
        console.error("Error fetching analytics:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
export const getUserManagement = async (req, res) => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res;
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
            }, {}),
        };
        return res.status(200).json({ message: "User management data retrieved successfully", data: { users, stats } });
    }
    catch (error) {
        console.error("Error fetching user management data:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
export const updateUserStatus = async (req, res) => {
    const authUser = ensureAdmin(req, res);
    if (!authUser) {
        return res;
    }
    const { is_active } = req.body;
    if (typeof is_active !== "boolean") {
        return res.status(400).json({ message: "is_active must be a boolean." });
    }
    try {
        const result = await marketplacePool.query(`
                UPDATE users
                SET is_active = $1, updated_at = NOW()
                WHERE id = $2
                RETURNING id, name, email, role::text AS role, is_active, created_at
            `, [is_active, req.params.id]);
        if (!result.rows.length) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(200).json({ message: "User status updated successfully", data: result.rows[0] });
    }
    catch (error) {
        console.error("Error updating user status:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
//# sourceMappingURL=Admin.controller.js.map