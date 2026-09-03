import { pool } from "../src/db.js";

async function testBackfill() {
  try {
    const [rows] = await pool.query(
      `SELECT id, notes FROM product_history WHERE notes IS NOT NULL`
    );
    console.log(`Found ${rows.length} product_history rows.`);

    for (const r of rows) {
      const match = r.notes ? r.notes.match(/(INV|SR|PO|INIT)-[A-Za-z0-9]+/i) : null;
      if (match) {
        console.log(`ID ${r.id}: extracted "${match[0]}" from "${r.notes}"`);
      } else {
        console.log(`ID ${r.id}: no invoice in "${r.notes}"`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testBackfill();
