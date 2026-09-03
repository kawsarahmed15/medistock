import dotenv from "dotenv";
dotenv.config();
import mysql from "mysql2/promise";
import { config } from "../src/config.js";

async function main() {
  const conn = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
  });

  try {
    const userId = "220a9129-0129-4efc-aa51-4a2096c617a8";
    
    // 1. Remove wrong 5 stock from CORTIMIST TRIO
    const [cortimistBatches] = await conn.query(
      "SELECT id, available_qty FROM product_batches WHERE product_id = '0253e565-fe8b-4161-8aaf-ab7956ab959c' ORDER BY created_at DESC LIMIT 1"
    );
    if (cortimistBatches.length > 0) {
      await conn.query(
        "UPDATE product_batches SET available_qty = available_qty - 5 WHERE id = ?",
        [cortimistBatches[0].id]
      );
      console.log("Deducted 5 stock from CORTIMIST TRIO batch:", cortimistBatches[0].id);
    }

    // Delete wrong product_history record for CORTIMIST TRIO
    await conn.query(
      "DELETE FROM product_history WHERE id = '4e0b1792-e427-4fdd-b896-7bd494f1705b'"
    );
    console.log("Deleted wrong product_history record 4e0b1792-e427-4fdd-b896-7bd494f1705b.");

    // 2. Add 5 stock to CUFSNIFF LS SYRUP batch 2602241 (Product ID: 44bd4888-5e3b-4953-8ccf-50a79dc953b0, Batch ID: 47861418-4e8b-4b4d-9ad4-b1c419be4fa0)
    await conn.query(
      "UPDATE product_batches SET available_qty = available_qty + 5 WHERE id = '47861418-4e8b-4b4d-9ad4-b1c419be4fa0'"
    );
    console.log("Added 5 stock to CUFSNIFF LS SYRUP batch 47861418-4e8b-4b4d-9ad4-b1c419be4fa0.");

    // Get new total stock for CUFSNIFF LS SYRUP
    const [cufStock] = await conn.query(
      "SELECT SUM(available_qty) as total FROM product_batches WHERE product_id = '44bd4888-5e3b-4953-8ccf-50a79dc953b0'"
    );
    const newTotal = cufStock[0].total;
    console.log("New total stock for CUFSNIFF LS SYRUP:", newTotal);

    // Insert correct product_history record for CUFSNIFF LS SYRUP
    const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36);
    await conn.query(
      `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes)
       VALUES (?, ?, '44bd4888-5e3b-4953-8ccf-50a79dc953b0', 'return', 5, ?, 'Customer return via SR-0001')`,
      [generateId(), userId, newTotal]
    );
    console.log("Inserted correct product_history return record for CUFSNIFF LS SYRUP.");

  } finally {
    await conn.end();
  }
}

main().catch(console.error);
