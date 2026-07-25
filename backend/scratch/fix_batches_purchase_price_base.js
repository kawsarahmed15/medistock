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
    const [items] = await conn.query(
      `SELECT pi.*, p.name as product_name
       FROM purchase_items pi
       LEFT JOIN products p ON pi.product_id = p.id
       WHERE pi.tax_percent > 0 AND pi.cost_price > 0`
    );

    console.log(`Found ${items.length} purchase items with GST > 0 and cost_price > 0.`);

    let updatedCount = 0;
    for (const item of items) {
      if (!item.product_id) continue;
      const baseCost = Number(item.cost_price || 0);
      const batchNo = item.batch ? String(item.batch).trim() : 'DEFAULT';

      const [res] = await conn.query(
        `UPDATE product_batches
         SET purchase_price = ?
         WHERE product_id = ? AND batch_no = ?`,
        [baseCost, item.product_id, batchNo]
      );

      if (res.affectedRows > 0) {
        updatedCount += res.affectedRows;
        console.log(`Updated Batch '${batchNo}' of Product '${item.name}': Base Purchase Price=${baseCost}`);
      }
    }

    console.log(`Updated base purchase_price for ${updatedCount} product batches.`);

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
