import dotenv from "dotenv";
dotenv.config();
import mysql from "mysql2/promise";
import { config } from "../src/config.js";

async function main() {
  const conn = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
  });

  try {
    const email = "northeastdrugdistributor@gmail.com";
    const [uRows] = await conn.query("SELECT id FROM users WHERE email = ?", [email]);
    if (uRows.length === 0) {
      console.log("User not found!");
      return;
    }
    const userId = uRows[0].id;
    console.log("Testing Sale Return for user_id:", userId);

    // Get a sample product for this user
    const [products] = await conn.query("SELECT id, name FROM products WHERE user_id = ? LIMIT 1", [userId]);
    if (products.length === 0) {
      console.log("No products found for user.");
      return;
    }
    const product = products[0];
    console.log("Target product:", product);

    // Check stock before
    const [stockBefore] = await conn.query(
      "SELECT COALESCE(SUM(available_qty), 0) AS total FROM product_batches WHERE product_id = ?",
      [product.id]
    );
    console.log("Initial stock for product:", stockBefore[0].total);

    // Check customer payments / credit balance before
    const phone = "7002239535"; // NAZRANA MEDICAL HALL
    const [custBillsBefore] = await conn.query(
      `SELECT SUM(total) AS totalCredit FROM bills WHERE user_id = ? AND customer_phone = ? AND payment_method = 'credit' AND (status IS NULL OR status != 'rejected')`,
      [userId, phone]
    );
    console.log("Customer total credit before test:", custBillsBefore[0].totalCredit);

  } finally {
    await conn.end();
  }
}

main().catch(console.error);
