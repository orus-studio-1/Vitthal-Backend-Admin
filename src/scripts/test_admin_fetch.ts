import { marketplacePool } from "../lib/marketplace.js";

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

async function main() {
  try {
    const res = await marketplacePool.query(`${productSelect} ORDER BY p.created_at DESC`);
    console.log("MARKETPLACE POOL PRODUCTS FETCHED COUNT:", res.rows.length);
    res.rows.slice(0, 5).forEach(p => {
      console.log(`- ID: ${p.id} | Name: ${p.name} | CreatorRole: ${p.creator_role} | UserID: ${p.created_by_user_id}`);
    });
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
