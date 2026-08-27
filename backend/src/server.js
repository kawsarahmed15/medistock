import { app } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db.js";
// import { verifySmtpConnection } from "./services/email.js";

async function bootstrap() {
  await pool.query("SELECT 1");
  // await verifySmtpConnection();

  // Run schema migration for user_sessions
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        session_id VARCHAR(50) NOT NULL UNIQUE,
        device_os VARCHAR(100) NULL,
        device_browser VARCHAR(100) NULL,
        ip_address VARCHAR(45) NULL,
        is_admin TINYINT(1) NOT NULL DEFAULT 0,
        last_active TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_sessions_user (user_id),
        CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Add is_admin column if not exists
    const [columns] = await pool.query("SHOW COLUMNS FROM user_sessions LIKE 'is_admin'");
    if (columns.length === 0) {
      await pool.query("ALTER TABLE user_sessions ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER ip_address");
      console.log("Added is_admin column to user_sessions table");
    }

    // Add device_id column if not exists
    const [cols] = await pool.query("SHOW COLUMNS FROM user_sessions LIKE 'device_id'");
    if (cols.length === 0) {
      await pool.query("DELETE FROM user_sessions"); // clear old sessions to prevent constraint violations
      await pool.query("ALTER TABLE user_sessions ADD COLUMN device_id VARCHAR(50) NOT NULL AFTER session_id");
      await pool.query("ALTER TABLE user_sessions ADD CONSTRAINT uq_user_device UNIQUE (user_id, device_id)");
      console.log("Added device_id column and unique constraint to user_sessions table");
    }

    // Add admin_device_id column to users table if not exists
    const [usersCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'admin_device_id'");
    if (usersCols.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN admin_device_id VARCHAR(50) NULL");
      console.log("Added admin_device_id column to users table");
    }

    // Add last_user_activity column to user_sessions if not exists
    const [actCols] = await pool.query("SHOW COLUMNS FROM user_sessions LIKE 'last_user_activity'");
    if (actCols.length === 0) {
      await pool.query("ALTER TABLE user_sessions ADD COLUMN last_user_activity TIMESTAMP NULL AFTER is_admin");
      console.log("Added last_user_activity column to user_sessions table");
    }

    // Add status column to user_sessions if not exists
    const [statusCols] = await pool.query("SHOW COLUMNS FROM user_sessions LIKE 'status'");
    if (statusCols.length === 0) {
      await pool.query("ALTER TABLE user_sessions ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active' AFTER last_user_activity");
      console.log("Added status column to user_sessions table");
    }
  } catch (err) {
    console.error("Migration upgrade error:", err);
  }

  app.listen(config.port, () => {
    console.log(`MediStock backend running on port ${config.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
