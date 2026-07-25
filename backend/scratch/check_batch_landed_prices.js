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
    // Check purchase_items with tax_percent > 0
    const [items] = await conn.query(
      `SELECT pi.name, pi.cost_price, pi.tax_percent, pi.batch, pi.qty, pi.free_qty, pi.product_id
       FROM purchase_items pi
       WHERE pi.tax_percent > 0
       LIMIT 10`
    );

    console.log('Sample purchase items with tax > 0:');
    items.forEach((it) => {
      const cost = Number(it.cost_price || 0);
      const tax = Number(it.tax_percent || 0);
      const qty = Number(it.qty || 0);
      const free = Number(it.free_qty || 0);
      const totalCost = cost * qty * (1 + tax / 100);
      const totalUnits = qty + free;
      const landed = totalUnits > 0 ? totalCost / totalUnits : cost * (1 + tax / 100);

      console.log(`Item: ${it.name} | Batch: ${it.batch} | Base Cost: ${cost} | Tax: ${tax}% | Landed Cost: ${landed.toFixed(2)}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
