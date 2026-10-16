import { Router } from "express";
import { pool, withTransaction } from "../db.js";
import { buildApiError, generateId } from "../utils.js";
import { requireAuth, requireAdminOnly } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
router.use(requireAdminOnly);

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
      `SELECT id, purchase_id, product_id, name, sku, qty, cost_price, tax_percent, mrp, batch, pack, expiry, free_qty, sale_rate, conversion_factor
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

    await attachReturnsToPurchases(pool, req.auth.userId, data);

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
      `SELECT id, purchase_id, product_id, name, sku, qty, cost_price, tax_percent, mrp, batch, pack, expiry, free_qty, sale_rate, conversion_factor
       FROM purchase_items
       WHERE user_id = ? AND purchase_id = ?`,
      [req.auth.userId, req.params.id],
    );

    const purchaseData = { ...purchase, items };
    await attachReturnsToPurchases(pool, req.auth.userId, [purchaseData]);

    res.json(purchaseData);
  } catch (error) {
    next(error);
  }
});

async function attachReturnsToPurchases(connOrPool, userId, purchases) {
  if (!purchases || purchases.length === 0) return;

  const regularPurchases = purchases.filter((p) => p.number && !String(p.number).startsWith("PR-"));
  if (regularPurchases.length === 0) return;

  const [returnPurchases] = await connOrPool.query(
    `SELECT id, number, notes, supplier_invoice, subtotal, tax, discount, total, created_at
     FROM purchases
     WHERE user_id = ? AND number LIKE 'PR-%'`,
    [userId]
  );

  if (returnPurchases.length === 0) return;

  const returnIds = returnPurchases.map((rp) => rp.id);
  const placeholders = returnIds.map(() => "?").join(",");
  const [returnItems] = await connOrPool.query(
    `SELECT id, purchase_id, product_id, name, sku, qty, cost_price, tax_percent, mrp, batch, pack, expiry, free_qty, sale_rate, conversion_factor
     FROM purchase_items
     WHERE user_id = ? AND purchase_id IN (${placeholders})`,
    [userId, ...returnIds]
  );

  const returnItemsMap = new Map();
  for (const item of returnItems) {
    const arr = returnItemsMap.get(item.purchase_id) || [];
    arr.push(item);
    returnItemsMap.set(item.purchase_id, arr);
  }

  for (const rp of returnPurchases) {
    rp.items = returnItemsMap.get(rp.id) || [];
  }

  for (const purchase of regularPurchases) {
    const poNum = String(purchase.number).trim();
    const poId = String(purchase.id).trim();

    const matchingReturns = returnPurchases.filter((rp) => {
      const notes = String(rp.notes || "").trim();
      const supInv = String(rp.supplier_invoice || "").trim();
      return notes.includes(poNum) || supInv.includes(poNum) || (poId && notes.includes(poId));
    });

    if (matchingReturns.length > 0) {
      let returnedSubtotal = 0;
      let returnedTax = 0;
      let returnedTotal = 0;
      const attachedReturnItems = [];

      for (const rp of matchingReturns) {
        returnedSubtotal += Number(rp.subtotal || 0);
        returnedTax += Number(rp.tax || 0);
        returnedTotal += Number(rp.total || 0);

        for (const it of rp.items) {
          attachedReturnItems.push({
            id: it.id,
            purchase_id: purchase.id,
            product_id: it.product_id,
            name: it.name,
            sku: it.sku,
            qty: Number(it.qty || 0),
            free_qty: Number(it.free_qty || 0),
            cost_price: Number(it.cost_price || 0),
            mrp: it.mrp != null ? Number(it.mrp) : null,
            tax_percent: Number(it.tax_percent || 0),
            batch: it.batch,
            expiry: it.expiry,
            pack: it.pack,
            conversion_factor: it.conversion_factor,
            sale_rate: it.sale_rate,
            is_return_item: true,
            return_purchase_number: rp.number,
            return_purchase_id: rp.id,
            return_date: rp.created_at,
          });
        }
      }

      purchase.original_subtotal = Number(purchase.subtotal || 0);
      purchase.original_tax = Number(purchase.tax || 0);
      purchase.original_total = Number(purchase.total || 0);
      purchase.returned_subtotal = Number(returnedSubtotal.toFixed(2));
      purchase.returned_tax = Number(returnedTax.toFixed(2));
      purchase.returned_total = Number(returnedTotal.toFixed(2));

      purchase.subtotal = Number((Number(purchase.subtotal || 0) + returnedSubtotal).toFixed(2));
      purchase.tax = Number((Number(purchase.tax || 0) + returnedTax).toFixed(2));
      purchase.total = Number((Number(purchase.total || 0) + returnedTotal).toFixed(2));

      purchase.items = [...(purchase.items || []), ...attachedReturnItems];
      purchase.has_returns = true;
      purchase.returns = matchingReturns.map((rp) => ({
        id: rp.id,
        number: rp.number,
        total: Number(rp.total || 0),
        created_at: rp.created_at,
      }));
    }
  }
}

router.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const isReturn = !!body.isReturn || (body.number && String(body.number).startsWith("PR-"));
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

      let calcSubtotal = 0;
      let calcTax = 0;
      for (const item of items) {
        const itemQty = Number(item.qty || 0);
        const itemCost = Number(item.costPrice || 0);
        const itemTaxPercent = Number(item.taxPercent || 0);
        const line = Number((itemQty * itemCost).toFixed(2));
        calcSubtotal += line;
        calcTax += (line * itemTaxPercent) / 100;
      }
      calcSubtotal = Number(calcSubtotal.toFixed(2));
      calcTax = Number(calcTax.toFixed(2));
      const discountVal = Number(body.discount || 0);
      const calcTotal = isReturn
        ? Number((calcSubtotal + calcTax - discountVal).toFixed(2))
        : Math.round(Math.max(0, calcSubtotal + calcTax - discountVal));

      const purchaseSubtotal = body.subtotal != null ? Number(body.subtotal) : calcSubtotal;
      const purchaseTax = body.tax != null ? Number(body.tax) : calcTax;
      const purchaseTotal = isReturn
        ? Number((purchaseSubtotal + purchaseTax - discountVal).toFixed(2))
        : (body.total != null ? Number(body.total) : calcTotal);

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
          purchaseSubtotal,
          purchaseTax,
          discountVal,
          purchaseTotal,
        ],
      );

      for (const item of items) {
        const itemConvVal = Number(item.conversionFactor || item.conversion_factor || 1) || 1;

        await conn.query(
          `INSERT INTO purchase_items (id, purchase_id, user_id, product_id, name, sku, qty, cost_price, tax_percent, mrp, batch, pack, expiry, free_qty, sale_rate, conversion_factor)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            itemConvVal,
          ],
        );

        // Update product stock and cost price using batch-wise logic
        let rawId = (item.productId && String(item.productId).trim()) || (item.product_id && String(item.product_id).trim()) || null;
        let targetProductId = null;

        if (rawId && rawId !== "") {
          const [pCheck] = await conn.query(
            "SELECT id FROM products WHERE user_id = ? AND id = ? LIMIT 1",
            [req.auth.userId, rawId]
          );
          if (pCheck.length > 0) {
            targetProductId = pCheck[0].id;
          } else {
            const [bCheck] = await conn.query(
              "SELECT b.product_id FROM product_batches b JOIN products p ON b.product_id = p.id WHERE p.user_id = ? AND b.id = ? LIMIT 1",
              [req.auth.userId, rawId]
            );
            if (bCheck.length > 0) {
              targetProductId = bCheck[0].product_id;
            }
          }
        }

        if (!targetProductId && item.name) {
          const [pMatch] = await conn.query(
            `SELECT id FROM products 
             WHERE user_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) 
             LIMIT 1`,
            [req.auth.userId, String(item.name).trim()]
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
          const itemPackStr = item.pack ? String(item.pack).trim() : null;

          if (existingBatch.length > 0) {
            // Batch exists: Increase quantity, update purchase_price to landed cost & selling_price to base sale rate if > 0, update sku if null/empty
            await conn.query(
              `UPDATE product_batches 
               SET available_qty = available_qty + ?, 
                   purchase_price = CASE WHEN ? > 0 THEN ? ELSE purchase_price END, 
                   selling_price = CASE WHEN ? > 0 THEN ? ELSE selling_price END,
                   mrp = CASE WHEN ? > 0 THEN ? ELSE mrp END,
                   conversion_factor = CASE WHEN ? > 0 THEN ? ELSE conversion_factor END,
                   sku = COALESCE(NULLIF(?, ''), NULLIF(sku, ''), (SELECT sku FROM products WHERE id = ?)) 
               WHERE id = ?`,
              [addedStock, landedPurchasePrice, landedPurchasePrice, rawSellingPrice, rawSellingPrice, mrpVal, mrpVal, itemConvVal, itemConvVal, itemSku, targetProductId, existingBatch[0].id]
            );
          } else {
            // Batch does not exist: Create a new batch
            const newBatchId = generateId();

            await conn.query(
              `INSERT INTO product_batches (id, product_id, batch_no, expiry_date, purchase_price, mrp, selling_price, available_qty, conversion_factor, sku)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(NULLIF(?, ''), (SELECT sku FROM products WHERE id = ?)))`,
              [
                newBatchId,
                targetProductId,
                itemBatchNo,
                item.expiry ? String(item.expiry).slice(0, 10) : "2030-12-31",
                landedPurchasePrice,
                mrpVal,
                rawSellingPrice,
                addedStock,
                itemConvVal,
                itemSku,
                targetProductId
              ]
            );
          }

          // Update parent product conversion factor and pack
          await conn.query(
            `UPDATE products 
             SET conversion_factor = CASE WHEN ? > 0 THEN ? ELSE conversion_factor END,
                 pack = COALESCE(NULLIF(?, ''), pack)
             WHERE id = ?`,
            [itemConvVal, itemConvVal, itemPackStr, targetProductId]
          );
          
          const historyAction = isReturn ? 'return' : 'purchase';
          const historyNotes = isReturn ? `Returned via ${poNo}` : `Added from PO ${poNo}`;

          // Fetch sum of all batches for product history balance
          const [sumRows] = await conn.query(
            "SELECT SUM(available_qty) AS total FROM product_batches WHERE product_id = ?",
            [targetProductId]
          );
          const nextStock = Number(sumRows[0].total || 0);

          await conn.query(
            `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes, invoice_no)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [generateId(), req.auth.userId, targetProductId, historyAction, addedStock, nextStock, historyNotes, poNo]
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
