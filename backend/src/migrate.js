import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { config } from "./config.js";

async function runMigration() {
  const sql = await readFile(new URL("../sql/schema.sql", import.meta.url), "utf8");

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
    console.log("MySQL base schema migration completed.");

    // Ensure columns exist on existing databases
    const safeAddColumn = async (table, column, def) => {
      try {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
      } catch (e) {
        if (e.code !== "ER_DUP_FIELDNAME") {
          // ignore duplicate column error
        }
      }
    };

    await safeAddColumn("users", "employee_password_hash", "VARCHAR(255) NULL AFTER password_hash");
    await safeAddColumn("users", "is_employee_enabled", "TINYINT(1) NOT NULL DEFAULT 1 AFTER employee_password_hash");
    await safeAddColumn("bills", "status", "VARCHAR(20) NOT NULL DEFAULT 'completed' AFTER total");
    await safeAddColumn("bills", "created_by_role", "VARCHAR(20) NOT NULL DEFAULT 'admin' AFTER status");
    await safeAddColumn("bills", "created_by_name", "VARCHAR(100) NULL AFTER created_by_role");
    await safeAddColumn("bills", "employee_id", "CHAR(36) NULL AFTER created_by_name");
    await safeAddColumn("bills", "approved_at", "TIMESTAMP NULL AFTER employee_id");
    await safeAddColumn("bills", "approved_by", "VARCHAR(100) NULL AFTER approved_at");
    await safeAddColumn("employees", "username", "VARCHAR(100) NULL UNIQUE AFTER name");
    await safeAddColumn("product_history", "invoice_no", "VARCHAR(100) NULL AFTER notes");

    await safeAddColumn("purchase_items", "conversion_factor", "DECIMAL(12,2) NOT NULL DEFAULT 1.00 AFTER pack");
    await safeAddColumn("bill_items", "conversion_factor", "DECIMAL(12,2) NOT NULL DEFAULT 1.00 AFTER pack");
    await safeAddColumn("product_batches", "conversion_factor", "DECIMAL(12,2) NOT NULL DEFAULT 1.00 AFTER strip_qty");
    await safeAddColumn("products", "conversion_factor", "DECIMAL(12,2) NOT NULL DEFAULT 1.00 AFTER pack_unit");

    try {
      await connection.query("ALTER TABLE product_batches MODIFY COLUMN available_qty DECIMAL(12,2) NOT NULL DEFAULT 0.00;");
      await connection.query("ALTER TABLE product_batches MODIFY COLUMN strip_qty DECIMAL(12,2) NULL;");
      await connection.query("ALTER TABLE bill_items MODIFY COLUMN qty DECIMAL(12,2) NOT NULL DEFAULT 0.00;");
      await connection.query("ALTER TABLE bill_items MODIFY COLUMN free_qty DECIMAL(12,2) NOT NULL DEFAULT 0.00;");
      await connection.query("ALTER TABLE purchase_items MODIFY COLUMN qty DECIMAL(12,2) NOT NULL DEFAULT 0.00;");
      await connection.query("ALTER TABLE purchase_items MODIFY COLUMN free_qty DECIMAL(12,2) NOT NULL DEFAULT 0.00;");
      await connection.query("ALTER TABLE product_history MODIFY COLUMN quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00;");
      await connection.query("ALTER TABLE product_history MODIFY COLUMN balance DECIMAL(12,2) NOT NULL DEFAULT 0.00;");
    } catch (e) {
      // ignore
    }

    try {
      await connection.query(`
        UPDATE product_history 
        SET invoice_no = REGEXP_SUBSTR(notes, '(INV|SR|PO|INIT)-[A-Za-z0-9]+') 
        WHERE (invoice_no IS NULL OR invoice_no = '') 
          AND notes REGEXP '(INV|SR|PO|INIT)-[A-Za-z0-9]+'
      `);
    } catch (e) {
      // Ignore if REGEXP_SUBSTR is not supported or no rows
    }

    try {
      const [rows] = await connection.query(`
        SELECT h.id as history_id, h.user_id, h.product_id, h.notes, h.created_at as h_created_at
        FROM product_history h
        WHERE (h.invoice_no IS NULL OR h.invoice_no = '')
          AND (h.action = 'stock_out' OR h.action = 'sale' OR h.notes LIKE '%during sale%')
      `);

      for (const r of rows) {
        const batchMatch = r.notes ? r.notes.match(/batch\s+([^\s]+)\s+during/i) : null;
        const batch = batchMatch ? batchMatch[1] : null;

        const [matching] = await connection.query(
          `SELECT b.id, b.number, b.cashier, b.created_by_name, u.name as user_name
           FROM bill_items bi
           JOIN bills b ON b.id = bi.bill_id
           JOIN users u ON u.id = b.user_id
           WHERE bi.user_id = ? AND b.number LIKE 'INV-%'
             AND (bi.product_id = ? OR bi.product_id IN (SELECT id FROM product_batches WHERE product_id = ?) ${batch ? 'OR LOWER(TRIM(bi.batch)) = LOWER(TRIM(?))' : ''})
             AND ABS(TIMESTAMPDIFF(SECOND, b.created_at, ?)) <= 60
             AND NOT EXISTS (
               SELECT 1 FROM product_history ph_dup
               WHERE ph_dup.user_id = r.user_id 
                 AND ph_dup.product_id = r.product_id 
                 AND ph_dup.invoice_no = b.number 
                 AND ph_dup.action = 'sale'
             )
           ORDER BY ABS(TIMESTAMPDIFF(SECOND, b.created_at, ?)) ASC
           LIMIT 1`,
          batch
            ? [r.user_id, r.product_id, r.product_id, batch, r.h_created_at, r.h_created_at]
            : [r.user_id, r.product_id, r.product_id, r.h_created_at, r.h_created_at]
        );

        if (matching.length > 0) {
          const m = matching[0];
          const actor = m.created_by_name || m.cashier || m.user_name || "Admin";
          const newNotes = `Sale via ${m.number} by ${actor}`;
          await connection.query(
            `UPDATE product_history 
             SET action = 'sale', invoice_no = ?, notes = ? 
             WHERE id = ?`,
            [m.number, newNotes, r.history_id]
          );
        }
      }
    } catch (e) {
      console.warn("Automated history backfill skipped:", e.message);
    }

    try {
      const [billsToUpdate] = await connection.query(
        "SELECT id, customer_phone FROM bills WHERE customer_phone IS NOT NULL AND customer_phone != ''"
      );
      for (const b of billsToUpdate) {
        const raw = (b.customer_phone || "").trim();
        let s = raw.replace(/^(\+91|\+ 91)\s*[-\s]?/, "");
        let digits = s.replace(/\D/g, "");
        if (digits.length === 12 && digits.startsWith("91")) {
          digits = digits.slice(2);
        } else if (digits.length === 11 && digits.startsWith("0")) {
          digits = digits.slice(1);
        }
        digits = digits.slice(0, 10);
        if (digits.length === 10) {
          const formatted = `+91 ${digits}`;
          if (raw !== formatted) {
            await connection.query("UPDATE bills SET customer_phone = ? WHERE id = ?", [formatted, b.id]);
          }
        } else {
          await connection.query("UPDATE bills SET customer_phone = NULL WHERE id = ?", [b.id]);
        }
      }

      const [paysToUpdate] = await connection.query(
        "SELECT id, customer_phone FROM customer_payments WHERE customer_phone IS NOT NULL AND customer_phone != ''"
      );
      for (const p of paysToUpdate) {
        const raw = (p.customer_phone || "").trim();
        let s = raw.replace(/^(\+91|\+ 91)\s*[-\s]?/, "");
        let digits = s.replace(/\D/g, "");
        if (digits.length === 12 && digits.startsWith("91")) {
          digits = digits.slice(2);
        } else if (digits.length === 11 && digits.startsWith("0")) {
          digits = digits.slice(1);
        }
        digits = digits.slice(0, 10);
        if (digits.length === 10) {
          const formatted = `+91 ${digits}`;
          if (raw !== formatted) {
            await connection.query("UPDATE customer_payments SET customer_phone = ? WHERE id = ?", [formatted, p.id]);
          }
        } else {
          await connection.query("UPDATE customer_payments SET customer_phone = NULL WHERE id = ?", [p.id]);
        }
      }
    } catch (e) {
      console.warn("Customer phone normalization skipped:", e.message);
    }

    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS draft_bills (
          id VARCHAR(64) PRIMARY KEY,
          user_id CHAR(36) NOT NULL,
          name VARCHAR(255) NOT NULL,
          customer_name VARCHAR(190) NULL,
          customer_phone VARCHAR(50) NULL,
          total DECIMAL(12,2) NOT NULL DEFAULT 0,
          draft_type VARCHAR(20) NOT NULL DEFAULT 'sale',
          created_by_name VARCHAR(100) NULL,
          data LONGTEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_draft_bills_user (user_id),
          INDEX idx_draft_bills_updated (user_id, updated_at),
          CONSTRAINT fk_draft_bills_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      try {
        await connection.query(`
          ALTER TABLE draft_bills
          ADD COLUMN draft_type VARCHAR(20) NOT NULL DEFAULT 'sale' AFTER total;
        `);
      } catch (alterErr) {
        if (!alterErr.message.includes("Duplicate column name")) {
          // column already exists, safe to ignore
        }
      }
    } catch (e) {
      console.warn("draft_bills table check skipped:", e.message);
    }

    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS draft_bill_items (
          id VARCHAR(64) PRIMARY KEY,
          draft_id VARCHAR(64) NOT NULL,
          user_id CHAR(36) NOT NULL,
          product_id VARCHAR(64) NULL,
          batch_id VARCHAR(64) NULL,
          batch_no VARCHAR(100) NULL,
          product_name VARCHAR(255) NOT NULL,
          qty DECIMAL(12,4) NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_draft_items_draft (draft_id),
          INDEX idx_draft_items_user_prod (user_id, product_id),
          INDEX idx_draft_items_user_batch (user_id, product_id, batch_no),
          CONSTRAINT fk_draft_items_draft FOREIGN KEY (draft_id) REFERENCES draft_bills(id) ON DELETE CASCADE,
          CONSTRAINT fk_draft_items_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Repair any existing negative stock
      await connection.query("UPDATE product_batches SET available_qty = 0.00 WHERE available_qty < 0;");

      // Backfill draft_bill_items for existing draft_bills if needed
      const [existingDrafts] = await connection.query("SELECT id, user_id, data FROM draft_bills");
      for (const d of existingDrafts) {
        const [cnt] = await connection.query("SELECT COUNT(*) AS c FROM draft_bill_items WHERE draft_id = ?", [d.id]);
        if (cnt[0]?.c === 0 && d.data) {
          try {
            const parsed = typeof d.data === "string" ? JSON.parse(d.data) : d.data;
            const items = Array.isArray(parsed?.items) ? parsed.items : [];
            for (const item of items) {
              const rawId = (item.productId && String(item.productId).trim()) ||
                            (item.product_id && String(item.product_id).trim()) ||
                            (item.product?.id && String(item.product.id).trim()) || null;
              const rawName = (item.name && String(item.name).trim()) ||
                              (item.product?.name && String(item.product.name).trim()) || "Unknown Product";
              const rawBatch = (item.batch && String(item.batch).trim()) ||
                               (item.product?.batch && String(item.product.batch).trim()) || null;
              const itemQty = Math.abs(Number(item.qty || 0)) + Math.abs(Number(item.freeQty || item.free_qty || 0));

              if (itemQty <= 0) continue;

              let targetProductId = null;
              let targetBatchId = null;
              let targetBatchNo = rawBatch;

              if (rawId) {
                const [pCheck] = await connection.query("SELECT id FROM products WHERE user_id = ? AND id = ? LIMIT 1", [d.user_id, rawId]);
                if (pCheck.length > 0) {
                  targetProductId = pCheck[0].id;
                } else {
                  const [bCheck] = await connection.query(
                    "SELECT b.id, b.product_id, b.batch_no FROM product_batches b JOIN products p ON b.product_id = p.id WHERE p.user_id = ? AND b.id = ? LIMIT 1",
                    [d.user_id, rawId]
                  );
                  if (bCheck.length > 0) {
                    targetBatchId = bCheck[0].id;
                    targetProductId = bCheck[0].product_id;
                    if (!targetBatchNo) targetBatchNo = bCheck[0].batch_no;
                  }
                }
              }

              if (!targetProductId && rawName) {
                const [pMatch] = await connection.query(
                  "SELECT id FROM products WHERE user_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1",
                  [d.user_id, rawName]
                );
                if (pMatch.length > 0) targetProductId = pMatch[0].id;
              }

              if (targetProductId && targetBatchNo && !targetBatchId) {
                const [bMatch] = await connection.query(
                  "SELECT id, batch_no FROM product_batches WHERE product_id = ? AND LOWER(TRIM(batch_no)) = LOWER(TRIM(?)) LIMIT 1",
                  [targetProductId, targetBatchNo]
                );
                if (bMatch.length > 0) {
                  targetBatchId = bMatch[0].id;
                  targetBatchNo = bMatch[0].batch_no;
                }
              }

              const itemId = `dbi_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
              await connection.query(
                `INSERT INTO draft_bill_items (id, draft_id, user_id, product_id, batch_id, batch_no, product_name, qty)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [itemId, d.id, d.user_id, targetProductId, targetBatchId, targetBatchNo, rawName, itemQty]
              );
            }
          } catch (itemErr) {
            console.warn(`Draft ${d.id} items backfill failed:`, itemErr.message);
          }
        }
      }
    } catch (e) {
      console.warn("draft_bill_items check skipped:", e.message);
    }

    console.log("MySQL migration completed successfully.");
  } finally {
    await connection.end();
  }
}

runMigration().catch((error) => {
  console.error("MySQL migration failed:", error.message);
  process.exit(1);
});
