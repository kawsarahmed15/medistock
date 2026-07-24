import mysql from "mysql2/promise";
import { config } from "./config.js";

async function main() {
  const db = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
  });

  try {
    await db.query(
      "ALTER TABLE product_history MODIFY COLUMN action ENUM('initial','stock_in','stock_out','sale','purchase','adjustment','return') NOT NULL"
    );
    console.log("Updated product_history action ENUM to include 'return'");
  } catch (e) {
    console.error("Migration error:", e);
  }

  await db.end();
}
main().catch(console.error);
