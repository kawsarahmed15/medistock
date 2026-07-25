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

    const [purchases] = await conn.query('SELECT id, number, supplier_name, created_at, total FROM purchases WHERE user_id = ? ORDER BY created_at ASC', [user.id]);
    console.log('Purchases count:', purchases.length);
    purchases.forEach(p => console.log(`${p.number} | Supplier: ${p.supplier_name} | Total: ${p.total} | Date: ${p.created_at}`));

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
