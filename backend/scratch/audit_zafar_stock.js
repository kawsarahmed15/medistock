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

    const [products] = await conn.query(
      `SELECT p.id, p.name, p.category, p.pack, p.sku, p.tax_percent,
              SUM(b.available_qty) as total_qty,
              COUNT(b.id) as batch_count
       FROM products p
       LEFT JOIN product_batches b ON p.id = b.product_id
       WHERE p.user_id = ?
       GROUP BY p.id
       ORDER BY p.name ASC`,
      [user.id]
    );

    console.log(`Total Products for zafar: ${products.length}`);

    const [allBatches] = await conn.query(
      `SELECT b.id as batch_id, b.batch_no, b.expiry_date, b.purchase_price, b.mrp, b.selling_price, b.available_qty, b.sku as batch_sku,
              p.id as product_id, p.name as product_name, p.category, p.pack as product_pack, p.sku as product_sku, p.tax_percent
       FROM product_batches b
       JOIN products p ON b.product_id = p.id
       WHERE p.user_id = ?
       ORDER BY p.name ASC, b.batch_no ASC`,
      [user.id]
    );

    console.log(`Total Batches for zafar: ${allBatches.length}`);

    // Check batches with available_qty > 0
    const activeBatches = allBatches.filter(b => b.available_qty > 0);
    console.log(`Batches with available_qty > 0: ${activeBatches.length}`);

    // Calculate total values for activeBatches
    let activeSubtotal = 0;
    let activeTax = 0;
    let activeQty = 0;

    activeBatches.forEach(b => {
      const qty = b.available_qty;
      const cost = Number(b.purchase_price || 0);
      const taxRate = Number(b.tax_percent || 0);
      const lineSubtotal = qty * cost;
      const lineTax = lineSubtotal * (taxRate / 100);

      activeQty += qty;
      activeSubtotal += lineSubtotal;
      activeTax += lineTax;
    });

    console.log(`Active Batches Total Qty: ${activeQty}`);
    console.log(`Active Batches Subtotal: ₹${activeSubtotal.toFixed(2)}`);
    console.log(`Active Batches Tax: ₹${activeTax.toFixed(2)}`);
    console.log(`Active Batches Total: ₹${(activeSubtotal + activeTax).toFixed(2)}`);

    // Now calculate for ALL batches (if qty is 0, we can use 0 or initial quantity)
    // Wait, let's also check if there are 0-qty batches that were created as placeholders
    const zeroBatches = allBatches.filter(b => b.available_qty <= 0);
    console.log(`Zero Qty Batches: ${zeroBatches.length}`);
    if (zeroBatches.length > 0) {
      console.log('Sample zero qty batches:', zeroBatches.slice(0, 5).map(b => `${b.product_name} (${b.batch_no})`));
    }

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
