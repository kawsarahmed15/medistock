import dotenv from "dotenv";
dotenv.config();
import { pool } from "./db.js";

async function main() {
  const db = await pool.getConnection();
  try {
    await db.query("ALTER TABLE users ADD COLUMN drug_lic_no VARCHAR(100) NULL");
    console.log("Added drug_lic_no to users");
  } catch (err) {
    if (err.code !== "ER_DUP_FIELDNAME") console.error(err);
  }

  try {
    await db.query("ALTER TABLE bills ADD COLUMN customer_drug_lic_no VARCHAR(100) NULL");
    console.log("Added customer_drug_lic_no to bills");
  } catch (err) {
    if (err.code !== "ER_DUP_FIELDNAME") console.error(err);
  }
  db.release();
  process.exit(0);
}
main();
