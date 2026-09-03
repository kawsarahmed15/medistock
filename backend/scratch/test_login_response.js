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
    const [users] = await conn.query("SELECT id, name, email, is_verified, role FROM users");
    console.log("Registered users in DB:");
    console.dir(users, { depth: null });

    const [employees] = await conn.query("SELECT id, user_id, name, username, status FROM employees");
    console.log("\nRegistered employees in DB:");
    console.dir(employees, { depth: null });

  } finally {
    await conn.end();
  }
}

main().catch(console.error);
