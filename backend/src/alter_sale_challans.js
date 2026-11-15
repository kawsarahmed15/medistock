import mysql from "mysql2/promise";
import { config } from "./config.js";

export async function runSaleChallanMigration(existingConn = null) {
  const db = existingConn || (await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    multipleStatements: true,
  }));

  try {
    // 1. Sale Challans Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS sale_challans (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        challan_number VARCHAR(50) NOT NULL,
        challan_date DATE NOT NULL,
        customer_name VARCHAR(190) NULL,
        customer_phone VARCHAR(50) NULL,
        customer_address TEXT NULL,
        customer_gstin VARCHAR(50) NULL,
        subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        tax DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        discount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        status VARCHAR(30) NOT NULL DEFAULT 'issued',
        notes TEXT NULL,
        created_by_role VARCHAR(20) NOT NULL DEFAULT 'admin',
        created_by_name VARCHAR(100) NULL,
        employee_id CHAR(36) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_challan_num (user_id, challan_number),
        INDEX idx_challans_user_status (user_id, status),
        INDEX idx_challans_user_date (user_id, challan_date),
        CONSTRAINT fk_challans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Sale Challan Items Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS sale_challan_items (
        id CHAR(36) PRIMARY KEY,
        challan_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        product_id CHAR(36) NOT NULL,
        batch_id CHAR(36) NULL,
        product_name VARCHAR(255) NOT NULL,
        batch_no VARCHAR(120) NULL,
        expiry_date DATE NULL,
        available_stock DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        qty DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        free_qty DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        mrp DECIMAL(12,2) NULL,
        rate DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        billed_qty DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        billed_free_qty DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        pack VARCHAR(50) NULL,
        sku VARCHAR(120) NULL,
        conversion_factor DECIMAL(12,2) NOT NULL DEFAULT 1.00,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sci_challan (challan_id),
        INDEX idx_sci_user_product (user_id, product_id),
        INDEX idx_sci_user_batch (user_id, batch_id),
        CONSTRAINT fk_sci_challan FOREIGN KEY (challan_id) REFERENCES sale_challans(id) ON DELETE CASCADE,
        CONSTRAINT fk_sci_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Stock Reservations Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS stock_reservations (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        challan_id CHAR(36) NOT NULL,
        challan_item_id CHAR(36) NULL,
        challan_number VARCHAR(50) NOT NULL,
        product_id CHAR(36) NOT NULL,
        batch_id CHAR(36) NULL,
        batch_no VARCHAR(120) NULL,
        reserved_qty DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        billed_qty DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        remaining_qty DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sr_user_status (user_id, status),
        INDEX idx_sr_user_prod (user_id, product_id),
        INDEX idx_sr_user_batch (user_id, batch_id),
        INDEX idx_sr_challan (challan_id),
        CONSTRAINT fk_sr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_sr_challan FOREIGN KEY (challan_id) REFERENCES sale_challans(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Challan Invoices Mapping Table
    await db.query(`
      CREATE TABLE IF NOT EXISTS challan_invoices (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        challan_id CHAR(36) NOT NULL,
        bill_id CHAR(36) NOT NULL,
        challan_number VARCHAR(50) NOT NULL,
        invoice_number VARCHAR(50) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ci_user (user_id),
        INDEX idx_ci_challan (challan_id),
        INDEX idx_ci_bill (bill_id),
        CONSTRAINT fk_ci_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_ci_challan FOREIGN KEY (challan_id) REFERENCES sale_challans(id) ON DELETE CASCADE,
        CONSTRAINT fk_ci_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Add challan columns to bills table
    try {
      await db.query("ALTER TABLE bills ADD COLUMN challan_id CHAR(36) NULL AFTER employee_id");
    } catch (e) {
      if (e.code !== "ER_DUP_FIELDNAME") {
        console.warn("Could not add challan_id to bills:", e.message);
      }
    }

    try {
      await db.query("ALTER TABLE bills ADD COLUMN challan_number VARCHAR(50) NULL AFTER challan_id");
    } catch (e) {
      if (e.code !== "ER_DUP_FIELDNAME") {
        console.warn("Could not add challan_number to bills:", e.message);
      }
    }

    console.log("Sale challans schema migration completed successfully.");
  } finally {
    if (!existingConn) {
      await db.end();
    }
  }
}

// Allow direct CLI execution
if (process.argv[1] && process.argv[1].endsWith("alter_sale_challans.js")) {
  runSaleChallanMigration().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
