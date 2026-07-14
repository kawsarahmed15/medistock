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
    await db.query("ALTER TABLE users ADD COLUMN low_stock_qty INT NOT NULL DEFAULT 10");
    console.log("Added low_stock_qty to users table successfully");
  } catch (e) {
    if (e.code !== "ER_DUP_FIELDNAME") {
      throw e;
    } else {
      console.log("Column low_stock_qty already exists in users table");
    }
  }

  await db.end();
}
main().catch(console.error);
