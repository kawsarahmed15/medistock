import { pool } from "../src/db.js";

async function checkProducts() {
  try {
    const prodIds = [
      'dec7b441-36cf-4250-8172-648610e17a57', // from INV-0067 / INV-0068 (ACEFLICK SP TAB)
      'a04ec1c5-095b-4701-9826-661dcc589a73', // from INV-0068 (CHYMOEDGE FORTE TAB)
      'b03da691-89fd-47f6-b60e-29c5416b3a29', // from INV-0069 (FOLCAIN GEL)
      '097b74b5-a4a3-4701-9ade-267dfac00641', // from INV-0069 (K PORT RL)
      '939c2396-2a97-46d9-8392-e109d55e3076'  // from INV-0069 (DNS BIOPORT)
    ];

    for (const id of prodIds) {
      const [p] = await pool.query("SELECT * FROM products WHERE id = ?", [id]);
      const [b] = await pool.query("SELECT * FROM product_batches WHERE id = ?", [id]);
      console.log(`\nID: ${id}`);
      console.log("In products table:", p);
      console.log("In product_batches table:", b);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkProducts();
