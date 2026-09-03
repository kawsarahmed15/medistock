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
    const [bills] = await conn.query(
      `SELECT id, number, customer_name, customer_phone, subtotal, tax, discount, total, payment_method, status, created_at 
       FROM bills 
       WHERE customer_name LIKE '%NAZRANA%' OR customer_phone = '7002239535'
       ORDER BY created_at DESC`
    );
    console.log(`Found ${bills.length} bills for Nazrana Medical Hall:`);
    console.dir(bills, { depth: null });

    for (const b of bills) {
      const [items] = await conn.query(
        "SELECT * FROM bill_items WHERE bill_id = ?",
        [b.id]
      );
      console.log(`\nItems for Bill ${b.number} (ID: ${b.id}):`);
      console.dir(items, { depth: null });
    }
  } finally {
    await conn.end();
  }
}

main().catch(console.error);
