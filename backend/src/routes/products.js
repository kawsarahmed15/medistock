import { Router } from "express";
import { pool } from "../db.js";
import { buildApiError, generateId } from "../utils.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, category, price, cost_price, stock, expiry, batch, manufacturer, sku,
              prescription, tax_percent, created_at
       FROM products
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.auth.userId],
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};
    const id = generateId();
    await pool.query(
      `INSERT INTO products (id, user_id, name, category, price, cost_price, stock, expiry, batch,
         manufacturer, sku, prescription, tax_percent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.auth.userId,
        String(body.name || "").trim(),
        String(body.category || "General").trim() || "General",
        Number(body.price || 0),
        body.costPrice == null ? null : Number(body.costPrice),
        Number(body.stock || 0),
        String(body.expiry || "").slice(0, 10),
        body.batch ? String(body.batch).trim() : null,
        body.manufacturer ? String(body.manufacturer).trim() : null,
        body.sku ? String(body.sku).trim() : null,
        body.prescription ? 1 : 0,
        Number(body.taxPercent || 0),
      ],
    );

    const [rows] = await pool.query(
      `SELECT id, name, category, price, cost_price, stock, expiry, batch, manufacturer, sku,
              prescription, tax_percent, created_at
       FROM products
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [id, req.auth.userId],
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, category, price, cost_price, stock, expiry, batch, manufacturer, sku,
              prescription, tax_percent, created_at
       FROM products
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [req.params.id, req.auth.userId],
    );
    if (rows.length === 0) throw buildApiError(404, "Product not found");
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/history", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, action, quantity, balance, notes, created_at
       FROM product_history
       WHERE product_id = ? AND user_id = ?
       ORDER BY created_at DESC`,
      [req.params.id, req.auth.userId],
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/stock", async (req, res, next) => {
  try {
    const { action, quantity, notes } = req.body;
    if (!["stock_in", "stock_out", "purchase", "adjustment"].includes(action)) {
      throw buildApiError(400, "Invalid action");
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw buildApiError(400, "Quantity must be greater than 0");
    }

    const [rows] = await pool.query(
      "SELECT stock FROM products WHERE id = ? AND user_id = ? LIMIT 1",
      [req.params.id, req.auth.userId],
    );
    if (rows.length === 0) throw buildApiError(404, "Product not found");

    const currentStock = Number(rows[0].stock || 0);
    let nextStock = currentStock;

    if (action === "stock_out") {
      nextStock = Math.max(0, currentStock - qty);
    } else {
      nextStock = currentStock + qty;
    }

    const diff = nextStock - currentStock;

    // Update product stock
    await pool.query(
      "UPDATE products SET stock = ? WHERE id = ? AND user_id = ?",
      [nextStock, req.params.id, req.auth.userId],
    );

    // Insert history
    await pool.query(
      `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), req.auth.userId, req.params.id, action, diff, nextStock, notes || null],
    );

    res.json({ stock: nextStock, message: "Stock updated successfully" });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id || "");
    const body = req.body || {};
    const fields = [];
    const values = [];

    const map = {
      name: "name",
      category: "category",
      price: "price",
      stock: "stock",
      expiry: "expiry",
      batch: "batch",
      manufacturer: "manufacturer",
      sku: "sku",
      prescription: "prescription",
      taxPercent: "tax_percent",
      costPrice: "cost_price",
    };

    for (const [inputKey, dbKey] of Object.entries(map)) {
      if (Object.prototype.hasOwnProperty.call(body, inputKey)) {
        fields.push(`${dbKey} = ?`);
        let value = body[inputKey];
        if (["price", "taxPercent", "costPrice"].includes(inputKey) && value != null) value = Number(value);
        if (["stock"].includes(inputKey) && value != null) value = Number(value);
        if (inputKey === "prescription") value = value ? 1 : 0;
        if (["batch", "manufacturer", "sku", "costPrice"].includes(inputKey) && (value === "" || value == null)) {
          value = null;
        }
        values.push(value);
      }
    }

    if (fields.length === 0) {
      throw buildApiError(400, "No fields provided");
    }

    const validFields = fields.filter(Boolean);
    await pool.query(
      `UPDATE products SET ${validFields.join(", ")} WHERE id = ? AND user_id = ?`,
      [...values, id, req.auth.userId],
    );

    res.json({ message: "Product updated" });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM products WHERE id = ? AND user_id = ?", [req.params.id, req.auth.userId]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/:id/decrement", async (req, res, next) => {
  try {
    const qty = Number(req.body?.qty || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw buildApiError(400, "Quantity must be greater than 0");
    }
    const [rows] = await pool.query(
      "SELECT stock FROM products WHERE id = ? AND user_id = ? LIMIT 1",
      [req.params.id, req.auth.userId],
    );
    const row = rows[0];
    if (!row) {
      throw buildApiError(404, "Product not found");
    }
    const nextStock = Math.max(0, Number(row.stock || 0) - qty);
    await pool.query(
      "UPDATE products SET stock = ? WHERE id = ? AND user_id = ?",
      [nextStock, req.params.id, req.auth.userId],
    );
    res.json({ stock: nextStock });
  } catch (error) {
    next(error);
  }
});

export { router as productsRouter };
