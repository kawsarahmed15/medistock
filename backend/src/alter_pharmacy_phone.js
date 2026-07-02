import { pool } from "./db.js";

async function run() {
  try {
    await pool.query(
      "ALTER TABLE users ADD COLUMN pharmacy_phone VARCHAR(50) NULL AFTER pharmacy_name",
    );
    console.log("Added pharmacy_phone to users");
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME") {
      console.log("Column pharmacy_phone already exists in users.");
    } else {
      console.error(err);
    }
  }
  process.exit(0);
}

run();
