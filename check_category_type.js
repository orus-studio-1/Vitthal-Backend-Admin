const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres:%23Radhasoami9811@localhost:5432/vitthal_db'
});

async function main() {
  try {
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'category';");
    console.log("Column 'category' type in 'products' table:", res.rows);
  } catch (err) {
    console.error("Error running query:", err);
  } finally {
    await pool.end();
  }
}

main();
