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
    await db.query("ALTER TABLE bill_items ADD COLUMN expiry DATE NULL");
    console.log("Added expiry to bill_items");
  } catch (e) {
    if (e.code !== "ER_DUP_FIELDNAME") throw e;
  }

  await db.end();
}
main().catch(console.error);
