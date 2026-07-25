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

    // Recalculate purchase_price for all purchase_items
    const [items] = await conn.query(
      `SELECT pi.*, p.name as product_name
       FROM purchase_items pi
       LEFT JOIN products p ON pi.product_id = p.id
       WHERE pi.cost_price > 0`
    );

    for (const item of items) {
      if (!item.product_id) continue;
      const costPriceVal = Number(item.cost_price || 0);
      const taxPercentVal = Number(item.tax_percent || 0);
      const qtyVal = Number(item.qty || 0);
      const freeQtyVal = Number(item.free_qty || 0);
      const totalUnitsVal = qtyVal + freeQtyVal;
      
      // Line total with GST rounded to 2 decimal places (exact bill line amount)
      const baseLineTotal = Number((costPriceVal * qtyVal).toFixed(2));
      const lineTax = Number(((baseLineTotal * taxPercentVal) / 100).toFixed(2));
      const lineLandedTotal = baseLineTotal + lineTax;

      const landedPurchasePrice = totalUnitsVal > 0
        ? Number((lineLandedTotal / totalUnitsVal).toFixed(4))
        : Number((costPriceVal * (1 + taxPercentVal / 100)).toFixed(4));
      
      const batchNo = item.batch ? String(item.batch).trim() : 'DEFAULT';

      await conn.query(
        `UPDATE product_batches
         SET purchase_price = ?
         WHERE product_id = ? AND batch_no = ?`,
        [landedPurchasePrice, item.product_id, batchNo]
      );
    }

    // Now recalculate stock value for northeastdrugdistributor@gmail.com rounding each batch line to 2 decimals
    const [batches] = await conn.query(
      `SELECT b.*, p.name as product_name
       FROM product_batches b
       JOIN products p ON b.product_id = p.id
       WHERE p.user_id = ? AND b.available_qty > 0`,
      [userId]
    );

    let batchTotal = 0;
    for (const b of batches) {
      const lineVal = Math.round(Number(b.purchase_price) * Number(b.available_qty) * 100) / 100;
      batchTotal += lineVal;
    }

    console.log(`\nExact Stock Value for northeastdrugdistributor@gmail.com: ${batchTotal.toFixed(2)}`);

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
