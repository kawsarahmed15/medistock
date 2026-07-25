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

    const [history] = await conn.query(
      `SELECT h.*, p.name as product_name
       FROM product_history h
       JOIN products p ON h.product_id = p.id
       WHERE h.user_id = ?
       ORDER BY h.created_at DESC LIMIT 50`,
      [user.id]
    );

    console.log(`Product History entries: ${history.length}`);
    console.log(history.slice(0, 15));

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
