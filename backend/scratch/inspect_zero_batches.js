import mysql from 'mysql2/promise';
import { config } from '../src/config.js';

async function main() {
  const conn = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
  });

  try {
    const email = 'zafarmohammadekbal@gmail.com';
    const [users] = await conn.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    const user = users[0];

    const [zeroBatches] = await conn.query(
      `SELECT b.*, p.name as product_name, p.category, p.tax_percent
       FROM product_batches b
       JOIN products p ON b.product_id = p.id
       WHERE p.user_id = ? AND b.available_qty <= 0
       ORDER BY p.name ASC`,
      [user.id]
    );

    console.log(`Zero Qty Batches (${zeroBatches.length}):`);
    zeroBatches.forEach(b => {
      console.log(`Prod: ${b.product_name} | Batch: ${b.batch_no} | Price: ${b.purchase_price} | MRP: ${b.mrp} | Created: ${b.created_at}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
