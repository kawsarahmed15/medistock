import mysql from "mysql2/promise";
import { config } from "./config.js";

async function run() {
  const connection = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
  });

  try {
    console.log("Altering quantity columns to support fractional retail strip quantities (DECIMAL)...");

    await connection.query("ALTER TABLE product_batches MODIFY COLUMN available_qty DECIMAL(12,2) NOT NULL DEFAULT 0.00;");
    await connection.query("ALTER TABLE product_batches MODIFY COLUMN strip_qty DECIMAL(12,2) NULL;");
    await connection.query("ALTER TABLE bill_items MODIFY COLUMN qty DECIMAL(12,2) NOT NULL DEFAULT 0.00;");
    await connection.query("ALTER TABLE bill_items MODIFY COLUMN free_qty DECIMAL(12,2) NOT NULL DEFAULT 0.00;");
    await connection.query("ALTER TABLE purchase_items MODIFY COLUMN qty DECIMAL(12,2) NOT NULL DEFAULT 0.00;");
    await connection.query("ALTER TABLE purchase_items MODIFY COLUMN free_qty DECIMAL(12,2) NOT NULL DEFAULT 0.00;");
    await connection.query("ALTER TABLE product_history MODIFY COLUMN quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00;");
    await connection.query("ALTER TABLE product_history MODIFY COLUMN balance DECIMAL(12,2) NOT NULL DEFAULT 0.00;");

    console.log("Retail quantity columns altered successfully!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await connection.end();
  }
}

run();
