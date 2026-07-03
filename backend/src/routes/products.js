import { Router } from "express";
import { pool } from "../db.js";
import { buildApiError, generateId } from "../utils.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// ─── Validation helpers ───────────────────────────────────────────────────────

const FIELD_LIMITS = {
  name: { max: 255, label: "Product name" },
  category: { max: 120, label: "Category" },
  batch: { max: 120, label: "Batch" },
  manufacturer: { max: 180, label: "Manufacturer" },
  sku: { max: 120, label: "HSN / SKU code" },
  pack: { max: 50, label: "Pack" },
  baseUnit: { max: 50, label: "Base unit" },
  packUnit: { max: 50, label: "Pack unit" },
};

/**
 * Validates a YYYY-MM-DD date string and returns a friendly error if invalid.
 */
function validateDate(value, fieldLabel = "Expiry date") {
  if (!value || typeof value !== "string") {
    return `${fieldLabel} is required.`;
  }
  const parts = value.split("-");
  if (parts.length !== 3) {
    return `${fieldLabel} must be in YYYY-MM-DD format (got "${value}").`;
  }
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) {
    return `${fieldLabel} contains non-numeric parts (got "${value}").`;
  }
  if (m < 1 || m > 12) {
    return `${fieldLabel} has an invalid month "${m}" (must be 01–12).`;
  }
  if (d < 1 || d > 31) {
    return `${fieldLabel} has an invalid day "${d}" (must be 01–31).`;
  }
  // Use the Date constructor as final check
  const dt = new Date(value);
  if (isNaN(dt.getTime()) || dt.getMonth() + 1 !== m) {
    return `${fieldLabel} "${value}" is not a valid calendar date.`;
  }
  return null;
}

/**
 * Validates numeric fields and returns a friendly error if out-of-range.
 */
function validateNumber(value, fieldLabel, { min = null, max = null, decimals = 2 } = {}) {
  if (value == null || value === "") return null; // nullable fields are OK
  const n = Number(value);
  if (isNaN(n) || !isFinite(n)) {
    return `${fieldLabel} must be a valid number (got "${value}").`;
  }
  if (min !== null && n < min) {
    return `${fieldLabel} must be at least ${min} (got ${n}).`;
  }
  if (max !== null && n > max) {
    return `${fieldLabel} must be at most ${max} (got ${n}).`;
  }
  // Check decimal places for DECIMAL(12,2) → max value = 9999999999.99
  const maxDecimalVal = 10 ** (12 - decimals) - 0.01;
  if (Math.abs(n) > maxDecimalVal) {
    return `${fieldLabel} is too large (max ${maxDecimalVal}).`;
  }
  return null;
}

/**
 * Validates string field lengths.
 */
function validateStringLength(value, fieldLabel, maxLen) {
  if (!value) return null;
  const str = String(value);
  if (str.length > maxLen) {
    return `${fieldLabel} is too long — max ${maxLen} characters (got ${str.length}).`;
  }
  return null;
}

/**
 * Run all product field validations and return an array of error messages.
 */
function validateProductBody(body, isCreate = false) {
  const errors = [];

  // Required fields on create
  if (isCreate) {
    if (!body.name || !String(body.name).trim()) errors.push("Product name is required.");
    if (body.price == null || body.price === "") errors.push("Selling price is required.");
    if (body.costPrice == null || body.costPrice === "") errors.push("Buying price (cost price) is required.");
    if (body.stock == null || body.stock === "") errors.push("Stock quantity is required.");
    if (!body.expiry) errors.push("Expiry date is required.");
  }

  // String length limits
  for (const [key, { max, label }] of Object.entries(FIELD_LIMITS)) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      const err = validateStringLength(body[key], label, max);
      if (err) errors.push(err);
    }
  }

  // Numeric ranges
  const numericFields = [
    { key: "price", label: "Selling price", min: 0 },
    { key: "costPrice", label: "Buying price", min: 0 },
    { key: "mrp", label: "MRP", min: 0 },
    { key: "stock", label: "Stock quantity", min: 0, max: 2147483647, decimals: 0 },
    { key: "taxPercent", label: "Tax %", min: 0, max: 999.99 },
    { key: "packPrice", label: "Pack selling price", min: 0 },
    { key: "packCostPrice", label: "Pack buying price", min: 0 },
    { key: "conversionFactor", label: "Conversion factor", min: 0.0001 },
  ];

  for (const { key, label, min, max, decimals } of numericFields) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] != null && body[key] !== "") {
      const err = validateNumber(body[key], label, { min, max, decimals: decimals ?? 2 });
      if (err) errors.push(err);
    }
  }

  // Date validation for expiry
  if (Object.prototype.hasOwnProperty.call(body, "expiry") && body.expiry) {
    const dateErr = validateDate(String(body.expiry).slice(0, 10), "Expiry date");
    if (dateErr) errors.push(dateErr);
  }

  return errors;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, category, price, cost_price, stock, expiry, mrp, pack, batch, manufacturer, sku,
              prescription, tax_percent, created_at, base_unit, pack_unit, conversion_factor, pack_price, pack_cost_price
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

    // Validate input before touching the DB
    const validationErrors = validateProductBody(body, true);
    if (validationErrors.length > 0) {
      return next(buildApiError(400, validationErrors.join(" | ")));
    }

    const id = generateId();
    await pool.query(
      `INSERT INTO products (id, user_id, name, category, price, cost_price, stock, expiry, mrp, pack, batch,
         manufacturer, sku, prescription, tax_percent, base_unit, pack_unit, conversion_factor, pack_price, pack_cost_price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.auth.userId,
        String(body.name || "").trim(),
        String(body.category || "General").trim() || "General",
        Number(body.price || 0),
        body.costPrice == null ? null : Number(body.costPrice),
        Number(body.stock || 0),
        String(body.expiry || "").slice(0, 10),
        body.mrp == null || body.mrp === "" ? null : Number(body.mrp),
        body.pack ? String(body.pack).trim() : null,
        body.batch ? String(body.batch).trim() : null,
        body.manufacturer ? String(body.manufacturer).trim() : null,
        body.sku ? String(body.sku).trim() : null,
        body.prescription ? 1 : 0,
        Number(body.taxPercent || 0),
        String(body.baseUnit || "Unit").trim() || "Unit",
        String(body.packUnit || "Pack").trim() || "Pack",
        Number(body.conversionFactor || 1) || 1,
        body.packPrice == null ? null : Number(body.packPrice),
        body.packCostPrice == null ? null : Number(body.packCostPrice),
      ],
    );

    const [rows] = await pool.query(
      `SELECT id, name, category, price, cost_price, stock, expiry, mrp, pack, batch, manufacturer, sku,
              prescription, tax_percent, created_at, base_unit, pack_unit, conversion_factor, pack_price, pack_cost_price
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
      `SELECT id, name, category, price, cost_price, stock, expiry, mrp, pack, batch, manufacturer, sku,
              prescription, tax_percent, created_at, base_unit, pack_unit, conversion_factor, pack_price, pack_cost_price
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

    await pool.query("UPDATE products SET stock = ? WHERE id = ? AND user_id = ?", [
      nextStock,
      req.params.id,
      req.auth.userId,
    ]);

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

    // Validate input before touching the DB
    const validationErrors = validateProductBody(body, false);
    if (validationErrors.length > 0) {
      return next(buildApiError(400, validationErrors.join(" | ")));
    }

    const fields = [];
    const values = [];

    const map = {
      name: "name",
      category: "category",
      price: "price",
      stock: "stock",
      expiry: "expiry",
      mrp: "mrp",
      pack: "pack",
      batch: "batch",
      manufacturer: "manufacturer",
      sku: "sku",
      prescription: "prescription",
      taxPercent: "tax_percent",
      costPrice: "cost_price",
      baseUnit: "base_unit",
      packUnit: "pack_unit",
      conversionFactor: "conversion_factor",
      packPrice: "pack_price",
      packCostPrice: "pack_cost_price",
    };

    for (const [inputKey, dbKey] of Object.entries(map)) {
      if (Object.prototype.hasOwnProperty.call(body, inputKey)) {
        fields.push(`${dbKey} = ?`);
        let value = body[inputKey];
        if (
          [
            "price",
            "taxPercent",
            "costPrice",
            "mrp",
            "packPrice",
            "packCostPrice",
            "conversionFactor",
          ].includes(inputKey) &&
          value != null
        )
          value = Number(value);
        if (["stock"].includes(inputKey) && value != null) value = Number(value);
        if (inputKey === "prescription") value = value ? 1 : 0;
        if (
          [
            "pack",
            "batch",
            "manufacturer",
            "sku",
            "costPrice",
            "mrp",
            "packPrice",
            "packCostPrice",
          ].includes(inputKey) &&
          (value === "" || value == null)
        ) {
          value = null;
        }
        values.push(value);
      }
    }

    if (fields.length === 0) {
      throw buildApiError(400, "No fields provided");
    }

    const validFields = fields.filter(Boolean);
    await pool.query(`UPDATE products SET ${validFields.join(", ")} WHERE id = ? AND user_id = ?`, [
      ...values,
      id,
      req.auth.userId,
    ]);

    res.json({ message: "Product updated" });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await pool.query("DELETE FROM products WHERE id = ? AND user_id = ?", [
      req.params.id,
      req.auth.userId,
    ]);
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
    await pool.query("UPDATE products SET stock = ? WHERE id = ? AND user_id = ?", [
      nextStock,
      req.params.id,
      req.auth.userId,
    ]);
    res.json({ stock: nextStock });
  } catch (error) {
    next(error);
  }
});

export { router as productsRouter };
