import { pool } from "../src/db.js";

async function checkNegativeAndAudit() {
  try {
    const userId = "220a9129-0129-4efc-aa51-4a2096c617a8";

    console.log("=== CHECKING ALL BATCHES WITH NEGATIVE OR UNEXPECTED QTY FOR THIS USER ===");
    const [negBatches] = await pool.query(
      `SELECT b.*, p.name 
       FROM product_batches b 
       JOIN products p ON b.product_id = p.id 
       WHERE p.user_id = ? AND b.available_qty < 0`,
      [userId]
    );
    console.log("Negative batches:", negBatches);

    console.log("\n=== CHECKING ALL HISTORY ENTRIES FOR CORTIMIST TRIO ===");
    const [cortHist] = await pool.query(
      `SELECT * FROM product_history WHERE product_id = '0253e565-fe8b-4161-8aaf-ab7956ab959c' ORDER BY created_at ASC`
    );
    console.log(cortHist);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkNegativeAndAudit();
