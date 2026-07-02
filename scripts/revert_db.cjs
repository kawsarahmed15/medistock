const mysql = require('mysql2/promise');

async function revertDb() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'tekl_medistock',
    password: process.env.DB_PASSWORD || 'O+y#T2z724_E',
    database: process.env.DB_NAME || 'tekl_medistock',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  try {
    console.log('Reverting products table changes...');
    await pool.query(`
      ALTER TABLE products
      DROP COLUMN IF EXISTS medicine_type,
      DROP COLUMN IF EXISTS tablets_per_strip,
      DROP COLUMN IF EXISTS strips_per_box,
      DROP COLUMN IF EXISTS mrp_per_tablet,
      DROP COLUMN IF EXISTS mrp_per_strip,
      DROP COLUMN IF EXISTS mrp_per_box
    `);

    console.log('Reverting bill_items table changes...');
    await pool.query(`
      ALTER TABLE bill_items
      DROP COLUMN IF EXISTS unit_sold,
      DROP COLUMN IF EXISTS converted_qty
    `);

    console.log('Database revert completed successfully.');
  } catch (err) {
    console.error('Migration revert failed:', err);
  } finally {
    await pool.end();
  }
}

revertDb();
