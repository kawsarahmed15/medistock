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
    const email = "northeastdrugdistributor@gmail.com";
    const [uRows] = await conn.query("SELECT id FROM users WHERE email = ?", [email]);
    const userId = uRows[0].id;

    // 1. Get SR-0001
    const [srBills] = await conn.query(
      "SELECT * FROM bills WHERE user_id = ? AND number = 'SR-0001'",
      [userId]
    );
    console.log("SR-0001 Bill:");
    console.dir(srBills, { depth: null });

    if (srBills.length > 0) {
      const billId = srBills[0].id;
      const [srItems] = await conn.query("SELECT * FROM bill_items WHERE bill_id = ?", [billId]);
      console.log("\nSR-0001 Items:");
      console.dir(srItems, { depth: null });
    }
  } finally {
    await conn.end();
  }
}

main().catch(console.error);
