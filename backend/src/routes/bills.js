import { Router } from "express";
import { pool, withTransaction } from "../db.js";
import { buildApiError, generateId } from "../utils.js";
import { requireAuth, requireAdminOnly } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/pending-count", async (req, res, next) => {
  try {
    let query = `SELECT COUNT(*) AS count FROM bills WHERE user_id = ? AND status = 'pending'`;
    const params = [req.auth.userId];

    if (req.auth.isEmployee) {
      const empName = req.auth.employeeName || req.auth.name;
      if (req.auth.employeeId) {
        query += ` AND (employee_id = ? OR created_by_name = ? OR cashier = ?)`;
        params.push(req.auth.employeeId, empName, empName);
      } else {
        query += ` AND (created_by_name = ? OR cashier = ?)`;
        params.push(empName, empName);
      }
    }

    const [rows] = await pool.query(query, params);
    res.json({ count: Number(rows[0]?.count || 0) });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const statusParam = req.query.status ? String(req.query.status).trim().toLowerCase() : null;
    let query = `SELECT id, number, customer_name, customer_phone, customer_address, customer_drug_lic_no, customer_gstin, customer_notes, cashier, payment_method, advance_amount, advance_payment_method, subtotal, tax, discount, total, status, created_by_role, created_by_name, employee_id, approved_at, approved_by, created_at
       FROM bills
       WHERE user_id = ?`;
    const params = [req.auth.userId];

    if (req.auth.isEmployee) {
      const empName = req.auth.employeeName || req.auth.name;
      if (req.auth.employeeId) {
        query += ` AND (employee_id = ? OR created_by_name = ? OR cashier = ?)`;
        params.push(req.auth.employeeId, empName, empName);
      } else {
        query += ` AND (created_by_name = ? OR cashier = ?)`;
        params.push(empName, empName);
      }
    } else {
      const employeeIdParam = req.query.employeeId ? String(req.query.employeeId).trim() : null;
      if (employeeIdParam) {
        query += ` AND (employee_id = ? OR created_by_name = ?)`;
        params.push(employeeIdParam, employeeIdParam);
      }
    }

    if (statusParam === "pending") {
      query += ` AND status = 'pending'`;
    } else if (statusParam === "completed") {
      query += ` AND (status = 'completed' OR status IS NULL)`;
    } else if (statusParam === "rejected") {
      query += ` AND status = 'rejected'`;
    }

    query += ` ORDER BY created_at DESC LIMIT 500`;

    const [bills] = await pool.query(query, params);

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
    let query = `SELECT id, number, customer_name, customer_phone, customer_address, customer_drug_lic_no, customer_gstin, customer_notes, cashier, payment_method, advance_amount, advance_payment_method,
              subtotal, tax, discount, total, status, created_by_role, created_by_name, employee_id, approved_at, approved_by, created_at
       FROM bills
       WHERE user_id = ? AND id = ?`;
    const params = [req.auth.userId, req.params.id];

    if (req.auth.isEmployee) {
      const empName = req.auth.employeeName || req.auth.name;
      if (req.auth.employeeId) {
        query += ` AND (employee_id = ? OR created_by_name = ? OR cashier = ?)`;
        params.push(req.auth.employeeId, empName, empName);
      } else {
        query += ` AND (created_by_name = ? OR cashier = ?)`;
        params.push(empName, empName);
      }
    }

    query += ` LIMIT 1`;

    const [rows] = await pool.query(query, params);
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

async function applyStockDeduction(conn, userId, items, invoiceNo, actorName) {
  for (const item of items) {
    let targetProductId = item.productId || item.product_id || null;

    // 1. Verify targetProductId actually exists in products table for this user
    if (targetProductId) {
      const [pCheck] = await conn.query(
        "SELECT id FROM products WHERE user_id = ? AND id = ? LIMIT 1",
        [userId, targetProductId]
      );
      if (pCheck.length === 0) {
        targetProductId = null;
      }
    }

    // 2. Fallback: match by product name or sku if ID was not valid or not found
    if (!targetProductId && (item.name || item.sku)) {
      const [pMatch] = await conn.query(
        "SELECT id FROM products WHERE user_id = ? AND (name = ? OR (sku IS NOT NULL AND sku = ?)) LIMIT 1",
        [userId, item.name, item.sku || "___NO_SKU___"]
      );
      if (pMatch.length > 0) {
        targetProductId = pMatch[0].id;
      }
    }

    // 3. If targetProductId is valid in products table, deduct batch stock & log history
    if (targetProductId) {
      const totalItemQty = Math.abs(Number(item.qty || 0)) + Math.abs(Number(item.freeQty || item.free_qty || 0));
      if (totalItemQty > 0) {
        let batches = [];
        if (item.batch) {
          const [bMatch] = await conn.query(
            "SELECT id, batch_no, available_qty FROM product_batches WHERE product_id = ? AND batch_no = ? LIMIT 1",
            [targetProductId, String(item.batch).trim()]
          );
          batches = bMatch;
        }

        if (batches.length === 0) {
          const [allBatches] = await conn.query(
            "SELECT id, batch_no, available_qty FROM product_batches WHERE product_id = ? ORDER BY expiry_date ASC",
            [targetProductId]
          );
          batches = allBatches;
        }

        let remainingToDec = totalItemQty;
        for (let idx = 0; idx < batches.length; idx++) {
          const b = batches[idx];
          if (remainingToDec <= 0) break;

          if (idx === batches.length - 1 && remainingToDec > b.available_qty) {
            const nextQty = b.available_qty - remainingToDec;
            await conn.query("UPDATE product_batches SET available_qty = ? WHERE id = ?", [nextQty, b.id]);
            remainingToDec = 0;
          } else {
            const toDec = Math.min(b.available_qty, remainingToDec);
            if (toDec > 0) {
              const nextQty = b.available_qty - toDec;
              if (nextQty <= 0 && batches.length > 1) {
                await conn.query("DELETE FROM product_batches WHERE id = ?", [b.id]);
              } else {
                await conn.query("UPDATE product_batches SET available_qty = ? WHERE id = ?", [nextQty, b.id]);
              }
              remainingToDec -= toDec;
            }
          }
        }

        const [sumRows] = await conn.query(
          "SELECT COALESCE(SUM(available_qty), 0) AS total FROM product_batches WHERE product_id = ?",
          [targetProductId]
        );
        const nextStock = Number(sumRows[0]?.total || 0);

        try {
          await conn.query(
            `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes)
             VALUES (?, ?, ?, 'sale', ?, ?, ?)`,
            [
              generateId(),
              userId,
              targetProductId,
              totalItemQty,
              nextStock,
              `Sale via ${invoiceNo} by ${actorName || "Admin"}`
            ]
          );
        } catch (histErr) {
          console.warn("Product history log skipped:", histErr.message);
        }
      }
    }
  }
}

async function applyReturnStock(conn, userId, items, invoiceNo) {
  for (const item of items) {
    let targetProductId = item.productId || item.product_id || null;

    if (targetProductId) {
      const [pCheck] = await conn.query(
        "SELECT id FROM products WHERE user_id = ? AND id = ? LIMIT 1",
        [userId, targetProductId]
      );
      if (pCheck.length === 0) {
        targetProductId = null;
      }
    }

    if (!targetProductId && (item.name || item.sku)) {
      const [pMatch] = await conn.query(
        "SELECT id FROM products WHERE user_id = ? AND (name = ? OR (sku IS NOT NULL AND sku = ?)) LIMIT 1",
        [userId, item.name, item.sku || "___NO_SKU___"]
      );
      if (pMatch.length > 0) {
        targetProductId = pMatch[0].id;
      }
    }

    if (targetProductId) {
      const returnQty = Math.abs(Number(item.qty || 0)) + Math.abs(Number(item.freeQty || item.free_qty || 0));
      if (returnQty > 0) {
        const itemBatchNo = item.batch ? String(item.batch).trim() : "DEFAULT";

        const [existingBatch] = await conn.query(
          `SELECT id FROM product_batches WHERE product_id = ? AND batch_no = ? LIMIT 1`,
          [targetProductId, itemBatchNo]
        );

        if (existingBatch.length > 0) {
          await conn.query(
            `UPDATE product_batches SET available_qty = available_qty + ?, sku = COALESCE(sku, ?) WHERE id = ?`,
            [returnQty, item.sku || null, existingBatch[0].id]
          );
        } else {
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

        const [sumRows] = await conn.query(
          "SELECT COALESCE(SUM(available_qty), 0) AS total FROM product_batches WHERE product_id = ?",
          [targetProductId]
        );
        const nextStock = Number(sumRows[0]?.total || 0);

        try {
          await conn.query(
            `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes)
             VALUES (?, ?, ?, 'return', ?, ?, ?)`,
            [
              generateId(),
              userId,
              targetProductId,
              returnQty,
              nextStock,
              `Customer return via ${invoiceNo}`,
            ]
          );
        } catch (histErr) {
          console.warn("Product history return log skipped:", histErr.message);
        }
      }
    }
  }
}

router.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const isReturn = !!body.isReturn;
    const isEmployee = Boolean(req.auth.isEmployee);
    const billStatus = isEmployee ? "pending" : "completed";
    const createdByRole = isEmployee ? "employee" : "admin";
    const createdByName = req.auth.employeeName || req.auth.name || (isEmployee ? "Staff" : "Admin");
    const employeeId = req.auth.employeeId || null;
    const defaultCashier = createdByName;

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
             cashier, payment_method, advance_amount, advance_payment_method, subtotal, tax, discount, total, status, created_by_role, created_by_name, employee_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          body.cashier || defaultCashier,
          ["cash", "online", "credit"].includes(body.paymentMethod) ? body.paymentMethod : "cash",
          Number(body.advanceAmount || 0),
          ["cash", "online"].includes(body.advancePaymentMethod) ? body.advancePaymentMethod : "cash",
          Number(body.subtotal || 0),
          Number(body.tax || 0),
          Number(body.discount || 0),
          Number(body.total || 0),
          billStatus,
          createdByRole,
          createdByName,
          employeeId,
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

      if (!isEmployee) {
        if (isReturn) {
          await applyReturnStock(conn, req.auth.userId, items, invoiceNo);
        } else {
          await applyStockDeduction(conn, req.auth.userId, items, invoiceNo, req.auth.name || "Admin");
        }
      }

      return { id, number: invoiceNo, status: billStatus };
    });

    const [rows] = await pool.query(
      `SELECT id, number, customer_name, customer_phone, customer_address, customer_drug_lic_no, customer_gstin, customer_notes, cashier, payment_method,
              advance_amount, advance_payment_method, subtotal, tax, discount, total, status, created_by_role, approved_at, approved_by, created_at
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

router.post("/:id/approve", requireAdminOnly, async (req, res, next) => {
  try {
    const billId = req.params.id;

    await withTransaction(async (conn) => {
      const [rows] = await conn.query(
        `SELECT id, number, status FROM bills WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE`,
        [billId, req.auth.userId]
      );
      const bill = rows[0];
      if (!bill) {
        throw buildApiError(404, "Bill not found");
      }
      if (bill.status !== "pending") {
        throw buildApiError(400, `Bill is already ${bill.status}`);
      }

      const [items] = await conn.query(
        `SELECT id, product_id, name, sku, batch, qty, free_qty, price, cost_price FROM bill_items WHERE bill_id = ? AND user_id = ?`,
        [billId, req.auth.userId]
      );

      const isReturn = bill.number.startsWith("SR-");
      if (isReturn) {
        await applyReturnStock(conn, req.auth.userId, items, bill.number);
      } else {
        await applyStockDeduction(conn, req.auth.userId, items, bill.number, req.auth.name || "Admin");
      }

      await conn.query(
        `UPDATE bills SET status = 'completed', approved_at = NOW(), approved_by = ? WHERE id = ? AND user_id = ?`,
        [req.auth.name || "Admin", billId, req.auth.userId]
      );
    });

    const [updated] = await pool.query(
      `SELECT id, number, status, approved_at, approved_by FROM bills WHERE id = ? AND user_id = ? LIMIT 1`,
      [billId, req.auth.userId]
    );

    res.json({ message: "Bill approved and confirmed successfully", bill: updated[0] });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/reject", requireAdminOnly, async (req, res, next) => {
  try {
    const billId = req.params.id;
    const [rows] = await pool.query(
      `SELECT id, number, status FROM bills WHERE id = ? AND user_id = ? LIMIT 1`,
      [billId, req.auth.userId]
    );
    const bill = rows[0];
    if (!bill) {
      throw buildApiError(404, "Bill not found");
    }
    if (bill.status !== "pending") {
      throw buildApiError(400, `Bill is already ${bill.status}`);
    }

    await pool.query(
      `UPDATE bills SET status = 'rejected', approved_at = NOW(), approved_by = ? WHERE id = ? AND user_id = ?`,
      [req.auth.name || "Admin", billId, req.auth.userId]
    );

    res.json({ message: "Bill rejected", status: "rejected" });
  } catch (error) {
    next(error);
  }
});

export { router as billsRouter };

