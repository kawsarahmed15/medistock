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
    const [srBills] = await conn.query(
      "SELECT id, number, customer_name, total, created_at FROM bills WHERE number LIKE 'SR-%'"
    );

    console.log(`Found ${srBills.length} total sale return bill(s) in system:`);
    console.dir(srBills, { depth: null });

    if (srBills.length === 0) {
      console.log("No sale return bills found.");
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
      `DELETE FROM bills WHERE id IN (${placeholders})`,
      srIds
    );
    console.log(`Deleted ${billRes.affectedRows} bill(s) from bills.`);

    // Remove return action records from product_history
    const [histRes] = await conn.query(
      "DELETE FROM product_history WHERE action = 'return'"
    );
    console.log(`Deleted ${histRes.affectedRows} record(s) from product_history.`);

    // Check remaining
    const [remaining] = await conn.query(
      "SELECT COUNT(*) as count FROM bills WHERE number LIKE 'SR-%'"
    );
    console.log("Remaining SR bills in system:", remaining[0].count);

  } finally {
    await conn.end();
  }
}

main().catch(console.error);
