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
    await safeAddColumn("bills", "approved_at", "TIMESTAMP NULL AFTER created_by_role");
    await safeAddColumn("bills", "approved_by", "VARCHAR(100) NULL AFTER approved_at");

    console.log("MySQL migration completed successfully.");
  } finally {
    await connection.end();
  }
}

runMigration().catch((error) => {
  console.error("MySQL migration failed:", error.message);
  process.exit(1);
});
