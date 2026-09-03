import { pool } from "../src/db.js";

async function inspectHistorySchema() {
  try {
    const [cols] = await pool.query("DESCRIBE product_history");
    console.log("=== product_history columns ===");
    console.log(cols);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

inspectHistorySchema();
