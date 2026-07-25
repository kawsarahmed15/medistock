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
    console.log('Altering product_batches.purchase_price to DECIMAL(14,4)...');
    await conn.query(`ALTER TABLE product_batches MODIFY COLUMN purchase_price DECIMAL(14,4) NOT NULL DEFAULT 0.0000`);

    console.log('Altering purchase_items.cost_price to DECIMAL(14,4)...');
    await conn.query(`ALTER TABLE purchase_items MODIFY COLUMN cost_price DECIMAL(14,4) NOT NULL DEFAULT 0.0000`);

    // Recalculate landed purchase_price for all purchase_items with 4 decimal places
    const [items] = await conn.query(
      `SELECT pi.*, p.name as product_name
       FROM purchase_items pi
       LEFT JOIN products p ON pi.product_id = p.id
       WHERE pi.cost_price > 0`
    );

    console.log(`Recalculating landed purchase_price for ${items.length} purchase items...`);
    for (const item of items) {
      if (!item.product_id) continue;
      const costPriceVal = Number(item.cost_price || 0);
      const taxPercentVal = Number(item.tax_percent || 0);
      const qtyVal = Number(item.qty || 0);
      const freeQtyVal = Number(item.free_qty || 0);
      const totalUnitsVal = qtyVal + freeQtyVal;
      const totalLineCostVal = costPriceVal * qtyVal * (1 + taxPercentVal / 100);
      const landedPurchasePrice = totalUnitsVal > 0
        ? Number((totalLineCostVal / totalUnitsVal).toFixed(4))
        : Number((costPriceVal * (1 + taxPercentVal / 100)).toFixed(4));
      
      const batchNo = item.batch ? String(item.batch).trim() : 'DEFAULT';

      await conn.query(
        `UPDATE product_batches
         SET purchase_price = ?
         WHERE product_id = ? AND batch_no = ?`,
        [landedPurchasePrice, item.product_id, batchNo]
      );
    }

    // Now recalculate stock value for northeastdrugdistributor@gmail.com
    const [users] = await conn.query(`SELECT id FROM users WHERE email = 'northeastdrugdistributor@gmail.com'`);
    if (users.length > 0) {
      const userId = users[0].id;
      const [batches] = await conn.query(
        `SELECT b.*, p.name as product_name
         FROM product_batches b
         JOIN products p ON b.product_id = p.id
         WHERE p.user_id = ? AND b.available_qty > 0`,
        [userId]
      );

      let batchTotal = 0;
      for (const b of batches) {
        batchTotal += Number(b.purchase_price) * Number(b.available_qty);
      }
      console.log(`\nNew Stock Value for northeastdrugdistributor@gmail.com: ${batchTotal.toFixed(2)}`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
