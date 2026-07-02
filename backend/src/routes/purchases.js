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
       LIMIT 50`,
      [req.auth.userId],
    );

    if (purchases.length === 0) {
      res.json([]);
      return;
    }

    const ids = purchases.map((p) => p.id);
    const placeholders = ids.map(() => "?").join(",");
    const [items] = await pool.query(
      `SELECT purchase_id, product_id, name, sku, qty, cost_price, tax_percent, mrp, batch, pack, expiry, free_qty
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
      `SELECT purchase_id, product_id, name, sku, qty, cost_price, tax_percent, mrp, batch, pack, expiry, free_qty
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
    const created = await withTransaction(async (conn) => {
      const [countRows] = await conn.query(
        "SELECT COUNT(*) AS total FROM purchases WHERE user_id = ?",
        [req.auth.userId],
      );
      const poNo = `PO-${String(Number(countRows[0].total || 0) + 1).padStart(4, "0")}`;

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
          `INSERT INTO purchase_items (id, purchase_id, user_id, product_id, name, sku, qty, cost_price, tax_percent, mrp, batch, pack, expiry, free_qty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generateId(),
            id,
            req.auth.userId,
            item.productId || null,
            item.name,
            item.sku || null,
            Number(item.qty || 0),
            item.costPrice == null ? null : Number(item.costPrice),
            Number(item.taxPercent || 0),
            item.mrp == null || item.mrp === "" ? null : Number(item.mrp),
            item.batch ? String(item.batch).trim() : null,
            item.pack ? String(item.pack).trim() : null,
            item.expiry ? String(item.expiry).slice(0, 10) : null,
            Number(item.freeQty || 0),
          ],
        );

        // Update product stock and cost price
        if (item.productId) {
          const addedStock = Number(item.qty || 0) + Number(item.freeQty || 0);
          await conn.query(
            `UPDATE products SET stock = stock + ?, cost_price = ? WHERE id = ? AND user_id = ?`,
            [addedStock, Number(item.costPrice || 0), item.productId, req.auth.userId]
          );
          
          await conn.query(
            `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes)
             VALUES (?, ?, ?, 'purchase', ?, (SELECT stock FROM products WHERE id = ?), ?)`,
            [generateId(), req.auth.userId, item.productId, addedStock, item.productId, `Added from PO ${poNo}`]
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
