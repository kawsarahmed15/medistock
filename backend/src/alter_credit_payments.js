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
    // Modify ENUM in bills
    await db.query("ALTER TABLE bills MODIFY COLUMN payment_method ENUM('cash', 'online', 'credit') NOT NULL DEFAULT 'cash'");
    console.log("Updated payment_method ENUM in bills");

    // Create customer_payments table
    await db.query(`
      CREATE TABLE IF NOT EXISTS customer_payments (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        customer_phone VARCHAR(50) NULL,
        customer_name VARCHAR(190) NULL,
        amount DECIMAL(12,2) NOT NULL,
        payment_method ENUM('cash', 'online') NOT NULL DEFAULT 'cash',
        notes TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_payments_user_customer (user_id, customer_phone),
        CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("Created customer_payments table");
  } catch (e) {
    console.error(e);
  }

  await db.end();
}
main().catch(console.error);
