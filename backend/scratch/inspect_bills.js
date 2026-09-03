import { pool } from "../src/db.js";

async function inspectBills() {
  try {
    const billNumbers = ['INV-0067', 'INV-0068', 'INV-0069'];
    for (const num of billNumbers) {
      console.log(`\n=== BILL ${num} ===`);
      const [bills] = await pool.query("SELECT * FROM bills WHERE number = ? AND user_id = '220a9129-0129-4efc-aa51-4a2096c617a8'", [num]);
      console.log("Bill:", bills[0]);
      if (bills[0]) {
        const [items] = await pool.query("SELECT bi.*, p.name as prod_name FROM bill_items bi LEFT JOIN products p ON bi.product_id = p.id WHERE bi.bill_id = ?", [bills[0].id]);
        console.log("Items:", items);
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

inspectBills();
