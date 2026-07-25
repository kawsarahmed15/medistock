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

    const [allBatches] = await conn.query(
      `SELECT b.*, p.name as product_name, p.category, p.tax_percent, p.pack as product_pack, p.sku as product_sku
       FROM product_batches b
       JOIN products p ON b.product_id = p.id
       WHERE p.user_id = ?
       ORDER BY p.name ASC, b.created_at ASC`,
      [user.id]
    );

    console.log(`Total batches for user: ${allBatches.length}`);

    let totalQtyAll = 0;
    let totalQtyAvail = 0;
    let subtotalAll = 0;
    let taxAll = 0;

    allBatches.forEach((b, idx) => {
      const qty = b.available_qty;
      const cost = Number(b.purchase_price || 0);
      const taxPct = Number(b.tax_percent || 0);
      const itemSubtotal = qty * cost;
      const itemTax = itemSubtotal * (taxPct / 100);

      totalQtyAll += qty;
      if (qty > 0) totalQtyAvail += qty;
      subtotalAll += itemSubtotal;
      taxAll += itemTax;
    });

    console.log(`Total Qty (all batches): ${totalQtyAll}`);
    console.log(`Total Qty (available > 0): ${totalQtyAvail}`);
    console.log(`Calculated Subtotal (all batches): ${subtotalAll.toFixed(2)}`);
    console.log(`Calculated Tax (all batches): ${taxAll.toFixed(2)}`);
    console.log(`Calculated Total: ${(subtotalAll + taxAll).toFixed(2)}`);

    console.log('\n--- ALL BATCHES SUMMARY ---');
    allBatches.forEach(b => {
      console.log(`Prod: ${b.product_name} | Batch: ${b.batch_no} | Qty: ${b.available_qty} | Purchase Price: ${b.purchase_price} | MRP: ${b.mrp} | Tax: ${b.tax_percent}% | Expiry: ${b.expiry_date}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
