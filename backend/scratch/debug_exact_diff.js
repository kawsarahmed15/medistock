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
    const userId = users[0].id;

    // Get latest purchase
    const [purchases] = await conn.query(
      `SELECT * FROM purchases WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (purchases.length === 0) {
      console.log('No purchases found');
      return;
    }

    const latestPur = purchases[0];
    console.log(`Latest Purchase: ${latestPur.id}, Total: ${latestPur.total}, Subtotal: ${latestPur.subtotal}, Tax: ${latestPur.tax}, Discount: ${latestPur.discount}`);

    // Get items of latest purchase
    const [items] = await conn.query(
      `SELECT * FROM purchase_items WHERE purchase_id = ?`,
      [latestPur.id]
    );

    let billItemsLandedTotal = 0;
    let billItemsBaseTotal = 0;

    console.log(`\nItems in Latest Purchase Bill:`);
    for (const item of items) {
      const baseLine = Number(item.cost_price) * Number(item.qty);
      const taxLine = (baseLine * Number(item.tax_percent)) / 100;
      const landedLine = baseLine + taxLine;
      billItemsBaseTotal += baseLine;
      billItemsLandedTotal += landedLine;
      console.log(`- ${item.name}: Qty=${item.qty}, Free=${item.free_qty}, Cost=${item.cost_price}, Tax=${item.tax_percent}%, BaseLine=${baseLine.toFixed(2)}, LandedLine=${landedLine.toFixed(2)}`);

      // Check corresponding batch
      if (item.product_id) {
        const batchNo = item.batch ? String(item.batch).trim() : 'DEFAULT';
        const [batches] = await conn.query(
          `SELECT * FROM product_batches WHERE product_id = ? AND batch_no = ?`,
          [item.product_id, batchNo]
        );
        if (batches.length > 0) {
          const b = batches[0];
          const batchValue = Number(b.purchase_price) * Number(b.available_qty);
          console.log(`  -> Batch in DB: purchase_price=${b.purchase_price}, available_qty=${b.available_qty}, BatchStockValue=${batchValue.toFixed(2)} (Diff from LandedLine: ${(batchValue - landedLine).toFixed(2)})`);
        }
      }
    }

    console.log(`\nBill Items Base Total: ${billItemsBaseTotal.toFixed(2)}`);
    console.log(`Bill Items Landed Total (Base + Tax): ${billItemsLandedTotal.toFixed(2)}`);
    console.log(`Purchase Bill Header Total Column: ${latestPur.total}`);

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
