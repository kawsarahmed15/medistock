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
    await db.query("ALTER TABLE bill_items ADD COLUMN free_qty INT NOT NULL DEFAULT 0");
    console.log("Added free_qty to bill_items");
  } catch (e) {
    if (e.code !== "ER_DUP_FIELDNAME") throw e;
  }

  await db.end();
}
main().catch(console.error);
