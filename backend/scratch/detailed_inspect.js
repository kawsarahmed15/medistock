import { pool } from "../src/db.js";

async function detailedInspect() {
  try {
    const userId = "220a9129-0129-4efc-aa51-4a2096c617a8";
    
    // 1. CORTIMIST TRIO
    console.log("=== CORTIMIST TRIO DETAILS ===");
    const [cortProd] = await pool.query("SELECT * FROM products WHERE user_id = ? AND name LIKE '%CORTIMIST%'", [userId]);
    console.log("Product:", cortProd);
    if (cortProd.length > 0) {
      const pId = cortProd[0].id;
      const [batches] = await pool.query("SELECT * FROM product_batches WHERE product_id = ?", [pId]);
      console.log("Batches:", batches);
      const [history] = await pool.query("SELECT * FROM product_history WHERE product_id = ? ORDER BY created_at ASC", [pId]);
      console.log("History:", history);
    }

    // 2. Products involved in INV-0067, INV-0068, INV-0069
    const affectedBatchIds = [
      'dec7b441-36cf-4250-8172-648610e17a57', // ACEFLICK SP TAB batch ABT02AKB
      'a04ec1c5-095b-4701-9826-661dcc589a73', // CHYMOEDGE FORTE TAB batch CMO25001
      'b03da691-89fd-47f6-b60e-29c5416b3a29'  // FOLCAIN GEL batch YL-26099C
    ];

    for (const bId of affectedBatchIds) {
      const [batch] = await pool.query("SELECT * FROM product_batches WHERE id = ?", [bId]);
      if (batch[0]) {
        const [prod] = await pool.query("SELECT * FROM products WHERE id = ?", [batch[0].product_id]);
        const [hist] = await pool.query("SELECT * FROM product_history WHERE product_id = ? ORDER BY created_at ASC", [batch[0].product_id]);
        console.log(`\n=== PRODUCT FOR BATCH ${bId} (${prod[0]?.name}) ===`);
        console.log("Batch:", batch[0]);
        console.log("History entries count:", hist.length);
        console.log("History:", hist);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

detailedInspect();
