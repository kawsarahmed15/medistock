import { Router } from "express";
import { pool, withTransaction } from "../db.js";
import { buildApiError, generateId } from "../utils.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const [purchases] = await pool.query(
      `SELECT id, number, supplier_name, supplier_phone, supplier_invoice, notes, payment_status, payment_method, amount_paid, subtotal, tax, discount, total, created_at, created_by
       FROM purchases
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 500`,
      [req.auth.userId],
    );

    if (purchases.length === 0) {
      res.json([]);
      return;
    }

    const ids = purchases.map((p) => p.id);
    const placeholders = ids.map(() => "?").join(",");
    const [items] = await pool.query(
      `SELECT id, purchase_id, product_id, name, sku, qty, cost_price, tax_percent, mrp, batch, pack, expiry, free_qty, sale_rate
       FROM purchase_items
       WHERE user_id = ? AND purchase_id IN (${placeholders})`,
      [req.auth.userId, ...ids],
    );

    const map = new Map();
    for (const item of items) {
      const arr = map.get(item.purchase_id) || [];
      arr.push(item);
      map.set(item.purchase_id, arr);
    }

    const data = purchases.map((purchase) => ({
      ...purchase,
      items: map.get(purchase.id) || [],
    }));

    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, number, supplier_name, supplier_phone, supplier_invoice, notes, payment_status, payment_method, amount_paid, subtotal, tax, discount, total, created_at, created_by
       FROM purchases
       WHERE user_id = ? AND id = ?
       LIMIT 1`,
      [req.auth.userId, req.params.id],
    );
    const purchase = rows[0];
    if (!purchase) {
      throw buildApiError(404, "Purchase not found");
    }

    const [items] = await pool.query(
      `SELECT id, purchase_id, product_id, name, sku, qty, cost_price, tax_percent, mrp, batch, pack, expiry, free_qty, sale_rate
       FROM purchase_items
       WHERE user_id = ? AND purchase_id = ?`,
      [req.auth.userId, req.params.id],
    );

    res.json({ ...purchase, items });
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
      const prefix = isReturn ? "PR" : "PO";
      const [maxRows] = await conn.query(
        `SELECT MAX(CAST(SUBSTRING_INDEX(number, '-', -1) AS UNSIGNED)) AS maxNo
         FROM purchases
         WHERE user_id = ? AND number LIKE ?`,
        [req.auth.userId, `${prefix}-%`],
      );
      const nextNo = Number(maxRows[0]?.maxNo || 0) + 1;
      const poNo = `${prefix}-${String(nextNo).padStart(4, "0")}`;

      const id = generateId();
      await conn.query(
        `INSERT INTO purchases (id, user_id, number, supplier_name, supplier_phone, supplier_invoice, notes, created_by, payment_status, payment_method, amount_paid, subtotal, tax, discount, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          req.auth.userId,
          poNo,
          body.supplierName || null,
          body.supplierPhone || null,
          body.supplierInvoice || null,
          body.notes || null,
          body.createdBy || null,
          body.paymentStatus || "unpaid",
          body.paymentMethod || "cash",
          Number(body.amountPaid || 0),
          Number(body.subtotal || 0),
          Number(body.tax || 0),
          Number(body.discount || 0),
          Number(body.total || 0),
        ],
      );

      for (const item of items) {
        await conn.query(
          `INSERT INTO purchase_items (id, purchase_id, user_id, product_id, name, sku, qty, cost_price, tax_percent, mrp, batch, pack, expiry, free_qty, sale_rate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generateId(),
            id,
            req.auth.userId,
            item.productId || null,
            item.name,
            item.sku || item.hsn || null,
            Number(item.qty || 0),
            item.costPrice == null ? null : Number(item.costPrice),
            Number(item.taxPercent || 0),
            item.mrp == null || item.mrp === "" ? null : Number(item.mrp),
            item.batch ? String(item.batch).trim() : null,
            item.pack ? String(item.pack).trim() : null,
            item.expiry ? String(item.expiry).slice(0, 10) : null,
            Number(item.freeQty || 0),
            item.saleRate == null || item.saleRate === "" ? null : Number(item.saleRate),
          ],
        );

        // Update product stock and cost price using batch-wise logic
        let targetProductId = item.productId || null;

        if (targetProductId) {
          const [pCheck] = await conn.query(
            "SELECT id FROM products WHERE user_id = ? AND id = ? LIMIT 1",
            [req.auth.userId, targetProductId]
          );
          if (pCheck.length === 0) {
            targetProductId = null;
          }
        }

        if (!targetProductId && (item.name || item.sku || item.hsn)) {
          const [pMatch] = await conn.query(
            "SELECT id FROM products WHERE user_id = ? AND (name = ? OR (sku IS NOT NULL AND sku = ?)) LIMIT 1",
            [req.auth.userId, item.name, item.sku || item.hsn || "___NO_SKU___"]
          );
          if (pMatch.length > 0) {
            targetProductId = pMatch[0].id;
          }
        }

        if (targetProductId) {
          const addedStock = Number(item.qty || 0) + Number(item.freeQty || 0);
          const itemBatchNo = item.batch ? String(item.batch).trim() : "DEFAULT";
          
          // Check if batch already exists for this product
          const [existingBatch] = await conn.query(
            `SELECT id FROM product_batches WHERE product_id = ? AND batch_no = ? LIMIT 1`,
            [targetProductId, itemBatchNo]
          );

          const costPriceVal = item.costPrice == null ? 0 : Number(item.costPrice);
          const taxPercentVal = item.taxPercent == null ? 0 : Number(item.taxPercent);
          const qtyVal = Number(item.qty || 0);
          const freeQtyVal = Number(item.freeQty || 0);
          const totalUnitsVal = qtyVal + freeQtyVal;
          const baseLineTotal = Number((costPriceVal * qtyVal).toFixed(2));
          const lineTax = Number(((baseLineTotal * taxPercentVal) / 100).toFixed(2));
          const lineLandedTotal = baseLineTotal + lineTax;
          const landedPurchasePrice = totalUnitsVal > 0
            ? Number((lineLandedTotal / totalUnitsVal).toFixed(4))
            : Number((costPriceVal * (1 + taxPercentVal / 100)).toFixed(4));
          const mrpVal = item.mrp == null ? 0 : Number(item.mrp);
          const rawSellingPrice = item.saleRate != null ? Number(item.saleRate) : mrpVal;

          const itemSku = (item.sku || item.hsn || "").trim() || null;

          if (existingBatch.length > 0) {
            // Batch exists: Increase quantity, update purchase_price to landed cost & selling_price to base sale rate if > 0, update sku if null/empty
            await conn.query(
              `UPDATE product_batches 
               SET available_qty = available_qty + ?, 
                   purchase_price = CASE WHEN ? > 0 THEN ? ELSE purchase_price END, 
                   selling_price = CASE WHEN ? > 0 THEN ? ELSE selling_price END,
                   sku = COALESCE(NULLIF(?, ''), NULLIF(sku, ''), (SELECT sku FROM products WHERE id = ?)) 
               WHERE id = ?`,
              [addedStock, landedPurchasePrice, landedPurchasePrice, rawSellingPrice, rawSellingPrice, itemSku, targetProductId, existingBatch[0].id]
            );
          } else {
            // Batch does not exist: Create a new batch
            const newBatchId = generateId();

            await conn.query(
              `INSERT INTO product_batches (id, product_id, batch_no, expiry_date, purchase_price, mrp, selling_price, available_qty, sku)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(NULLIF(?, ''), (SELECT sku FROM products WHERE id = ?)))`,
              [
                newBatchId,
                targetProductId,
                itemBatchNo,
                item.expiry ? String(item.expiry).slice(0, 10) : "2030-12-31",
                landedPurchasePrice,
                mrpVal,
                rawSellingPrice,
                addedStock,
                itemSku,
                targetProductId
              ]
            );
          }
          
          const historyAction = isReturn ? 'return' : 'purchase';
          const historyNotes = isReturn ? `Returned via ${poNo}` : `Added from PO ${poNo}`;

          // Fetch sum of all batches for product history balance
          const [sumRows] = await conn.query(
            "SELECT SUM(available_qty) AS total FROM product_batches WHERE product_id = ?",
            [targetProductId]
          );
          const nextStock = Number(sumRows[0].total || 0);

          await conn.query(
            `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [generateId(), req.auth.userId, targetProductId, historyAction, addedStock, nextStock, historyNotes]
          );
        }
      }

      return { id, number: poNo };
    });

    const [rows] = await pool.query(
      `SELECT id, number, supplier_name, supplier_phone, supplier_invoice, notes, payment_status, payment_method,
              amount_paid, subtotal, tax, discount, total, created_at
       FROM purchases
       WHERE user_id = ? AND id = ?
       LIMIT 1`,
      [req.auth.userId, created.id],
    );
    res.status(201).json({ ...rows[0], items: [] });
  } catch (error) {
    next(error);
  }
});

export { router as purchasesRouter };
