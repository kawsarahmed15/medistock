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
    await db.query("ALTER TABLE product_batches ADD COLUMN sku VARCHAR(100) NULL AFTER batch_no");
    console.log("Added sku column to product_batches table");
  } catch (e) {
    if (e.code !== "ER_DUP_FIELDNAME") throw e;
    console.log("sku column already exists in product_batches table");
  }

  await db.end();
}
main().catch(console.error);
