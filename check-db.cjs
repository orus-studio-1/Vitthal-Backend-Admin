const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres' // default local connection
});

async function main() {
  try {
    const cats = await pool.query("SELECT id, code, label FROM product_category");
    console.table(cats.rows);

    const vendorCats = await pool.query(`
      SELECT vc.vendor_id, v.company_name, pc.code, pc.label
      FROM vendor_categories vc
      JOIN vendors v ON v.id = vc.vendor_id
      JOIN product_category pc ON pc.id = vc.category_id
    `);
    console.table(vendorCats.rows);

    console.log("\n=== Vendor Products in DB ===");
    const vendorProds = await pool.query(`
      SELECT vp.vendor_id, p.name, p.category AS category_uuid, pc.code AS category_code, p.product_type
      FROM vendor_products vp
      JOIN products p ON p.id = vp.product_id
      LEFT JOIN product_category pc ON pc.id = p.category
    `);
    console.table(vendorProds.rows);

  } catch (err) {
    console.error("Database query failed:", err);
  } finally {
    await pool.end();
  }
}

main();
