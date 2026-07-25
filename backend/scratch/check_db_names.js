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

    const [products] = await conn.query(
      `SELECT id, name, pack, category, manufacturer FROM products WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );

    console.log(`Product list in DB:`);
    for (const p of products) {
      console.log(`ID: ${p.id} | Name: "${p.name}" | Pack: "${p.pack}" | Cat: "${p.category}"`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
