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
    const [users] = await conn.query(`SELECT id, email FROM users WHERE email = 'northeastdrugdistributor@gmail.com'`);
    if (users.length === 0) {
      console.log('User not found');
      return;
    }
    const userId = users[0].id;
    console.log(`Found user ${userId}`);

    // Get all batches
    const [batches] = await conn.query(
      `SELECT b.*, p.name as product_name, p.tax_percent
       FROM product_batches b
       JOIN products p ON b.product_id = p.id
       WHERE p.user_id = ? AND b.available_qty > 0`,
      [userId]
    );

    let batchTotal = 0;
    console.log(`\nActive Batches with Stock:`);
    for (const b of batches) {
      const val = Number(b.purchase_price) * Number(b.available_qty);
      batchTotal += val;
      console.log(`- Product: ${b.product_name}, Batch: ${b.batch_no}, Qty: ${b.available_qty}, PurchasePrice: ${b.purchase_price}, LineValue: ${val.toFixed(2)}`);
    }
    console.log(`\nTotal Batch Stock Value: ${batchTotal.toFixed(2)}`);

    // Get all products using old frontend logic
    const [products] = await conn.query(
      `SELECT p.id, p.name, p.tax_percent
       FROM products p WHERE p.user_id = ?`,
      [userId]
    );

    let oldFEFOStockValue = 0;
    for (const p of products) {
      const [prodBatches] = await conn.query(
        `SELECT * FROM product_batches WHERE product_id = ? ORDER BY expiry_date ASC`,
        [p.id]
      );
      if (prodBatches.length > 0) {
        const totalStock = prodBatches.reduce((s, b) => s + Number(b.available_qty), 0);
        const stockBatches = prodBatches.filter(b => Number(b.available_qty) > 0);
        const activeBatch = stockBatches.length > 0 ? stockBatches[0] : prodBatches[0];
        const val = Number(activeBatch.purchase_price) * totalStock;
        oldFEFOStockValue += val;
      }
    }
    console.log(`Old FEFO Dashboard Calculated Stock Value: ${oldFEFOStockValue.toFixed(2)}`);

    // Purchases total
    const [purchases] = await conn.query(
      `SELECT id, purchase_number, total, created_at FROM purchases WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    console.log(`\nPurchases List:`);
    let purchasesTotal = 0;
    for (const pur of purchases) {
      purchasesTotal += Number(pur.total);
      console.log(`- ${pur.purchase_number}: Total = ${pur.total}, Date = ${pur.created_at}`);
    }
    console.log(`Sum of all Purchases: ${purchasesTotal.toFixed(2)}`);

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
