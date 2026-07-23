import { Router } from "express";
import { pool, withTransaction } from "../db.js";
import { buildApiError, generateId } from "../utils.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// ─── Validation helpers ───────────────────────────────────────────────────────

const FIELD_LIMITS = {
  name: { max: 255, label: "Product name" },
  category: { max: 120, label: "Category" },
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
  if (value == null || value === "") return null;
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

  // Required fields on create (name is the only required field now, stock-related columns are optional/belong to batches)
  if (isCreate) {
    if (!body.name || !String(body.name).trim()) errors.push("Product name is required.");
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

  // Date validation for expiry if provided
  if (Object.prototype.hasOwnProperty.call(body, "expiry") && body.expiry) {
    const dateErr = validateDate(String(body.expiry).slice(0, 10), "Expiry date");
    if (dateErr) errors.push(dateErr);
  }

  return errors;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET all batches across all products (for Stock and Expiry reports)
router.get("/batches", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.product_id, b.batch_no, b.expiry_date, b.purchase_price, b.mrp, b.selling_price, b.available_qty,
              p.name AS name, p.category, p.manufacturer, p.sku, p.tax_percent
       FROM product_batches b
       JOIN products p ON b.product_id = p.id
       WHERE p.user_id = ?
       ORDER BY b.expiry_date ASC`,
      [req.auth.userId],
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET all products with their batches nested
router.get("/", async (req, res, next) => {
  try {
    const [products] = await pool.query(
      `SELECT id, name, category, manufacturer, sku, prescription, tax_percent, created_at, base_unit, pack_unit, conversion_factor, pack_price, pack_cost_price, pack
       FROM products
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.auth.userId],
    );

    if (products.length === 0) {
      res.json([]);
      return;
    }

    const ids = products.map((p) => p.id);
    const placeholders = ids.map(() => "?").join(",");
    const [batches] = await pool.query(
      `SELECT id, product_id, batch_no, expiry_date, manufacture_date, purchase_price, mrp, selling_price, available_qty, strip_qty, supplier_id, invoice_id, created_at
       FROM product_batches
       WHERE product_id IN (${placeholders})`,
      ids,
    );

    const map = new Map();
    for (const batch of batches) {
      const arr = map.get(batch.product_id) || [];
      arr.push(batch);
      map.set(batch.product_id, arr);
    }

    const data = products.map((product) => ({
      ...product,
      batches: map.get(product.id) || [],
    }));

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET single product details with batches nested
router.get("/:id", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, category, manufacturer, sku, prescription, tax_percent, created_at, base_unit, pack_unit, conversion_factor, pack_price, pack_cost_price, pack
       FROM products
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [req.params.id, req.auth.userId],
    );
    const product = rows[0];
    if (!product) throw buildApiError(404, "Product not found");

    const [batches] = await pool.query(
      `SELECT id, product_id, batch_no, expiry_date, manufacture_date, purchase_price, mrp, selling_price, available_qty, strip_qty, supplier_id, invoice_id, created_at
       FROM product_batches
       WHERE product_id = ?`,
      [product.id],
    );

    res.json({ ...product, batches });
  } catch (error) {
    next(error);
  }
});

// POST create a product
router.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};

    const validationErrors = validateProductBody(body, true);
    if (validationErrors.length > 0) {
      return next(buildApiError(400, validationErrors.join(" | ")));
    }

    const id = generateId();
    const stockToImport = Number(body.stock || 0);

    const createdProduct = await withTransaction(async (conn) => {
      // Check if product with same name already exists
      const [existing] = await conn.query(
        "SELECT id FROM products WHERE user_id = ? AND LOWER(name) = ? LIMIT 1",
        [req.auth.userId, String(body.name || "").trim().toLowerCase()]
      );
      if (existing.length > 0) {
        throw buildApiError(400, "Product is already added in inventory");
      }

      // 1. Insert product
      await conn.query(
        `INSERT INTO products (id, user_id, name, category, pack, manufacturer, sku, prescription, tax_percent, base_unit, pack_unit, conversion_factor, pack_price, pack_cost_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          req.auth.userId,
          String(body.name || "").trim(),
          String(body.category || "General").trim() || "General",
          body.pack ? String(body.pack).trim() : null,
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

      // 2. Insert initial batch if stock > 0 OR batch/expiry parameters are provided
      const batchNo = body.batch ? String(body.batch).trim() : "DEFAULT";
      const expiryDate = body.expiry ? String(body.expiry).slice(0, 10) : "2030-12-31";
      const purchasePriceVal = body.costPrice == null ? 0 : Number(body.costPrice);
      const mrpVal = body.mrp == null ? 0 : Number(body.mrp);
      const sellingPriceVal = body.price == null ? 0 : Number(body.price);

      // Always create a default batch record if stock is entered or if we explicitly have a batch/expiry
      if (stockToImport > 0 || body.batch || body.expiry) {
        await conn.query(
          `INSERT INTO product_batches (id, product_id, batch_no, expiry_date, purchase_price, mrp, selling_price, available_qty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generateId(),
            id,
            batchNo,
            expiryDate,
            purchasePriceVal,
            mrpVal,
            sellingPriceVal,
            stockToImport
          ]
        );

        if (stockToImport > 0) {
          // Create a mock purchase invoice for inventory intake logging
          const [countRows] = await conn.query(
            "SELECT COUNT(*) AS total FROM purchases WHERE user_id = ?",
            [req.auth.userId],
          );
          const poNo = `PO-${String(Number(countRows[0].total || 0) + 1).padStart(4, "0")}`;
          const purchaseId = generateId();

          const subtotalVal = purchasePriceVal * stockToImport;
          const taxVal = subtotalVal * (Number(body.taxPercent || 0) / 100);
          const totalVal = subtotalVal + taxVal;

          await conn.query(
            `INSERT INTO purchases (id, user_id, number, supplier_name, supplier_phone, supplier_invoice, notes, created_by, payment_status, payment_method, amount_paid, subtotal, tax, discount, total)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              purchaseId,
              req.auth.userId,
              poNo,
              body.manufacturer || "Initial Stock Supplier",
              null,
              `INIT-${id.slice(0, 6).toUpperCase()}`,
              "Auto-generated for initial inventory stock entry",
              req.auth.userName || "System",
              "paid",
              "cash",
              totalVal,
              subtotalVal,
              taxVal,
              0,
              totalVal,
            ],
          );

          await conn.query(
            `INSERT INTO purchase_items (id, purchase_id, user_id, product_id, name, sku, qty, cost_price, tax_percent, mrp, batch, pack, expiry, free_qty)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
              generateId(),
              purchaseId,
              req.auth.userId,
              id,
              String(body.name || "").trim(),
              body.sku || null,
              stockToImport,
              purchasePriceVal,
              Number(body.taxPercent || 0),
              body.mrp == null || body.mrp === "" ? null : Number(body.mrp),
              batchNo,
              body.pack ? String(body.pack).trim() : null,
              expiryDate,
            ],
          );

          await conn.query(
            `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes)
             VALUES (?, ?, ?, 'purchase', ?, ?, ?)`,
            [generateId(), req.auth.userId, id, stockToImport, stockToImport, `Added initial stock via PO ${poNo}`]
          );
        }
      }

      // Fetch product and its batches
      const [pRows] = await conn.query(
        `SELECT id, name, category, manufacturer, sku, prescription, tax_percent, created_at, base_unit, pack_unit, conversion_factor, pack_price, pack_cost_price, pack
         FROM products
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [id, req.auth.userId],
      );
      const product = pRows[0];

      const [bRows] = await conn.query(
        `SELECT id, product_id, batch_no, expiry_date, manufacture_date, purchase_price, mrp, selling_price, available_qty, strip_qty, supplier_id, invoice_id, created_at
         FROM product_batches
         WHERE product_id = ?`,
        [id],
      );
      product.batches = bRows;

      return product;
    });

    res.status(201).json(createdProduct);
  } catch (error) {
    next(error);
  }
});

// GET product history
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

// POST adjust stock (stock inward/outward)
router.post("/:id/stock", async (req, res, next) => {
  try {
    const { action, quantity, notes, supplierName, supplierPhone, supplierInvoice, batch: reqBatch } = req.body;
    if (!["stock_in", "stock_out", "purchase", "adjustment"].includes(action)) {
      throw buildApiError(400, "Invalid action");
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw buildApiError(400, "Quantity must be greater than 0");
    }

    const updated = await withTransaction(async (conn) => {
      const [rows] = await conn.query(
        `SELECT id, name, tax_percent, sku FROM products WHERE id = ? AND user_id = ? LIMIT 1`,
        [req.params.id, req.auth.userId],
      );
      const product = rows[0];
      if (!product) throw buildApiError(404, "Product not found");

      const targetBatchNo = reqBatch ? String(reqBatch).trim() : "DEFAULT";

      // Look up target batch
      const [batchRows] = await conn.query(
        "SELECT id, available_qty FROM product_batches WHERE product_id = ? AND batch_no = ? LIMIT 1",
        [product.id, targetBatchNo]
      );

      let batch = batchRows[0];
      let currentStock = batch ? Number(batch.available_qty || 0) : 0;
      let nextStock = currentStock;

      if (action === "stock_out") {
        if (!batch) {
          throw buildApiError(400, `Batch ${targetBatchNo} not found for this product`);
        }
        nextStock = Math.max(0, currentStock - qty);
        await conn.query("UPDATE product_batches SET available_qty = ? WHERE id = ?", [
          nextStock,
          batch.id,
        ]);
      } else {
        // stock_in, purchase, adjustment (positive adjustment)
        if (batch) {
          nextStock = currentStock + qty;
          await conn.query("UPDATE product_batches SET available_qty = ? WHERE id = ?", [
            nextStock,
            batch.id,
          ]);
        } else {
          // Create new batch
          const newBatchId = generateId();
          await conn.query(
            `INSERT INTO product_batches (id, product_id, batch_no, expiry_date, purchase_price, mrp, selling_price, available_qty)
             VALUES (?, ?, ?, ?, 0, 0, 0, ?)`,
            [newBatchId, product.id, targetBatchNo, "2030-12-31", qty]
          );
          nextStock = qty;
        }
      }

      // Fetch new total product stock for history
      const [sumRows] = await conn.query(
        "SELECT SUM(available_qty) AS total FROM product_batches WHERE product_id = ?",
        [product.id]
      );
      const totalStock = Number(sumRows[0].total || 0);

      await conn.query(
        `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(),
          req.auth.userId,
          product.id,
          action === "stock_out" ? "stock_out" : "purchase",
          qty,
          totalStock,
          notes || `Stock adjustment (${action}) for batch ${targetBatchNo}`
        ],
      );

      return { stock: totalStock };
    });

    res.json({ stock: updated.stock, message: "Stock updated successfully" });
  } catch (error) {
    next(error);
  }
});

// PATCH update product details
router.patch("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id || "");
    const body = req.body || {};

    const validationErrors = validateProductBody(body, false);
    if (validationErrors.length > 0) {
      return next(buildApiError(400, validationErrors.join(" | ")));
    }

    const fields = [];
    const values = [];

    // Fields that actually belong to products (excluding batch/stock/price/mrp/expiry/costPrice)
    const map = {
      name: "name",
      category: "category",
      pack: "pack",
      manufacturer: "manufacturer",
      sku: "sku",
      prescription: "prescription",
      taxPercent: "tax_percent",
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
        if (["taxPercent", "packPrice", "packCostPrice", "conversionFactor"].includes(inputKey) && value != null) {
          value = Number(value);
        }
        if (inputKey === "prescription") value = value ? 1 : 0;
        if (["pack", "manufacturer", "sku", "packPrice", "packCostPrice"].includes(inputKey) && (value === "" || value == null)) {
          value = null;
        }
        values.push(value);
      }
    }

    if (body.name) {
      const [existing] = await pool.query(
        "SELECT id FROM products WHERE user_id = ? AND LOWER(name) = ? AND id != ? LIMIT 1",
        [req.auth.userId, String(body.name).trim().toLowerCase(), id]
      );
      if (existing.length > 0) {
        throw buildApiError(400, "Product is already added in inventory");
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

// DELETE a product
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

// POST decrement product stock (handles specific batch ID or applies FEFO)
router.post("/:id/decrement", async (req, res, next) => {
  try {
    const qty = Number(req.body?.qty || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw buildApiError(400, "Quantity must be greater than 0");
    }

    const updated = await withTransaction(async (conn) => {
      // 1. Check if the ID matches a batch ID in product_batches
      let [batchRows] = await conn.query(
        `SELECT b.id, b.product_id, b.available_qty, b.batch_no, p.name 
         FROM product_batches b 
         JOIN products p ON b.product_id = p.id
         WHERE b.id = ? AND p.user_id = ? LIMIT 1`,
        [req.params.id, req.auth.userId]
      );

      let batch = batchRows[0];
      let productId = req.params.id;

      if (batch) {
        productId = batch.product_id;
        const nextQty = Math.max(0, Number(batch.available_qty || 0) - qty);
        await conn.query(
          "UPDATE product_batches SET available_qty = ? WHERE id = ?",
          [nextQty, batch.id]
        );

        // Fetch sum of all batches for product history
        const [sumRows] = await conn.query(
          "SELECT SUM(available_qty) AS total FROM product_batches WHERE product_id = ?",
          [productId]
        );
        const nextStock = Number(sumRows[0].total || 0);

        await conn.query(
          `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes)
           VALUES (?, ?, ?, 'stock_out', ?, ?, ?)`,
          [
            generateId(),
            req.auth.userId,
            productId,
            qty,
            nextStock,
            `Decremented stock from batch ${batch.batch_no} during sale`
          ]
        );
        return { stock: nextStock };
      } else {
        // ID is a product ID, find batches using FEFO (First Expire First Out)
        const [batches] = await conn.query(
          `SELECT id, batch_no, available_qty 
           FROM product_batches 
           WHERE product_id = ? 
           ORDER BY expiry_date ASC`,
          [productId]
        );

        if (batches.length === 0) {
          throw buildApiError(404, "No batches found for this product to decrement");
        }

        let remainingQtyToDecrement = qty;
        for (const b of batches) {
          if (remainingQtyToDecrement <= 0) break;
          const toDecrement = Math.min(b.available_qty, remainingQtyToDecrement);
          if (toDecrement > 0) {
            await conn.query(
              "UPDATE product_batches SET available_qty = available_qty - ? WHERE id = ?",
              [toDecrement, b.id]
            );
            remainingQtyToDecrement -= toDecrement;
          }
        }

        if (remainingQtyToDecrement > 0) {
          await conn.query(
            "UPDATE product_batches SET available_qty = available_qty - ? WHERE id = ?",
            [remainingQtyToDecrement, batches[0].id]
          );
        }

        // Fetch sum of all batches for product history
        const [sumRows] = await conn.query(
          "SELECT SUM(available_qty) AS total FROM product_batches WHERE product_id = ?",
          [productId]
        );
        const nextStock = Number(sumRows[0].total || 0);

        await conn.query(
          `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes)
           VALUES (?, ?, ?, 'stock_out', ?, ?, ?)`,
          [
            generateId(),
            req.auth.userId,
            productId,
            qty,
            nextStock,
            `Decremented stock during sale (FEFO auto-select)`
          ]
        );
        return { stock: nextStock };
      }
    });

    res.json({ stock: updated.stock, message: "Stock decremented successfully" });
  } catch (error) {
    next(error);
  }
});

// ─── Batch Management Endpoints ───────────────────────────────────────────────

// Create a new batch for a product
router.post("/:productId/batches", async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { batchNo, expiryDate, manufactureDate, purchasePrice, mrp, sellingPrice, availableQty, stripQty, supplierId, invoiceId } = req.body;

    if (!batchNo || !batchNo.trim()) {
      throw buildApiError(400, "Batch number is required");
    }
    if (!expiryDate) {
      throw buildApiError(400, "Expiry date is required");
    }

    const batchId = generateId();
    await pool.query(
      `INSERT INTO product_batches (id, product_id, batch_no, expiry_date, manufacture_date, purchase_price, mrp, selling_price, available_qty, strip_qty, supplier_id, invoice_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId,
        productId,
        String(batchNo).trim(),
        String(expiryDate).slice(0, 10),
        manufactureDate ? String(manufactureDate).slice(0, 10) : null,
        Number(purchasePrice || 0),
        Number(mrp || 0),
        Number(sellingPrice || 0),
        Number(availableQty || 0),
        stripQty != null ? Number(stripQty) : null,
        supplierId || null,
        invoiceId || null
      ]
    );

    // Insert history
    await pool.query(
      `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes)
       VALUES (?, ?, ?, 'purchase', ?, (SELECT SUM(available_qty) FROM product_batches WHERE product_id = ?), ?)`,
      [generateId(), req.auth.userId, productId, Number(availableQty || 0), productId, `Batch ${batchNo} created via ERP`]
    );

    res.status(201).json({ id: batchId, message: "Batch created successfully" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      next(buildApiError(400, "Batch number already exists for this product"));
    } else {
      next(error);
    }
  }
});

// Update a batch
router.patch("/batches/:batchId", async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const body = req.body || {};

    const fields = [];
    const values = [];

    const map = {
      batchNo: "batch_no",
      expiryDate: "expiry_date",
      manufactureDate: "manufacture_date",
      purchasePrice: "purchase_price",
      mrp: "mrp",
      sellingPrice: "selling_price",
      availableQty: "available_qty",
      stripQty: "strip_qty",
      supplierId: "supplier_id",
      invoiceId: "invoice_id",
    };

    for (const [inputKey, dbKey] of Object.entries(map)) {
      if (Object.prototype.hasOwnProperty.call(body, inputKey)) {
        fields.push(`${dbKey} = ?`);
        let val = body[inputKey];
        if (["purchasePrice", "mrp", "sellingPrice", "availableQty", "stripQty"].includes(inputKey) && val != null) {
          val = Number(val);
        }
        if (["expiryDate", "manufactureDate"].includes(inputKey) && val) {
          val = String(val).slice(0, 10);
        }
        values.push(val);
      }
    }

    if (fields.length === 0) {
      throw buildApiError(400, "No fields provided");
    }

    await pool.query(
      `UPDATE product_batches SET ${fields.join(", ")} WHERE id = ?`,
      [...values, batchId]
    );

    res.json({ message: "Batch updated successfully" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      next(buildApiError(400, "Batch number already exists for this product"));
    } else {
      next(error);
    }
  }
});

// Delete a batch
router.delete("/batches/:batchId", async (req, res, next) => {
  try {
    const { batchId } = req.params;
    await pool.query("DELETE FROM product_batches WHERE id = ?", [batchId]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { router as productsRouter };
