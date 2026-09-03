import { pool } from "../src/db.js";

async function fixCortimist() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const productId = "0253e565-fe8b-4161-8aaf-ab7956ab959c";
    const batchId = "7bc34fc1-47d5-432a-a683-38d0ff11892c";

    console.log("1. Updating batch S096004J available_qty to 1...");
    const [bRes] = await conn.query(
      "UPDATE product_batches SET available_qty = 1 WHERE id = ? AND product_id = ?",
      [batchId, productId]
    );
    console.log("Batch update result:", bRes.affectedRows, "rows affected");

    console.log("2. Deleting erroneous sale records from product_history for CORTIMIST TRIO...");
    const [hRes] = await conn.query(
      "DELETE FROM product_history WHERE product_id = ? AND action = 'sale'",
      [productId]
    );
    console.log("History deletion result:", hRes.affectedRows, "rows deleted");

    await conn.commit();
    console.log("Transaction committed successfully!");

    // Verify current state
    console.log("\n=== VERIFICATION FOR CORTIMIST TRIO ===");
    const [batches] = await pool.query(
      "SELECT id, batch_no, available_qty FROM product_batches WHERE product_id = ?",
      [productId]
    );
    console.log("Batches:", batches);

    const [history] = await pool.query(
      "SELECT id, action, quantity, balance, notes, created_at FROM product_history WHERE product_id = ? ORDER BY created_at ASC",
      [productId]
    );
    console.log("History (Audit Logs):", history);

    process.exit(0);
  } catch (err) {
    await conn.rollback();
    console.error("Error fixing Cortimist:", err);
    process.exit(1);
  } finally {
    conn.release();
  }
}

fixCortimist();
