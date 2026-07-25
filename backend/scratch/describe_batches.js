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
    const [cols] = await conn.query(`DESCRIBE product_batches`);
    console.log(cols.filter(c => c.Field === 'purchase_price' || c.Field === 'selling_price' || c.Field === 'mrp'));
  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
