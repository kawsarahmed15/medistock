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
    if (users.length === 0) {
      console.log(`User ${email} not found!`);
      return;
    }
    const user = users[0];
    console.log(`Target User ID: ${user.id}, Email: ${user.email}, Name: ${user.name}`);

    // Get list of all tables in the database
    const [tables] = await conn.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?`,
      [config.mysql.database]
    );

    console.log('\n--- DATA COUNT FOR USER ---');
    for (const t of tables) {
      const tableName = t.TABLE_NAME;
      // Check columns of table
      const [cols] = await conn.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [config.mysql.database, tableName]
      );
      const colNames = cols.map(c => c.COLUMN_NAME);

      if (colNames.includes('user_id')) {
        const [cnt] = await conn.query(`SELECT COUNT(*) as count FROM \`${tableName}\` WHERE user_id = ?`, [user.id]);
        console.log(`Table '${tableName}': ${cnt[0].count} records (via user_id)`);
      } else if (tableName === 'product_batches') {
        const [cnt] = await conn.query(
          `SELECT COUNT(*) as count FROM product_batches b JOIN products p ON b.product_id = p.id WHERE p.user_id = ?`,
          [user.id]
        );
        console.log(`Table '${tableName}': ${cnt[0].count} records (via product_id)`);
      } else if (tableName === 'users') {
        console.log(`Table 'users': 1 user record (ID: ${user.id})`);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await conn.end();
  }
}

main();
