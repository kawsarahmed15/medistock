import mysql from "mysql2/promise";
import { config } from "../src/config.js";

async function run() {
  const conn = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
  });

  try {
    await conn.beginTransaction();

    console.log("=== STEP 1: Deleting 6 fake product_history records for INV-0087 ===");
    const fakeHistoryIds = [
      "530188cc-cd07-4411-8060-f793b64dd77a", // BILASTUFF M TAB
      "31d7cd8f-bcef-4ca7-88d3-31e3cdf0c2df", // NUROSLIDE PLUS SOFTCAP
      "a2f885eb-fc1c-462f-940b-b1e278c30fea", // ACEFLICK SP TAB
      "441cc8b7-3eac-48e7-af50-4f7282810e99", // RIBZIFF DSR CAP
      "0dc673b8-7e04-44aa-a3ba-45de36e6ace1", // ETOSCRIB MR TAB
      "77f4e709-81ce-4b28-b6af-1cd7ea0af08b", // PANPITAL DSR CAP
    ];

    const [delResult] = await conn.query(
      "DELETE FROM product_history WHERE id IN (?) AND invoice_no = 'INV-0087'",
      [fakeHistoryIds]
    );
    console.log(`Deleted ${delResult.affectedRows} fake history rows.`);

    console.log("=== STEP 2: Updating / Restoring available_qty in product_batches ===");

    // 1. BILASTUFF M TAB -> batch ABT01ATB
    await conn.query(
      "UPDATE product_batches SET available_qty = 20 WHERE id = '4014d686-4a80-48bb-843a-a891c1dcbd30'"
    );
    console.log("Updated BILASTUFF M TAB (batch ABT01ATB) available_qty to 20.");

    // 2. NUROSLIDE PLUS SOFTCAP -> batch D26SBV07
    await conn.query(
      "UPDATE product_batches SET available_qty = 42 WHERE id = 'a45ad0f4-4d4c-4eff-ade1-f1151ab18ab2'"
    );
    console.log("Updated NUROSLIDE PLUS SOFTCAP (batch D26SBV07) available_qty to 42 (total stock = 56).");

    // 3. ACEFLICK SP TAB -> batch ABT02AKB
    await conn.query(
      "UPDATE product_batches SET available_qty = 113 WHERE id = 'dec7b441-36cf-4250-8172-648610e17a57'"
    );
    console.log("Updated ACEFLICK SP TAB (batch ABT02AKB) available_qty to 113.");

    // 4. RIBZIFF DSR CAP -> batch WZFB326001
    await conn.query(
      "UPDATE product_batches SET available_qty = 40 WHERE id = '81c5b25c-1103-4a84-9411-8ff98cbb5d34'"
    );
    console.log("Updated RIBZIFF DSR CAP (batch WZFB326001) available_qty to 40 (total stock = 110).");

    // 5. ETOSCRIB MR TAB -> batch ABT02AVB (re-insert batch)
    await conn.query(`
      INSERT INTO product_batches (id, product_id, batch_no, expiry_date, purchase_price, mrp, selling_price, available_qty, sku)
      VALUES ('0fd52cd1-cd8a-4614-a6bf-3956fca24c8e', 'bf5c195f-035c-4264-bbcd-066fa80711c1', 'ABT02AVB', '2028-03-31', 63.00, 242.00, 105.00, 20, '30049099')
      ON DUPLICATE KEY UPDATE available_qty = 20, purchase_price = 63.00, mrp = 242.00, selling_price = 105.00, sku = '30049099'
    `);
    console.log("Restored ETOSCRIB MR TAB (batch ABT02AVB) available_qty to 20.");

    // 6. PANPITAL DSR CAP -> batch WINP326002 (re-insert batch)
    await conn.query(`
      INSERT INTO product_batches (id, product_id, batch_no, expiry_date, purchase_price, mrp, selling_price, available_qty, sku)
      VALUES ('78bcb333-360a-4a9a-b833-fb083f695c80', '8cdb18c0-f6bc-4201-aed5-4d284e1b76dd', 'WINP326002', '2028-05-31', 12.57, 121.00, 29.50, 50, '30049039')
      ON DUPLICATE KEY UPDATE available_qty = 50, purchase_price = 12.57, mrp = 121.00, selling_price = 29.50, sku = '30049039'
    `);
    console.log("Restored PANPITAL DSR CAP (batch WINP326002) available_qty to 50 (total stock = 110).");

    await conn.commit();
    console.log("\n=== TRANSACTION COMMITTED SUCCESSFULLY ===");

    // Verify product_history for INV-0087
    const [hist] = await conn.query(`
      SELECT p.name, ph.action, ph.quantity, ph.balance, ph.notes, ph.invoice_no
      FROM product_history ph
      JOIN products p ON ph.product_id = p.id
      WHERE ph.invoice_no = 'INV-0087'
      ORDER BY p.name ASC
    `);
    console.log("\nRemaining Product History records for INV-0087 (must be 7):");
    console.table(hist);

    // Verify batch stock totals
    const [stocks] = await conn.query(`
      SELECT p.name, COALESCE(SUM(pb.available_qty), 0) AS total_available_stock
      FROM products p
      LEFT JOIN product_batches pb ON pb.product_id = p.id
      WHERE p.name IN (
        'BILASTUFF M TAB',
        'NUROSLIDE PLUS SOFTCAP',
        'ACEFLICK SP TAB',
        'RIBZIFF DSR CAP',
        'ETOSCRIB MR TAB',
        'PANPITAL DSR CAP',
        'MEDIHEPA PLUS SUS'
      )
      AND p.user_id = '220a9129-0129-4efc-aa51-4a2096c617a8'
      GROUP BY p.id, p.name
      ORDER BY p.name ASC
    `);
    console.log("\nUpdated total available stock per product:");
    console.table(stocks);

  } catch (err) {
    await conn.rollback();
    console.error("Error executing fix:", err);
  } finally {
    await conn.end();
  }
}

run();
