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
    const userId = '220a9129-0129-4efc-aa51-4a2096c617a8';

    console.log("Fetching sale return bills for user_id:", userId);
    const [srBills] = await conn.query(
      "SELECT id, number, customer_name, total, created_at FROM bills WHERE user_id = ? AND number LIKE 'SR-%'",
      [userId]
    );

    console.log(`Found ${srBills.length} sale return bill(s) to remove:`);
    console.dir(srBills, { depth: null });

    if (srBills.length === 0) {
      console.log("No sale return bills found to remove.");
      return;
    }

    const srIds = srBills.map(b => b.id);
    const placeholders = srIds.map(() => '?').join(',');

    // Delete bill items
    const [itemRes] = await conn.query(
      `DELETE FROM bill_items WHERE bill_id IN (${placeholders})`,
      srIds
    );
    console.log(`Deleted ${itemRes.affectedRows} item(s) from bill_items.`);

    // Delete bills
    const [billRes] = await conn.query(
      `DELETE FROM bills WHERE id IN (${placeholders}) AND user_id = ?`,
      [...srIds, userId]
    );
    console.log(`Deleted ${billRes.affectedRows} bill(s) from bills.`);

    // Also check for any product_history entries with action = 'return' for this user
    const [histRes] = await conn.query(
      "DELETE FROM product_history WHERE user_id = ? AND action = 'return'",
      [userId]
    );
    console.log(`Deleted ${histRes.affectedRows} record(s) from product_history.`);

    // Verification check
    const [remaining] = await conn.query(
      "SELECT COUNT(*) as count FROM bills WHERE user_id = ? AND number LIKE 'SR-%'",
      [userId]
    );
    console.log(`Remaining sale return bills for user: ${remaining[0].count}`);

  } finally {
    await conn.end();
  }
}

main().catch(console.error);
