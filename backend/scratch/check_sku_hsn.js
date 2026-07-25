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
    const [users] = await conn.query(`SELECT id FROM users WHERE email = 'northeastdrugdistributor@gmail.com'`);
    const userId = users[0].id;

    const [products] = await conn.query(
      `SELECT p.id, p.name, p.sku as product_sku
       FROM products p WHERE p.user_id = ?`,
      [userId]
    );

    console.log(`Total Products: ${products.length}`);
    let productsWithSku = 0;
    for (const p of products) {
      if (p.product_sku) productsWithSku++;
    }
    console.log(`Products with SKU: ${productsWithSku}/${products.length}`);

    const [batches] = await conn.query(
      `SELECT b.id, b.batch_no, b.sku as batch_sku, p.name as product_name, p.sku as product_sku
       FROM product_batches b
       JOIN products p ON b.product_id = p.id
       WHERE p.user_id = ?`,
      [userId]
    );

    console.log(`\nTotal Batches: ${batches.length}`);
    let batchesWithSku = 0;
    for (const b of batches) {
      if (b.batch_sku) batchesWithSku++;
      console.log(`Batch: ${b.batch_no} | Product: "${b.product_name}" | Batch SKU: "${b.batch_sku}" | Product SKU: "${b.product_sku}"`);
    }
    console.log(`Batches with batch_sku: ${batchesWithSku}/${batches.length}`);

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
