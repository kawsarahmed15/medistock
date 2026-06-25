import fs from 'fs';
import { pool } from './src/db.js';
import { generateId } from './src/utils.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const csvPath = path.resolve(__dirname, '../CAFOLI_PRODUCTS.csv');
  const data = fs.readFileSync(csvPath, 'utf8');
  
  const lines = data.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  // remove header
  lines.shift();
  
  const userId = '220a9129-0129-4efc-aa51-4a2096c617a8';
  let successCount = 0;
  
  for (const line of lines) {
    // Basic CSV splitting, assuming no quoted commas in this simple file
    const cols = line.split(',');
    if (cols.length < 9) continue;
    
    // SNo,Product,HSN,Pack,Qty,Free,MRP,Rate,GST%,Amount
    // 0    1       2   3    4   5    6   7    8    9
    
    const name = cols[1];
    let qty = parseFloat(cols[4] || '0');
    if (isNaN(qty)) qty = 0;
    
    let mrp = parseFloat(cols[6] || '0');
    if (isNaN(mrp)) mrp = 0;
    
    let rate = parseFloat(cols[7] || '0');
    if (isNaN(rate)) rate = 0;
    
    let gst = parseFloat(cols[8] || '0');
    if (isNaN(gst)) gst = 0;
    
    const id = generateId();
    const expiryDate = '2027-12-31'; // Default expiry date
    
    try {
      await pool.query(
        `INSERT INTO products (id, user_id, name, price, cost_price, stock, expiry, tax_percent, category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, name, mrp, rate, qty, expiryDate, gst, 'General']
      );
      successCount++;
    } catch (err) {
      console.error('Error inserting', name, err.message);
    }
  }
  
  console.log(`Successfully seeded ${successCount} products.`);
  process.exit(0);
}

run();
