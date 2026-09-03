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
    const [pMatch] = await conn.query(
      `SELECT id, name, sku FROM products 
       WHERE user_id = ? AND (LOWER(TRIM(name)) = LOWER(TRIM(?)) OR (sku IS NOT NULL AND sku = ?)) 
       LIMIT 1`,
      [userId, "CUFSNIFF LS SYRUP", "30049099"]
    );
    console.log("pMatch returned:");
    console.dir(pMatch, { depth: null });

    // Check product_history for return action for user
    const [returns] = await conn.query(
      "SELECT h.*, p.name as product_name FROM product_history h JOIN products p ON h.product_id = p.id WHERE h.user_id = ? AND h.action = 'return'",
      [userId]
    );
    console.log("\nReturn logs in product_history:");
    console.dir(returns, { depth: null });

  } finally {
    await conn.end();
  }
}

main().catch(console.error);
