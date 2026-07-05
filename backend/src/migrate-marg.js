import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { config } from "./config.js";

async function runMigration() {
  const sql = await readFile(new URL("../sql/marg_inventory.sql", import.meta.url), "utf8");

  const connection = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    multipleStatements: true,
  });

  try {
    await connection.query(sql);
    console.log("MARG MySQL migration completed successfully.");
  } finally {
    await connection.end();
  }
}

runMigration().catch((error) => {
  console.error("MARG MySQL migration failed:", error.message);
  process.exit(1);
});
