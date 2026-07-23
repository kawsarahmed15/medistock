import { pool } from "./db.js";
import { randomUUID } from "node:crypto";

async function main() {
  console.log("Starting batch migration...");

  try {
    // 1. Create product_batches table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_batches (
        id CHAR(36) PRIMARY KEY,
        product_id CHAR(36) NOT NULL,
        batch_no VARCHAR(120) NOT NULL,
        expiry_date DATE NOT NULL,
        manufacture_date DATE NULL,
        purchase_price DECIMAL(12,2) NOT NULL DEFAULT 0,
        mrp DECIMAL(12,2) NOT NULL DEFAULT 0,
        selling_price DECIMAL(12,2) NOT NULL DEFAULT 0,
        available_qty INT NOT NULL DEFAULT 0,
        strip_qty INT NULL,
        supplier_id VARCHAR(36) NULL,
        invoice_id VARCHAR(36) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_batches_product (product_id),
        UNIQUE KEY uniq_product_batch (product_id, batch_no),
        CONSTRAINT fk_batches_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("Table 'product_batches' created or already exists.");

    // 2. Check if products table still has old columns to migrate
    const [columns] = await pool.query("DESCRIBE products;");
    const hasLegacyColumns = columns.some(col => col.Field === "batch");

    if (hasLegacyColumns) {
      console.log("Legacy columns found on 'products'. Copying data...");
      const [products] = await pool.query(`
        SELECT id, price, cost_price, stock, expiry, mrp, batch FROM products
      `);

      console.log(`Found ${products.length} products to migrate.`);

      for (const p of products) {
        const batchNo = p.batch && p.batch.trim() ? p.batch.trim() : "DEFAULT";
        const expiryDate = p.expiry ? p.expiry : "2030-12-31";
        const purchasePrice = p.cost_price != null ? Number(p.cost_price) : 0;
        const mrp = p.mrp != null ? Number(p.mrp) : 0;
        const sellingPrice = p.price != null ? Number(p.price) : 0;
        const availableQty = p.stock != null ? Number(p.stock) : 0;

        try {
          await pool.query(`
            INSERT INTO product_batches (id, product_id, batch_no, expiry_date, purchase_price, mrp, selling_price, available_qty)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              available_qty = available_qty + VALUES(available_qty)
          `, [
            randomUUID(),
            p.id,
            batchNo,
            expiryDate,
            purchasePrice,
            mrp,
            sellingPrice,
            availableQty
          ]);
        } catch (err) {
          console.error(`Failed to migrate product ${p.id} (${p.batch}):`, err.message);
        }
      }

      console.log("Migration of legacy data complete. Dropping legacy columns from 'products'...");
      try {
        await pool.query(`
          ALTER TABLE products
          DROP COLUMN batch,
          DROP COLUMN expiry,
          DROP COLUMN cost_price,
          DROP COLUMN mrp,
          DROP COLUMN price,
          DROP COLUMN stock;
        `);
        console.log("Dropped legacy columns successfully.");
      } catch (err) {
        console.error("Failed to drop legacy columns:", err.message);
      }
    } else {
      console.log("No legacy columns found on 'products'. Migration already completed.");
    }

  } catch (error) {
    console.error("Migration script failed:", error);
  } finally {
    await pool.end();
  }
}

main();
