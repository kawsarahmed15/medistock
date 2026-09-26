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

    console.log("MySQL migration completed successfully.");
  } finally {
    await connection.end();
  }
}

runMigration().catch((error) => {
  console.error("MySQL migration failed:", error.message);
  process.exit(1);
});
