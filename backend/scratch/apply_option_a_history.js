import { pool } from "../src/db.js";
import { randomUUID } from "node:crypto";

async function applyOptionA() {
  const conn = await pool.getConnection();
  const userId = "220a9129-0129-4efc-aa51-4a2096c617a8";

  const entriesToInsert = [
    // 1. ACEFLICK COLD TAB
    {
      productId: "b3759e0b-053d-4b49-9314-f58f10206b2a",
      action: "stock_in",
      quantity: 30.00,
      balance: 30.00,
      notes: "Initial inventory stock (Batch: T260111B)",
      invoiceNo: null,
      createdAt: "2026-07-01 16:29:40"
    },
    {
      productId: "b3759e0b-053d-4b49-9314-f58f10206b2a",
      action: "sale",
      quantity: 10.00,
      balance: 20.00,
      notes: "Sale via INV-0007 by NORTH EAST DRUG DISTRIBUTOR",
      invoiceNo: "INV-0007",
      createdAt: "2026-07-05 23:06:19"
    },

    // 2. AZOXONE 500 TAB
    {
      productId: "e5eb8df7-3c3c-4c17-8f8d-400ecb43d1ac",
      action: "stock_in",
      quantity: 20.00,
      balance: 20.00,
      notes: "Initial inventory stock (Batch: ABT01BGB)",
      invoiceNo: null,
      createdAt: "2026-07-01 23:50:42"
    },
    {
      productId: "e5eb8df7-3c3c-4c17-8f8d-400ecb43d1ac",
      action: "sale",
      quantity: 10.00,
      balance: 10.00,
      notes: "Sale via INV-0017 by NORTH EAST DRUG DISTRIBUTOR",
      invoiceNo: "INV-0017",
      createdAt: "2026-07-10 11:54:59"
    },

    // 3. CANAZOLE B LOTION
    {
      productId: "e2a84560-641b-4aba-8104-28c225b106d6",
      action: "stock_in",
      quantity: 6.00,
      balance: 6.00,
      notes: "Initial inventory stock (Batch: N25P2005)",
      invoiceNo: null,
      createdAt: "2026-07-09 19:22:14"
    },
    {
      productId: "e2a84560-641b-4aba-8104-28c225b106d6",
      action: "sale",
      quantity: 6.00,
      balance: 0.00,
      notes: "Sale via INV-0015 by NORTH EAST DRUG DISTRIBUTOR",
      invoiceNo: "INV-0015",
      createdAt: "2026-07-09 20:12:06"
    },

    // 4. CEFUZROM 500 TAB
    {
      productId: "b2159715-acd4-4fec-82e7-5e779e9b243f",
      action: "stock_in",
      quantity: 20.00,
      balance: 20.00,
      notes: "Initial inventory stock (Batch: BEI01AAB)",
      invoiceNo: null,
      createdAt: "2026-07-02 00:56:20"
    },
    {
      productId: "b2159715-acd4-4fec-82e7-5e779e9b243f",
      action: "sale",
      quantity: 10.00,
      balance: 10.00,
      notes: "Sale via INV-0006 by NORTH EAST DRUG DISTRIBUTOR",
      invoiceNo: "INV-0006",
      createdAt: "2026-07-05 22:55:06"
    },

    // 5. OLIGANIX SYP
    {
      productId: "6e626f95-ab65-47ed-abeb-fcbbea7d913d",
      action: "stock_in",
      quantity: 20.00,
      balance: 20.00,
      notes: "Initial inventory stock (Batch: S2604085B)",
      invoiceNo: null,
      createdAt: "2026-07-02 03:08:31"
    },
    {
      productId: "6e626f95-ab65-47ed-abeb-fcbbea7d913d",
      action: "sale",
      quantity: 5.00,
      balance: 15.00,
      notes: "Sale via INV-0007 by NORTH EAST DRUG DISTRIBUTOR",
      invoiceNo: "INV-0007",
      createdAt: "2026-07-05 23:06:19"
    },
    {
      productId: "6e626f95-ab65-47ed-abeb-fcbbea7d913d",
      action: "sale",
      quantity: 3.00,
      balance: 12.00,
      notes: "Sale via INV-0009 by NORTH EAST DRUG DISTRIBUTOR",
      invoiceNo: "INV-0009",
      createdAt: "2026-07-05 23:17:02"
    },
    {
      productId: "6e626f95-ab65-47ed-abeb-fcbbea7d913d",
      action: "sale",
      quantity: 2.00,
      balance: 10.00,
      notes: "Sale via INV-0011 by NORTH EAST DRUG DISTRIBUTOR",
      invoiceNo: "INV-0011",
      createdAt: "2026-07-06 15:23:23"
    },
    {
      productId: "6e626f95-ab65-47ed-abeb-fcbbea7d913d",
      action: "sale",
      quantity: 10.00,
      balance: 0.00,
      notes: "Sale via INV-0017 by NORTH EAST DRUG DISTRIBUTOR",
      invoiceNo: "INV-0017",
      createdAt: "2026-07-10 11:54:59"
    },

    // 6. ZEQFIM-200 TAB
    {
      productId: "e4dd4c45-49fd-41f9-87bc-71d2e6598b83",
      action: "stock_in",
      quantity: 60.00,
      balance: 60.00,
      notes: "Initial inventory stock (Batch: T260179L)",
      invoiceNo: null,
      createdAt: "2026-07-02 16:19:09"
    },
    {
      productId: "e4dd4c45-49fd-41f9-87bc-71d2e6598b83",
      action: "sale",
      quantity: 10.00,
      balance: 50.00,
      notes: "Sale via INV-0021 by NORTH EAST DRUG DISTRIBUTOR",
      invoiceNo: "INV-0021",
      createdAt: "2026-07-11 12:55:29"
    }
  ];

  try {
    await conn.beginTransaction();

    console.log(`Starting insertion of ${entriesToInsert.length} audit log entries for 6 products...`);

    for (const item of entriesToInsert) {
      // Guard against duplicate insertion
      const [existing] = await conn.query(
        "SELECT id FROM product_history WHERE product_id = ? AND action = ? AND quantity = ? AND COALESCE(invoice_no, '') = ?",
        [item.productId, item.action, item.quantity, item.invoiceNo || ""]
      );

      if (existing.length > 0) {
        console.log(`Log already exists for product ${item.productId} (${item.action} ${item.quantity}). Skipping.`);
        continue;
      }

      const id = randomUUID();
      await conn.query(
        `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes, invoice_no, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          userId,
          item.productId,
          item.action,
          item.quantity,
          item.balance,
          item.notes,
          item.invoiceNo,
          item.createdAt
        ]
      );
    }

    await conn.commit();
    console.log("Transaction committed successfully!");

    // Verification check for each product
    const checkProductIds = [...new Set(entriesToInsert.map(e => e.productId))];
    console.log("\n=== VERIFICATION RESULTS ===");
    for (const pid of checkProductIds) {
      const [p] = await pool.query("SELECT name FROM products WHERE id = ?", [pid]);
      const [rows] = await pool.query(
        "SELECT id, action, quantity, balance, notes, invoice_no, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as time FROM product_history WHERE product_id = ? ORDER BY created_at ASC",
        [pid]
      );
      console.log(`\nProduct: "${p[0].name}" (${rows.length} logs):`);
      for (const r of rows) {
        console.log(`  * [${r.time}] Action: ${r.action.toUpperCase()} | Qty: ${r.quantity} | Balance: ${r.balance} | Ref: ${r.invoice_no || "N/A"} | Note: ${r.notes}`);
      }
    }

    process.exit(0);
  } catch (err) {
    await conn.rollback();
    console.error("Error applying Option A history:", err);
    process.exit(1);
  } finally {
    conn.release();
  }
}

applyOptionA();
