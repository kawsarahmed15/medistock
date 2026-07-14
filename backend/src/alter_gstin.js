import dotenv from "dotenv";
dotenv.config();
import { pool } from "./db.js";

async function main() {
  const db = await pool.getConnection();
  try {
    await db.query("ALTER TABLE bills ADD COLUMN customer_gstin VARCHAR(50) NULL");
    console.log("Added customer_gstin to bills");
  } catch (err) {
    if (err.code !== "ER_DUP_FIELDNAME") console.error(err);
  }
  db.release();
  process.exit(0);
}
main();
