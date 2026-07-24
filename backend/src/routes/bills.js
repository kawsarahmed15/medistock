import { Router } from "express";
import { pool, withTransaction } from "../db.js";
import { buildApiError, generateId } from "../utils.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const [bills] = await pool.query(
      `SELECT id, number, customer_name, customer_phone, customer_address, customer_drug_lic_no, customer_gstin, cashier, payment_method, advance_amount, advance_payment_method, subtotal, tax, discount, total, created_at
       FROM bills
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.auth.userId],
    );

    if (bills.length === 0) {
      res.json([]);
      return;
    }

    const ids = bills.map((bill) => bill.id);
    const placeholders = ids.map(() => "?").join(",");
    const [items] = await pool.query(
      `SELECT bill_id, product_id, name, sku, price, cost_price, qty, tax_percent, mrp, batch, pack, expiry, free_qty
       FROM bill_items
       WHERE user_id = ? AND bill_id IN (${placeholders})`,
      [req.auth.userId, ...ids],
    );

    const map = new Map();
    for (const item of items) {
      const arr = map.get(item.bill_id) || [];
      arr.push(item);
      map.set(item.bill_id, arr);
    }

    const data = bills.map((bill) => ({
      ...bill,
      items: map.get(bill.id) || [],
    }));

    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, number, customer_name, customer_phone, customer_address, customer_drug_lic_no, customer_gstin, customer_notes, cashier, payment_method, advance_amount, advance_payment_method,
              subtotal, tax, discount, total, created_at
       FROM bills
       WHERE user_id = ? AND id = ?
       LIMIT 1`,
      [req.auth.userId, req.params.id],
    );
    const bill = rows[0];
    if (!bill) {
      throw buildApiError(404, "Bill not found");
    }

    const [items] = await pool.query(
      `SELECT bill_id, product_id, name, sku, price, cost_price, qty, tax_percent, mrp, batch, pack, expiry, free_qty
       FROM bill_items
       WHERE user_id = ? AND bill_id = ?`,
      [req.auth.userId, req.params.id],
    );

    res.json({ ...bill, items });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const isReturn = !!body.isReturn;
    const created = await withTransaction(async (conn) => {
      const prefix = isReturn ? "SR" : "INV";
      const [maxRows] = await conn.query(
        `SELECT MAX(CAST(SUBSTRING_INDEX(number, '-', -1) AS UNSIGNED)) AS maxNo
         FROM bills
         WHERE user_id = ? AND number LIKE ?`,
        [req.auth.userId, `${prefix}-%`],
      );
      const nextNo = Number(maxRows[0]?.maxNo || 0) + 1;
      const invoiceNo = `${prefix}-${String(nextNo).padStart(4, "0")}`;

      const id = generateId();
      await conn.query(
        `INSERT INTO bills (id, user_id, number, customer_name, customer_phone, customer_address, customer_drug_lic_no, customer_gstin, customer_notes,
             cashier, payment_method, advance_amount, advance_payment_method, subtotal, tax, discount, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          req.auth.userId,
          invoiceNo,
          body.customerName || null,
          body.customerPhone || null,
          body.customerAddress || null,
          body.customerDrugLicNo || null,
          body.customerGstin || null,
          body.customerNotes || null,
          body.cashier || null,
          ["cash", "online", "credit"].includes(body.paymentMethod) ? body.paymentMethod : "cash",
          Number(body.advanceAmount || 0),
          ["cash", "online"].includes(body.advancePaymentMethod) ? body.advancePaymentMethod : "cash",
          Number(body.subtotal || 0),
          Number(body.tax || 0),
          Number(body.discount || 0),
          Number(body.total || 0),
        ],
      );

      for (const item of items) {
        await conn.query(
          `INSERT INTO bill_items (id, bill_id, user_id, product_id, name, sku, price, cost_price, qty, tax_percent, mrp, batch, pack, expiry, free_qty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generateId(),
            id,
            req.auth.userId,
            item.productId || null,
            item.name,
            item.sku || null,
            Number(item.price || 0),
            item.costPrice == null ? null : Number(item.costPrice),
            Number(item.qty || 0),
            Number(item.taxPercent || 0),
            item.mrp == null || item.mrp === "" ? null : Number(item.mrp),
            item.batch ? String(item.batch).trim() : null,
            item.pack ? String(item.pack).trim() : null,
            item.expiry ? String(item.expiry).slice(0, 10) : null,
            Number(item.freeQty || 0),
          ],
        );

        if (isReturn) {
          let targetProductId = item.productId || null;

          // If product ID is given, check if it exists in products table
          if (targetProductId) {
            const [pCheck] = await conn.query(
              "SELECT id FROM products WHERE user_id = ? AND id = ? LIMIT 1",
              [req.auth.userId, targetProductId]
            );
            if (pCheck.length === 0) {
              targetProductId = null;
            }
          }

          // If product ID wasn't found or wasn't provided, try matching by name or SKU
          if (!targetProductId && (item.name || item.sku)) {
            const [pMatch] = await conn.query(
              "SELECT id FROM products WHERE user_id = ? AND (name = ? OR (sku IS NOT NULL AND sku = ?)) LIMIT 1",
              [req.auth.userId, item.name, item.sku || "___NO_SKU___"]
            );
            if (pMatch.length > 0) {
              targetProductId = pMatch[0].id;
            }
          }

          if (targetProductId) {
            const returnQty = Math.abs(Number(item.qty || 0)) + Math.abs(Number(item.freeQty || 0));
            if (returnQty > 0) {
              const itemBatchNo = item.batch ? String(item.batch).trim() : "DEFAULT";

              // Check if batch already exists for this product
              const [existingBatch] = await conn.query(
                `SELECT id FROM product_batches WHERE product_id = ? AND batch_no = ? LIMIT 1`,
                [targetProductId, itemBatchNo]
              );

              if (existingBatch.length > 0) {
                // Batch exists: Increase quantity and update SKU if null
                await conn.query(
                  `UPDATE product_batches SET available_qty = available_qty + ?, sku = COALESCE(sku, ?) WHERE id = ?`,
                  [returnQty, item.sku || null, existingBatch[0].id]
                );
              } else {
                // Batch was deleted when stock hit 0 or doesn't exist: Recreate batch with same details
                const newBatchId = generateId();
                await conn.query(
                  `INSERT INTO product_batches (id, product_id, batch_no, expiry_date, purchase_price, mrp, selling_price, available_qty, sku)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    newBatchId,
                    targetProductId,
                    itemBatchNo,
                    item.expiry ? String(item.expiry).slice(0, 10) : "2030-12-31",
                    Number(item.costPrice || 0),
                    Number(item.mrp || 0),
                    Number(item.price || 0),
                    returnQty,
                    item.sku || null,
                  ]
                );
              }

              // Fetch sum of all batches for product history balance
              const [sumRows] = await conn.query(
                "SELECT SUM(available_qty) AS total FROM product_batches WHERE product_id = ?",
                [targetProductId]
              );
              const nextStock = Number(sumRows[0].total || 0);

              await conn.query(
                `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes)
                 VALUES (?, ?, ?, 'return', ?, ?, ?)`,
                [
                  generateId(),
                  req.auth.userId,
                  targetProductId,
                  returnQty,
                  nextStock,
                  `Customer return via ${invoiceNo}`,
                ]
              );
            }
          }
        }
      }

      return { id, number: invoiceNo };
    });

    const [rows] = await pool.query(
      `SELECT id, number, customer_name, customer_phone, customer_address, customer_drug_lic_no, customer_gstin, customer_notes, cashier, payment_method,
              advance_amount, advance_payment_method, subtotal, tax, discount, total, created_at
       FROM bills
       WHERE user_id = ? AND id = ?
       LIMIT 1`,
      [req.auth.userId, created.id],
    );
    res.status(201).json({ ...rows[0], items: [] });
  } catch (error) {
    next(error);
  }
});

export { router as billsRouter };
