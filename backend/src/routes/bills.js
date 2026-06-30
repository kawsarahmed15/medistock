import { Router } from "express";
import { pool, withTransaction } from "../db.js";
import { buildApiError, generateId } from "../utils.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const [bills] = await pool.query(
      `SELECT id, number, customer_name, customer_phone, customer_address, customer_drug_lic_no, cashier, payment_method, advance_amount, subtotal, tax, discount, total, created_at
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
      `SELECT id, number, customer_name, customer_phone, customer_address, customer_drug_lic_no, customer_notes, cashier, payment_method, advance_amount,
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
    const created = await withTransaction(async (conn) => {
      const [countRows] = await conn.query(
        "SELECT COUNT(*) AS total FROM bills WHERE user_id = ?",
        [req.auth.userId],
      );
      const invoiceNo = `INV-${String(Number(countRows[0].total || 0) + 1).padStart(4, "0")}`;

      const id = generateId();
      await conn.query(
          `INSERT INTO bills (id, user_id, number, customer_name, customer_phone, customer_address, customer_drug_lic_no, customer_notes,
             cashier, payment_method, advance_amount, subtotal, tax, discount, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            req.auth.userId,
            invoiceNo,
            body.customerName || null,
            body.customerPhone || null,
            body.customerAddress || null,
            body.customerDrugLicNo || null,
            body.customerNotes || null,
            body.cashier || null,
            ["cash", "online", "credit"].includes(body.paymentMethod) ? body.paymentMethod : "cash",
            Number(body.advanceAmount || 0),
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
      }

      return { id, number: invoiceNo };
    });

    const [rows] = await pool.query(
      `SELECT id, number, customer_name, customer_phone, customer_address, customer_drug_lic_no, customer_notes, cashier, payment_method,
              advance_amount, subtotal, tax, discount, total, created_at
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
