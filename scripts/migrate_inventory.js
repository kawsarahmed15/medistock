import { pool } from '../backend/src/db.js';

async function run() {
  try {
    // Check if columns exist in products
    const [cols] = await pool.query('DESCRIBE products');
    const colNames = cols.map(c => c.Field);

    const newColumns = [
      'medicine_type VARCHAR(50) DEFAULT "Tablet"',
      'tablets_per_strip INT DEFAULT 10',
      'strips_per_box INT DEFAULT 10',
      'mrp_per_tablet NUMERIC(12,2)',
      'mrp_per_strip NUMERIC(12,2)',
      'mrp_per_box NUMERIC(12,2)'
    ];

    for (const colDef of newColumns) {
      const colName = colDef.split(' ')[0];
      if (!colNames.includes(colName)) {
        console.log(`Adding column: ${colName}`);
        await pool.query(`ALTER TABLE products ADD COLUMN ${colDef}`);
      }
    }

    // Also add to bill_items
    const [billCols] = await pool.query('DESCRIBE bill_items');
    const billColNames = billCols.map(c => c.Field);
    
    if (!billColNames.includes('unit_sold')) {
      console.log('Adding unit_sold to bill_items');
      await pool.query('ALTER TABLE bill_items ADD COLUMN unit_sold VARCHAR(20) DEFAULT "Tablet"');
    }
    if (!billColNames.includes('converted_qty')) {
      console.log('Adding converted_qty to bill_items');
      await pool.query('ALTER TABLE bill_items ADD COLUMN converted_qty INT DEFAULT 0');
    }

    // Migrate old products
    console.log('Migrating old products...');
    const [products] = await pool.query('SELECT id, pack FROM products WHERE pack IS NOT NULL AND pack != ""');
    
    for (const p of products) {
      const pack = String(p.pack).toLowerCase().trim(); // e.g. "10x10"
      if (pack.includes('x')) {
        const parts = pack.split('x');
        const strips = parseInt(parts[0], 10) || 10;
        const tablets = parseInt(parts[1], 10) || 10;
        
        await pool.query(
          'UPDATE products SET medicine_type = ?, strips_per_box = ?, tablets_per_strip = ? WHERE id = ?',
          ['Tablet', strips, tablets, p.id]
        );
      }
    }
    
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

run();
