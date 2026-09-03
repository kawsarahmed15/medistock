import { pool } from "../src/db.js";

async function inspect() {
  try {
    const productId = "0253e565-fe8b-4161-8aaf-ab7956ab959c";
    
    console.log(`\n=== BILL ITEMS for ${productId} ===`);
    const [bItems] = await pool.query(
      "SELECT bi.*, b.number, b.customer_name, b.created_at as bill_date FROM bill_items bi JOIN bills b ON bi.bill_id = b.id WHERE bi.product_id = ?",
      [productId]
    );
    console.log(JSON.stringify(bItems, null, 2));

    console.log(`\n=== ALL BILLS FOR THIS USER ===`);
    const [bills] = await pool.query(
      "SELECT id, number, customer_name, total, created_at FROM bills WHERE user_id = '220a9129-0129-4efc-aa51-4a2096c617a8' ORDER BY created_at DESC LIMIT 10"
    );
    console.log(JSON.stringify(bills, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

inspect();
