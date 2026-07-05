import { Router } from "express";
import { pool } from "../db.js";
import { randomUUID } from "node:crypto";

const router = Router();

// Helper to generate UUIDs
const generateId = () => randomUUID();

// Helper to wrap connection transactions
async function withTransaction(callback) {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

// 1. Autocomplete Search (Distinct Name Filtering)
router.get("/medicines/autocomplete", async (req, res, next) => {
  try {
    const query = req.query.query ? `%${req.query.query.trim().toLowerCase()}%` : "%";
    const [rows] = await pool.query(
      `SELECT id, medicine_name, generic_name, gst, barcode, hsn_code
       FROM medicines
       WHERE user_id = ? AND (medicine_name LIKE ? OR generic_name LIKE ?)
       LIMIT 20`,
      [req.auth.userId, query, query]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// 2. Search Medicine (Advanced search by name, barcode, generic, rack, batch)
router.get("/medicines/search", async (req, res, next) => {
  try {
    const qStr = req.query.query ? `%${req.query.query.trim().toLowerCase()}%` : "%";
    const [rows] = await pool.query(
      `SELECT m.id AS medicine_id, m.medicine_name, m.generic_name, m.gst, m.barcode, m.hsn_code,
              b.id AS batch_id, b.batch_number, b.expiry_date, b.purchase_rate, b.mrp, b.sale_rate, b.rack, b.discount,
              IFNULL(s.quantity, 0) AS stock_qty
       FROM medicines m
       LEFT JOIN medicine_batches b ON m.id = b.medicine_id AND b.user_id = m.user_id
       LEFT JOIN stocks s ON b.id = s.batch_id AND s.user_id = m.user_id
       WHERE m.user_id = ? AND (
         m.medicine_name LIKE ? OR
         m.generic_name LIKE ? OR
         m.barcode LIKE ? OR
         b.batch_number LIKE ? OR
         b.rack LIKE ?
       )
       ORDER BY m.medicine_name, b.expiry_date ASC`,
      [req.auth.userId, qStr, qStr, qStr, qStr, qStr]
    );

    // Group batches under medicines
    const medicinesMap = new Map();
    for (const r of rows) {
      if (!medicinesMap.has(r.medicine_id)) {
        medicinesMap.set(r.medicine_id, {
          id: r.medicine_id,
          medicine_name: r.medicine_name,
          generic_name: r.generic_name,
          gst: r.gst,
          barcode: r.barcode,
          hsn_code: r.hsn_code,
          batches: []
        });
      }
      if (r.batch_id) {
        medicinesMap.get(r.medicine_id).batches.push({
          batch_id: r.batch_id,
          batch_number: r.batch_number,
          expiry_date: r.expiry_date,
          purchase_rate: r.purchase_rate,
          mrp: r.mrp,
          sale_rate: r.sale_rate,
          rack: r.rack,
          discount: r.discount,
          stock: r.stock_qty
        });
      }
    }

    res.json(Array.from(medicinesMap.values()));
  } catch (error) {
    next(error);
  }
});

// 3. Purchase Entry (POST)
router.post("/purchases", async (req, res, next) => {
  try {
    const { supplier_id, invoice_no, purchase_date, items } = req.body;
    if (!invoice_no || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Missing required fields or items list" });
    }

    const purchaseId = generateId();

    const result = await withTransaction(async (conn) => {
      let grandTotal = 0;

      // Create purchase header
      await conn.query(
        `INSERT INTO purchases (id, user_id, supplier_id, invoice_no, purchase_date, total)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [purchaseId, req.auth.userId, supplier_id || "default", invoice_no, purchase_date]
      );

      for (const item of items) {
        // Step 1: Search Medicine by Name. If name doesn't exist, create it.
        let [medRows] = await conn.query(
          "SELECT id FROM medicines WHERE user_id = ? AND medicine_name = ? LIMIT 1",
          [req.auth.userId, item.medicine_name.trim()]
        );

        let medicineId;
        if (medRows.length > 0) {
          medicineId = medRows[0].id;
        } else {
          medicineId = generateId();
          await conn.query(
            `INSERT INTO medicines (id, user_id, medicine_name, generic_name, company_id, category_id, hsn_code, gst, medicine_type, schedule, barcode)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              medicineId,
              req.auth.userId,
              item.medicine_name.trim(),
              item.generic_name || null,
              item.company_id || null,
              item.category_id || null,
              item.hsn_code || null,
              Number(item.gst || 12),
              item.medicine_type || null,
              item.schedule || null,
              item.barcode || null
            ]
          );
        }

        // Step 2: Check Batch Number
        let [batchRows] = await conn.query(
          "SELECT id FROM medicine_batches WHERE user_id = ? AND medicine_id = ? AND batch_number = ? LIMIT 1",
          [req.auth.userId, medicineId, item.batch_number.trim()]
        );

        let batchId;
        if (batchRows.length > 0) {
          batchId = batchRows[0].id;
          // Batch exists: update details and increment stock quantity
          await conn.query(
            `UPDATE medicine_batches
             SET expiry_date = ?, purchase_rate = ?, mrp = ?, sale_rate = ?, discount = ?, rack = ?, supplier_id = ?
             WHERE id = ?`,
            [
              item.expiry_date,
              Number(item.purchase_rate || 0),
              Number(item.mrp || 0),
              Number(item.sale_rate || 0),
              Number(item.discount || 0),
              item.rack || null,
              supplier_id || null,
              batchId
            ]
          );

          await conn.query(
            `INSERT INTO stocks (id, user_id, batch_id, quantity)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
            [generateId(), req.auth.userId, batchId, Number(item.quantity || 0)]
          );
        } else {
          // Batch is new: create batch and new stock entry
          batchId = generateId();
          await conn.query(
            `INSERT INTO medicine_batches (id, user_id, medicine_id, batch_number, expiry_date, purchase_rate, mrp, sale_rate, discount, rack, supplier_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              batchId,
              req.auth.userId,
              medicineId,
              item.batch_number.trim(),
              item.expiry_date,
              Number(item.purchase_rate || 0),
              Number(item.mrp || 0),
              Number(item.sale_rate || 0),
              Number(item.discount || 0),
              item.rack || null,
              supplier_id || null
            ]
          );

          await conn.query(
            `INSERT INTO stocks (id, user_id, batch_id, quantity)
             VALUES (?, ?, ?, ?)`,
            [generateId(), req.auth.userId, batchId, Number(item.quantity || 0)]
          );
        }

        // Add to purchase item details
        const itemCost = Number(item.purchase_rate || 0) * Number(item.quantity || 0) * (1 - Number(item.discount || 0) / 100);
        grandTotal += itemCost;

        await conn.query(
          `INSERT INTO purchase_items (id, user_id, purchase_id, batch_id, quantity, free_quantity, purchase_rate, mrp, sale_rate, discount, gst)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generateId(),
            req.auth.userId,
            purchaseId,
            batchId,
            Number(item.quantity || 0),
            Number(item.free_quantity || 0),
            Number(item.purchase_rate || 0),
            Number(item.mrp || 0),
            Number(item.sale_rate || 0),
            Number(item.discount || 0),
            Number(item.gst || 12)
          ]
        );
      }

      // Update purchase grand total
      await conn.query(
        "UPDATE purchases SET total = ? WHERE id = ?",
        [grandTotal, purchaseId]
      );

      return { id: purchaseId, grandTotal };
    });

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// 4. Sales Entry (POST with FEFO auto-batch deduction)
router.post("/sales", async (req, res, next) => {
  try {
    const { customer_id, invoice_no, date, items } = req.body;
    if (!invoice_no || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Missing invoice_no or items list" });
    }

    const saleId = generateId();

    const result = await withTransaction(async (conn) => {
      // Create Sale Header
      await conn.query(
        `INSERT INTO sales (id, user_id, customer_id, invoice_no, date)
         VALUES (?, ?, ?, ?, ?)`,
        [saleId, req.auth.userId, customer_id || null, invoice_no, date]
      );

      for (const item of items) {
        let remainingToDeduct = Number(item.quantity || 0);

        // Fetch batches for this medicine with positive stock, sorted by Expiry Date ascending (FEFO)
        const [batches] = await conn.query(
          `SELECT b.id AS batch_id, b.sale_rate, b.discount, s.quantity AS stock_qty, b.batch_number
           FROM medicine_batches b
           JOIN stocks s ON b.id = s.batch_id
           WHERE b.user_id = ? AND b.medicine_id = ? AND s.quantity > 0
           ORDER BY b.expiry_date ASC`,
          [req.auth.userId, item.medicine_id]
        );

        if (batches.length === 0) {
          throw new Error(`Insufficient stock for selected medicine ID: ${item.medicine_id}`);
        }

        // Deduct using First Expired First Out
        for (const batch of batches) {
          if (remainingToDeduct <= 0) break;

          const toDeductFromThisBatch = Math.min(remainingToDeduct, batch.stock_qty);

          // Update stock table
          await conn.query(
            `UPDATE stocks SET quantity = quantity - ? WHERE batch_id = ?`,
            [toDeductFromThisBatch, batch.batch_id]
          );

          // Insert Sale item record
          await conn.query(
            `INSERT INTO sale_items (id, user_id, sale_id, batch_id, quantity, sale_rate, discount)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              generateId(),
              req.auth.userId,
              saleId,
              batch.batch_id,
              toDeductFromThisBatch,
              Number(item.sale_rate || batch.sale_rate),
              Number(item.discount || batch.discount)
            ]
          );

          remainingToDeduct -= toDeductFromThisBatch;
        }

        if (remainingToDeduct > 0) {
          throw new Error(`Not enough cumulative stock in batches to sell quantity ${item.quantity} of medicine ${item.medicine_id}`);
        }
      }

      return { id: saleId };
    });

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// 5. Stock List Endpoint (GET with low stock/expiry alerts and search filters)
router.get("/stocks", async (req, res, next) => {
  try {
    const qStr = req.query.query ? `%${req.query.query.trim().toLowerCase()}%` : "%";
    const [rows] = await pool.query(
      `SELECT m.medicine_name, m.generic_name, m.gst, m.barcode, m.schedule,
              b.batch_number, b.expiry_date, b.purchase_rate, b.mrp, b.sale_rate, b.rack, b.supplier_id,
              IFNULL(s.quantity, 0) AS stock_qty,
              IF(b.expiry_date < CURRENT_DATE, 'Expired', IF(s.quantity < 10, 'Low Stock', 'Normal')) AS status
       FROM medicine_batches b
       JOIN medicines m ON b.medicine_id = m.id AND b.user_id = m.user_id
       JOIN stocks s ON b.id = s.batch_id AND s.user_id = m.user_id
       WHERE b.user_id = ? AND (
         m.medicine_name LIKE ? OR
         m.generic_name LIKE ? OR
         m.barcode LIKE ? OR
         b.batch_number LIKE ? OR
         b.rack LIKE ?
       )
       ORDER BY b.expiry_date ASC`,
      [req.auth.userId, qStr, qStr, qStr, qStr, qStr]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

export { router as margRouter };
