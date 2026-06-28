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
    await db.query("ALTER TABLE bills ADD COLUMN advance_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER payment_method");
    console.log("Added advance_amount to bills");
  } catch (e) {
    console.error(e);
  }

  await db.end();
}
main().catch(console.error);
