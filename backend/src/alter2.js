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
    await connection.query("ALTER TABLE bill_items ADD COLUMN mrp DECIMAL(12,2) NULL;");
    console.log("MySQL alter bill_items completed successfully.");
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME") {
      console.log("Column mrp already exists in bill_items.");
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
