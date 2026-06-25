import { app } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db.js";
// import { verifySmtpConnection } from "./services/email.js";

async function bootstrap() {
  await pool.query("SELECT 1");
  // await verifySmtpConnection();

  app.listen(config.port, () => {
    console.log(`MediStock backend running on port ${config.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
