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
    // Find all purchase_items with tax_percent > 0
    const [items] = await conn.query(
      `SELECT pi.*, p.name as product_name
       FROM purchase_items pi
       LEFT JOIN products p ON pi.product_id = p.id
       WHERE pi.tax_percent > 0`
    );

    console.log(`Found ${items.length} purchase items with GST > 0.`);

    let updatedCount = 0;
    for (const item of items) {
      if (!item.product_id) continue;
      const cost = Number(item.cost_price || 0);
      const tax = Number(item.tax_percent || 0);
      const qty = Number(item.qty || 0);
      const free = Number(item.free_qty || 0);
      const totalUnits = qty + free;
      const totalLineCost = cost * qty * (1 + tax / 100);
      const landedPrice = totalUnits > 0 ? Number((totalLineCost / totalUnits).toFixed(2)) : Number((cost * (1 + tax / 100)).toFixed(2));

      const batchNo = item.batch ? String(item.batch).trim() : 'DEFAULT';

      // Update matching batch's purchase_price to landedPrice
      const [res] = await conn.query(
        `UPDATE product_batches
         SET purchase_price = ?
         WHERE product_id = ? AND batch_no = ?`,
        [landedPrice, item.product_id, batchNo]
      );

      if (res.affectedRows > 0) {
        updatedCount += res.affectedRows;
        console.log(`Updated Batch '${batchNo}' of Product '${item.name}': Base=${cost}, Tax=${tax}%, Landed=${landedPrice}`);
      }
    }

    console.log(`Updated purchase_price for ${updatedCount} existing product batches.`);

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
