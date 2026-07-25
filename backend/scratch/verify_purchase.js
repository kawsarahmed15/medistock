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

    const [purchases] = await conn.query('SELECT * FROM purchases WHERE user_id = ? AND number = ?', [user.id, 'PO-0030']);
    if (purchases.length === 0) {
      console.log('Purchase PO-0030 not found!');
      return;
    }

    const purchase = purchases[0];
    const [items] = await conn.query('SELECT * FROM purchase_items WHERE purchase_id = ?', [purchase.id]);

    console.log('=== VERIFICATION OF PO-0030 ===');
    console.log(`Purchase ID: ${purchase.id}`);
    console.log(`PO Number: ${purchase.number}`);
    console.log(`Supplier: ${purchase.supplier_name}`);
    console.log(`Supplier Invoice: ${purchase.supplier_invoice}`);
    console.log(`Subtotal: ₹${purchase.subtotal}`);
    console.log(`Tax: ₹${purchase.tax}`);
    console.log(`Total: ₹${purchase.total}`);
    console.log(`Payment Status: ${purchase.payment_status}`);
    console.log(`Payment Method: ${purchase.payment_method}`);
    console.log(`Total Items Count: ${items.length}`);
    console.log('First 5 Items:', items.slice(0, 5).map(i => `${i.name} (${i.batch}) - Qty: ${i.qty}, Cost: ₹${i.cost_price}, Tax: ${i.tax_percent}%`));

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
