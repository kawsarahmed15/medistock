import mysql from "mysql2/promise";
import { config } from "./config.js";

async function runAlter() {
  const connection = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
  });

  try {
    await connection.query("ALTER TABLE bill_items ADD COLUMN batch VARCHAR(120) NULL AFTER mrp;");
    console.log("MySQL alter completed successfully.");
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log("Column batch already exists.");
    } else {
      throw err;
    }
  } finally {
    await connection.end();
  }
}

runAlter().catch((error) => {
  console.error("MySQL alter failed:", error.message);
  process.exit(1);
});
