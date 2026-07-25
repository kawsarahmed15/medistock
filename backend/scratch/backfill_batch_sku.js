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
    console.log('Backfilling product_batches.sku from products.sku...');
    const [result] = await conn.query(
      `UPDATE product_batches b
       JOIN products p ON b.product_id = p.id
       SET b.sku = p.sku
       WHERE (b.sku IS NULL OR b.sku = '' OR b.sku = 'null') AND (p.sku IS NOT NULL AND p.sku != '')`
    );
    console.log(`Updated ${result.affectedRows} batches with product HSN/SKU.`);

    // Check count after update
    const [users] = await conn.query(`SELECT id FROM users WHERE email = 'northeastdrugdistributor@gmail.com'`);
    if (users.length > 0) {
      const userId = users[0].id;
      const [batches] = await conn.query(
        `SELECT b.id, b.batch_no, b.sku as batch_sku, p.name as product_name, p.sku as product_sku
         FROM product_batches b
         JOIN products p ON b.product_id = p.id
         WHERE p.user_id = ?`,
        [userId]
      );
      let withSku = batches.filter(b => b.batch_sku && b.batch_sku !== 'null').length;
      console.log(`Batches for user with SKU: ${withSku}/${batches.length}`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
