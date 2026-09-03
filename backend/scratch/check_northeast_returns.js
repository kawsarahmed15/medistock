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
    const userId = '220a9129-0129-4efc-aa51-4a2096c617a8';
    const srIds = ['17435c5d-413c-4229-acbf-4a084f81f961', '1bebbdba-3f2f-471c-8f27-ccd6c61bba03'];

    // Check all tables for references
    const [tables] = await conn.query("SHOW TABLES");
    const tableKey = Object.keys(tables[0])[0];

    for (const tRow of tables) {
      const tableName = tRow[tableKey];
      const [cols] = await conn.query(`DESCRIBE \`${tableName}\``);
      const colNames = cols.map(c => c.Field);
      
      for (const col of colNames) {
        if (col.includes('bill') || col.includes('invoice') || col.includes('notes')) {
          for (const srId of srIds) {
            const [matches] = await conn.query(
              `SELECT * FROM \`${tableName}\` WHERE \`${col}\` LIKE ?`,
              [`%${srId}%`]
            );
            if (matches.length > 0) {
              console.log(`Match in ${tableName}.${col}:`, matches);
            }
          }
        }
      }
    }

    // Check customer_payments or credit tables
    const [payments] = await conn.query(
      "SELECT * FROM customer_payments WHERE user_id = ?",
      [userId]
    );
    console.log("Customer payments count:", payments.length);

  } finally {
    await conn.end();
  }
}

main().catch(console.error);
