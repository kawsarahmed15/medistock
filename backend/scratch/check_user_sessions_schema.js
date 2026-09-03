import dotenv from "dotenv";
dotenv.config();
import mysql from "mysql2/promise";
import { config } from "../src/config.js";

async function main() {
  const conn = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
  });

  try {
    const [cols] = await conn.query("DESCRIBE user_sessions");
    console.log("user_sessions schema:");
    console.dir(cols, { depth: null });
  } finally {
    await conn.end();
  }
}

main().catch(console.error);
