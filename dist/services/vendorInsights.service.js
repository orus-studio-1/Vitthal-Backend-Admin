import { marketplacePool } from "../lib/marketplace.js";
import { getPresignedUrlOrOriginal } from "./s3.service.js";
const vendorProfileSelect = `
    SELECT
        v.id,
        v.user_id,
        u.name,
        u.email,
        v.company_name,
        v.gst_number,
        v.gst_certificate_link,
        v.business_type,
        v.company_website,
        v.phone,
        v.alternative_number,
        v.designation,
        v.business_description,
        v.credit_cycle,
        v.minimum_commision_percentage,
        v.maximum_commision_percentage,
        a.address,
        a.city,
        a.state,
        a.country,
        a.pincode,
        v.approval_status,
        v.approval_notes,
        v.application_number,
        v.is_active,
        v.is_blocked,
        v.created_at,
        v.updated_at,
        COALESCE(order_stats.order_count, 0) AS order_count,
        COALESCE(
            (
                SELECT json_agg(json_build_object('id', pc.id, 'code', pc.code, 'label', pc.label))
                FROM vendor_categories vc
                JOIN product_category pc ON pc.id = vc.category_id
                WHERE vc.vendor_id = v.id
            ),
            '[]'::json
        ) AS categories
    FROM vendors v
    JOIN users u ON u.id = v.user_id
    LEFT JOIN addresses a ON a.user_id = v.user_id
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS order_count
        FROM orders o
        WHERE o.vendor_id = v.id
    ) order_stats ON true
`;
function parseNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
function parseInteger(value) {
    const parsed = parseInt(String(value ?? 0), 10);
    return Number.isFinite(parsed) ? parsed : 0;
}
export async function getVendorProfile(vendorId) {
    const result = await marketplacePool.query(`${vendorProfileSelect} WHERE v.id = $1`, [vendorId]);
    const vendor = result.rows[0] ?? null;
    if (vendor && vendor.gst_certificate_link) {
        vendor.gst_certificate_link = await getPresignedUrlOrOriginal(vendor.gst_certificate_link);
    }
    return vendor;
}
export async function getVendorIdByUserId(userId) {
    const result = await marketplacePool.query(`SELECT id FROM vendors WHERE user_id = $1`, [userId]);
    return result.rows[0]?.id ?? null;
}
export async function getVendorDashboardData(vendorId) {
    const [statsResult, revenueChartResult, recentOrdersResult, topProductsResult] = await Promise.all([
        marketplacePool.query(`
                SELECT
                    COALESCE(SUM(o.total_amount), 0) AS total_revenue,
                    COUNT(o.id) AS total_orders,
                    (
                        SELECT COUNT(*)
                        FROM vendor_products vp
                        WHERE vp.vendor_id = $1 AND vp.is_active = TRUE
                    ) AS active_products,
                    (
                        SELECT COUNT(DISTINCT o2.user_id)
                        FROM orders o2
                        WHERE o2.vendor_id = $1
                    ) AS total_customers
                FROM orders o
                WHERE o.vendor_id = $1
            `, [vendorId]),
        marketplacePool.query(`
                SELECT
                    DATE(o.created_at)::text AS day_date,
                    COALESCE(SUM(o.total_amount), 0) AS revenue
                FROM orders o
                WHERE o.vendor_id = $1
                  AND o.created_at >= NOW() - INTERVAL '6 days'
                GROUP BY DATE(o.created_at)
                ORDER BY DATE(o.created_at) ASC
            `, [vendorId]),
        marketplacePool.query(`
                SELECT
                    o.id AS order_id,
                    o.status,
                    o.total_amount,
                    o.created_at,
                    COALESCE(o.customer_name, u.name) AS customer_name,
                    (
                        SELECT p.name
                        FROM order_items oi
                        JOIN products p ON oi.product_id = p.id
                        WHERE oi.order_id = o.id
                        ORDER BY oi.created_at ASC
                        LIMIT 1
                    ) AS product_name
                FROM orders o
                LEFT JOIN users u ON o.user_id = u.id
                WHERE o.vendor_id = $1
                ORDER BY o.created_at DESC
                LIMIT 5
            `, [vendorId]),
        marketplacePool.query(`
                SELECT
                    p.name AS product_name,
                    SUM(oi.quantity) AS total_sales,
                    SUM(oi.quantity * oi.price) AS total_revenue
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.vendor_id = $1
                GROUP BY p.name
                ORDER BY total_sales DESC
                LIMIT 3
            `, [vendorId]),
    ]);
    const stats = statsResult.rows[0] ?? {};
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const chartLabels = [];
    const chartData = [];
    const revenueMap = new Map();
    for (const row of revenueChartResult.rows) {
        revenueMap.set(row.day_date, parseNumber(row.revenue));
    }
    for (let i = 6; i >= 0; i -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        chartLabels.push(dayNames[date.getDay()]);
        chartData.push(revenueMap.get(dateStr) ?? 0);
    }
    return {
        stats: {
            totalRevenue: parseNumber(stats.total_revenue),
            totalOrders: parseInteger(stats.total_orders),
            activeProducts: parseInteger(stats.active_products),
            totalCustomers: parseInteger(stats.total_customers),
        },
        revenueChart: {
            labels: chartLabels,
            data: chartData,
        },
        recentOrders: recentOrdersResult.rows.map((row) => ({
            orderId: row.order_id,
            customerName: row.customer_name,
            productName: row.product_name || "N/A",
            date: row.created_at,
            amount: parseNumber(row.total_amount),
            status: row.status,
        })),
        topProducts: topProductsResult.rows.map((row) => ({
            name: row.product_name,
            sales: parseInteger(row.total_sales),
            revenue: parseNumber(row.total_revenue),
        })),
    };
}
export async function getVendorAnalyticsData(vendorId, rawTimeframe) {
    const timeframe = rawTimeframe === "month" || rawTimeframe === "6months" || rawTimeframe === "year"
        ? rawTimeframe
        : "year";
    let dateFilter = "";
    let previousDateFilter = "";
    const now = new Date();
    if (timeframe === "month") {
        dateFilter = `AND o.created_at >= DATE_TRUNC('month', NOW())`;
        previousDateFilter = `AND o.created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month') AND o.created_at < DATE_TRUNC('month', NOW())`;
    }
    else if (timeframe === "6months") {
        dateFilter = `AND o.created_at >= NOW() - INTERVAL '6 months'`;
        previousDateFilter = `AND o.created_at >= NOW() - INTERVAL '12 months' AND o.created_at < NOW() - INTERVAL '6 months'`;
    }
    else {
        dateFilter = `AND o.created_at >= DATE_TRUNC('year', NOW())`;
        previousDateFilter = `AND o.created_at >= DATE_TRUNC('year', NOW() - INTERVAL '1 year') AND o.created_at < DATE_TRUNC('year', NOW())`;
    }
    const [tonnageResult, prevTonnageResult, aovResult, prevAovResult, categoryResult, monthlyResult, topProductsResult] = await Promise.all([
        marketplacePool.query(`
                SELECT COALESCE(SUM(oi.quantity), 0) AS total_quantity
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE oi.vendor_id = $1 ${dateFilter}
            `, [vendorId]),
        marketplacePool.query(`
                SELECT COALESCE(SUM(oi.quantity), 0) AS total_quantity
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE oi.vendor_id = $1 ${previousDateFilter}
            `, [vendorId]),
        marketplacePool.query(`
                SELECT
                    COALESCE(AVG(o.total_amount), 0) AS avg_order_value,
                    COUNT(o.id) AS order_count,
                    COALESCE(SUM(o.total_amount), 0) AS total_revenue
                FROM orders o
                WHERE o.vendor_id = $1 ${dateFilter}
            `, [vendorId]),
        marketplacePool.query(`
                SELECT
                    COALESCE(AVG(o.total_amount), 0) AS avg_order_value,
                    COALESCE(SUM(o.total_amount), 0) AS total_revenue
                FROM orders o
                WHERE o.vendor_id = $1 ${previousDateFilter}
            `, [vendorId]),
        marketplacePool.query(`
                SELECT
                    p.category,
                    COALESCE(SUM(oi.quantity), 0) AS total_quantity,
                    COALESCE(SUM(oi.quantity * oi.price), 0) AS total_revenue
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                JOIN products p ON oi.product_id = p.id
                WHERE oi.vendor_id = $1 ${dateFilter}
                GROUP BY p.category
                ORDER BY total_quantity DESC
            `, [vendorId]),
        marketplacePool.query(timeframe === "month"
            ? `
                    SELECT
                        EXTRACT(DAY FROM o.created_at)::integer AS day_num,
                        COALESCE(SUM(o.total_amount), 0) AS revenue
                    FROM orders o
                    WHERE o.vendor_id = $1 ${dateFilter}
                    GROUP BY EXTRACT(DAY FROM o.created_at)
                    ORDER BY day_num ASC
                `
            : `
                    SELECT
                        TO_CHAR(o.created_at, 'Mon') AS month_name,
                        EXTRACT(MONTH FROM o.created_at)::integer AS month_num,
                        COALESCE(SUM(o.total_amount), 0) AS revenue
                    FROM orders o
                    WHERE o.vendor_id = $1 ${dateFilter}
                    GROUP BY TO_CHAR(o.created_at, 'Mon'), EXTRACT(MONTH FROM o.created_at)
                    ORDER BY month_num ASC
                `, [vendorId]),
        marketplacePool.query(`
                SELECT
                    p.id AS product_id,
                    p.name AS product_name,
                    p.category,
                    COALESCE(SUM(oi.quantity), 0) AS total_sales,
                    COALESCE(SUM(oi.quantity * oi.price), 0) AS total_revenue
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                JOIN products p ON oi.product_id = p.id
                WHERE oi.vendor_id = $1 ${dateFilter}
                GROUP BY p.id, p.name, p.category
                ORDER BY total_sales DESC
                LIMIT 5
            `, [vendorId]),
    ]);
    const totalQuantity = parseInteger(tonnageResult.rows[0]?.total_quantity);
    const prevTotalQuantity = parseInteger(prevTonnageResult.rows[0]?.total_quantity);
    const tonnageGrowth = prevTotalQuantity > 0 ? ((totalQuantity - prevTotalQuantity) / prevTotalQuantity) * 100 : 0;
    const avgOrderValue = parseNumber(aovResult.rows[0]?.avg_order_value);
    const currentRevenue = parseNumber(aovResult.rows[0]?.total_revenue);
    const prevAvgOrderValue = parseNumber(prevAovResult.rows[0]?.avg_order_value);
    const prevRevenue = parseNumber(prevAovResult.rows[0]?.total_revenue);
    const aovGrowth = prevAvgOrderValue > 0 ? ((avgOrderValue - prevAvgOrderValue) / prevAvgOrderValue) * 100 : 0;
    const totalCategoryQuantity = categoryResult.rows.reduce((sum, row) => sum + parseInteger(row.total_quantity), 0);
    const topSegment = categoryResult.rows[0] ?? null;
    const chartLabels = [];
    const chartData = [];
    if (timeframe === "month") {
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const revenueMap = new Map();
        for (const row of monthlyResult.rows) {
            revenueMap.set(parseInteger(row.day_num), parseNumber(row.revenue));
        }
        for (let day = 1; day <= daysInMonth; day += 1) {
            chartLabels.push(String(day));
            chartData.push(revenueMap.get(day) ?? 0);
        }
    }
    else {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const revenueMap = new Map();
        for (const row of monthlyResult.rows) {
            revenueMap.set(row.month_name, parseNumber(row.revenue));
        }
        let startMonth = 0;
        let monthsToShow = 12;
        if (timeframe === "6months") {
            startMonth = now.getMonth() - 5;
            monthsToShow = 6;
            if (startMonth < 0) {
                startMonth += 12;
            }
        }
        for (let i = 0; i < monthsToShow; i += 1) {
            const monthIndex = (startMonth + i) % 12;
            const monthName = monthNames[monthIndex];
            chartLabels.push(monthName);
            chartData.push(revenueMap.get(monthName) ?? 0);
        }
    }
    const topProducts = await Promise.all(topProductsResult.rows.map(async (row) => {
        const prevProductResult = await marketplacePool.query(`
                    SELECT COALESCE(SUM(oi.quantity), 0) AS prev_sales
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    WHERE oi.vendor_id = $1 AND oi.product_id = $2 ${previousDateFilter}
                `, [vendorId, row.product_id]);
        const prevSales = parseInteger(prevProductResult.rows[0]?.prev_sales);
        const currentSales = parseInteger(row.total_sales);
        const growth = prevSales > 0 ? ((currentSales - prevSales) / prevSales) * 100 : 0;
        return {
            id: row.product_id,
            name: row.product_name,
            category: row.category || "Uncategorized",
            sales: currentSales,
            revenue: parseNumber(row.total_revenue),
            growth: parseNumber(growth.toFixed(1)),
        };
    }));
    return {
        timeframe,
        kpi: {
            totalQuantity,
            tonnageGrowth: parseNumber(tonnageGrowth.toFixed(1)),
            avgOrderValue,
            aovGrowth: parseNumber(aovGrowth.toFixed(1)),
            topSegment: topSegment ? {
                name: topSegment.category || "Unknown",
                volume: parseInteger(topSegment.total_quantity),
                percentage: totalCategoryQuantity > 0
                    ? parseNumber(((parseInteger(topSegment.total_quantity) / totalCategoryQuantity) * 100).toFixed(1))
                    : 0,
            } : null,
            totalRevenue: currentRevenue,
            revenueGrowth: prevRevenue > 0
                ? parseNumber((((currentRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1))
                : 0,
        },
        revenueChart: {
            labels: chartLabels,
            data: chartData,
        },
        categoryDistribution: categoryResult.rows.map((row) => ({
            name: row.category || "Uncategorized",
            quantity: parseInteger(row.total_quantity),
            revenue: parseNumber(row.total_revenue),
            percentage: totalCategoryQuantity > 0
                ? parseNumber(((parseInteger(row.total_quantity) / totalCategoryQuantity) * 100).toFixed(1))
                : 0,
        })),
        topProducts,
    };
}
//# sourceMappingURL=vendorInsights.service.js.map