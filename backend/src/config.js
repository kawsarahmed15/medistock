import dotenv from "dotenv";

dotenv.config();

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: toInt(process.env.PORT, 4000),
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "change-me-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: toInt(process.env.MYSQL_PORT, 3306),
    database: process.env.MYSQL_DATABASE || "tekl_medistock",
    user: process.env.MYSQL_USER || "tekl_medistock",
    password: process.env.MYSQL_PASSWORD || "",
  },
  smtp: {
    host: process.env.SMTP_HOST || "medistock.teklin.in",
    port: toInt(process.env.SMTP_PORT, 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "MediStock <no-reply@medistock.teklin.in>",
  },
  corsOrigin: process.env.CORS_ORIGIN || "*",
  ssl: false,
  cashfree: {
    appId: process.env.CASHFREE_APP_ID || "",
    secretKey: process.env.CASHFREE_SECRET_KEY || "",
    env: process.env.CASHFREE_ENV || "sandbox",
    apiVersion: process.env.CASHFREE_API_VERSION || "2023-08-01",
  },
};
