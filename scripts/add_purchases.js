require('dotenv').config({ path: 'backend/.env' });
const mysql = require('mysql2/promise');

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'tekl_medistock',
    password: process.env.MYSQL_PASSWORD || 'medistock',
    database: process.env.MYSQL_DATABASE || 'tekl_medistock',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  try {
    console.log('Creating purchases table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id VARCHAR(36) PRIMARY KEY,
        number VARCHAR(50) NOT NULL UNIQUE,
        supplier_name VARCHAR(100),
        supplier_phone VARCHAR(20),
        supplier_invoice VARCHAR(100),
        notes TEXT,
        subtotal DECIMAL(10,2) NOT NULL,
        tax DECIMAL(10,2) NOT NULL,
        discount DECIMAL(10,2) NOT NULL DEFAULT 0,
        total DECIMAL(10,2) NOT NULL,
        payment_status VARCHAR(20) DEFAULT 'unpaid',
        payment_method VARCHAR(20) DEFAULT 'cash',
        amount_paid DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(100)
      )
    `);

    console.log('Creating purchase_items table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchase_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        purchase_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(50),
        qty INT NOT NULL,
        free_qty INT DEFAULT 0,
        cost_price DECIMAL(10,2) NOT NULL,
        mrp DECIMAL(10,2),
        tax_percent DECIMAL(5,2) DEFAULT 0,
        batch VARCHAR(50),
        expiry DATE,
        pack VARCHAR(50),
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
      )
    `);

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
