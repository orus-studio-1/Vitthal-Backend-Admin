import { marketplacePool } from "../lib/marketplace.js";

async function check() {
    try {
        console.log("Querying pending products...");
        const result = await marketplacePool.query("SELECT id, name, category, product_type, approval_status, is_active, created_by_user_id FROM products WHERE approval_status = 'pending'");
        console.log("Total pending products in database:", result.rows.length);
        console.log(JSON.stringify(result.rows, null, 2));

        console.log("\nQuerying vendor-created products...");
        const creatorResult = await marketplacePool.query("SELECT id, name, category, product_type, approval_status, is_active, created_by_user_id FROM products WHERE created_by_user_id IS NOT NULL");
        console.log("Total vendor-created products in database:", creatorResult.rows.length);
        console.log(JSON.stringify(creatorResult.rows, null, 2));
    } catch (err) {
        console.error("Database query failed:", err);
    } finally {
        process.exit(0);
    }
}

check();
