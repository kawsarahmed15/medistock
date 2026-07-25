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

    const [maxPo] = await conn.query(
      `SELECT MAX(CAST(SUBSTRING_INDEX(number, '-', -1) AS UNSIGNED)) AS maxNo
       FROM purchases
       WHERE user_id = ? AND number LIKE 'PO-%'`,
      [user.id]
    );
    console.log('Current max PO number:', maxPo[0]?.maxNo);

    // Get all product batches with available_qty > 0 or all batches?
    const [batchesWithQty] = await conn.query(
      `SELECT b.*, p.name as product_name, p.category, p.tax_percent, p.pack as product_pack, p.sku as product_sku
       FROM product_batches b
       JOIN products p ON b.product_id = p.id
       WHERE p.user_id = ? AND b.available_qty > 0
       ORDER BY p.name ASC, b.batch_no ASC`,
      [user.id]
    );

    const [allBatches] = await conn.query(
      `SELECT b.*, p.name as product_name, p.category, p.tax_percent, p.pack as product_pack, p.sku as product_sku
       FROM product_batches b
       JOIN products p ON b.product_id = p.id
       WHERE p.user_id = ?
       ORDER BY p.name ASC, b.batch_no ASC`,
      [user.id]
    );

    console.log(`Batches with available_qty > 0: ${batchesWithQty.length}`);
    console.log(`All Batches (including 0 qty): ${allBatches.length}`);

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
