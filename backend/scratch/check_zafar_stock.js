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
    if (users.length === 0) {
      console.log(`User ${email} not found!`);
      return;
    }
    const user = users[0];
    console.log('--- USER ---');
    console.log({ id: user.id, name: user.name, email: user.email, pharmacy_name: user.pharmacy_name });

    const [products] = await conn.query('SELECT * FROM products WHERE user_id = ?', [user.id]);
    console.log(`\n--- PRODUCTS (${products.length}) ---`);
    console.log(products);

    const [batches] = await conn.query(
      `SELECT b.*, p.name as product_name, p.category, p.tax_percent
       FROM product_batches b
       JOIN products p ON b.product_id = p.id
       WHERE p.user_id = ?`,
      [user.id]
    );
    console.log(`\n--- PRODUCT BATCHES (${batches.length}) ---`);
    console.log(batches);

    const [purchases] = await conn.query('SELECT * FROM purchases WHERE user_id = ? ORDER BY created_at ASC', [user.id]);
    console.log(`\n--- PURCHASES (${purchases.length}) ---`);
    for (const p of purchases) {
      const [pItems] = await conn.query('SELECT * FROM purchase_items WHERE purchase_id = ?', [p.id]);
      console.log(`Purchase ${p.number} (${p.supplier_name}): total ${p.total}, items: ${pItems.length}`);
      for (const item of pItems) {
        console.log(`  - ${item.name} | Batch: ${item.batch} | Qty: ${item.qty} | Free: ${item.free_qty} | Cost: ${item.cost_price} | MRP: ${item.mrp} | Expiry: ${item.expiry}`);
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await conn.end();
  }
}

main();
