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
