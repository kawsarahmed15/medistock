import { pool } from "../src/db.js";
import { randomUUID } from "node:crypto";

async function applyNutonAuditLogs() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const userId = "220a9129-0129-4efc-aa51-4a2096c617a8";
    const productId = "acb16db9-0356-4ca8-8e9d-7eead2cd8e3a";

    // Double check if any history already exists to prevent duplicate execution
    const [existing] = await conn.query(
      "SELECT id FROM product_history WHERE product_id = ? AND user_id = ?",
      [productId, userId]
    );

    if (existing.length > 0) {
      console.log(`History already exists for product ${productId}. Found ${existing.length} records.`);
      await conn.rollback();
      process.exit(0);
      return;
    }

    const log1Id = randomUUID();
    const log2Id = randomUUID();

    // 1. Initial Stock Inward Entry
    console.log("Inserting Entry 1: Stock In (+2.00)...");
    await conn.query(
      `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes, invoice_no, created_at)
       VALUES (?, ?, ?, 'stock_in', 2.00, 2.00, ?, NULL, ?)`,
      [
        log1Id,
        userId,
        productId,
        "Initial inventory stock (Batch: OD01)",
        "2026-07-10 06:13:45"
      ]
    );

    // 2. Sale via INV-0016 Entry
    console.log("Inserting Entry 2: Sale via INV-0016 (-2.00)...");
    await conn.query(
      `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes, invoice_no, created_at)
       VALUES (?, ?, ?, 'sale', 2.00, 0.00, ?, 'INV-0016', ?)`,
      [
        log2Id,
        userId,
        productId,
        "Sale via INV-0016 by NORTH EAST DRUG DISTRIBUTOR",
        "2026-07-10 06:19:18"
      ]
    );

    await conn.commit();
    console.log("Successfully inserted audit logs!");

    // Verification
    const [rows] = await pool.query(
      `SELECT id, action, quantity, balance, notes, invoice_no, created_at
       FROM product_history
       WHERE product_id = ? AND user_id = ?
       ORDER BY created_at ASC`,
      [productId, userId]
    );
    console.log("\n=== VERIFIED AUDIT LOGS FOR NUTON KNEE CAP DELUXE ===");
    console.log(JSON.stringify(rows, null, 2));

    process.exit(0);
  } catch (err) {
    await conn.rollback();
    console.error("Failed to insert audit logs:", err);
    process.exit(1);
  } finally {
    conn.release();
  }
}

applyNutonAuditLogs();
