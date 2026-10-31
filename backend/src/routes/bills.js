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
    let query = `SELECT b.id, b.number, b.customer_name, b.customer_phone, b.customer_address, b.customer_drug_lic_no, b.customer_gstin, b.customer_notes, b.cashier, b.payment_method, b.advance_amount, b.advance_payment_method, b.subtotal, b.tax, b.discount, b.total, b.status, b.created_by_role, b.created_by_name, b.employee_id, b.approved_at, b.approved_by, b.created_at,
              u.pharmacy_name, u.pharmacy_phone, u.pharmacy_address, u.gst_number AS pharmacy_gst_number, u.drug_lic_no AS pharmacy_drug_lic_no
       FROM bills b
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.user_id = ?`;
    const params = [req.auth.userId];

    if (req.auth.isEmployee) {
      const empName = req.auth.employeeName || req.auth.name;
      if (req.auth.employeeId) {
        query += ` AND (b.employee_id = ? OR b.created_by_name = ? OR b.cashier = ?)`;
        params.push(req.auth.employeeId, empName, empName);
      } else {
        query += ` AND (b.created_by_name = ? OR b.cashier = ?)`;
        params.push(empName, empName);
      }
    } else {
      const employeeIdParam = req.query.employeeId ? String(req.query.employeeId).trim() : null;
      if (employeeIdParam) {
        query += ` AND (b.employee_id = ? OR b.created_by_name = ?)`;
        params.push(employeeIdParam, employeeIdParam);
      }
    }

    if (statusParam === "pending") {
      query += ` AND b.status = 'pending'`;
    } else if (statusParam === "completed") {
      query += ` AND (b.status = 'completed' OR b.status IS NULL)`;
    } else if (statusParam === "rejected") {
      query += ` AND b.status = 'rejected'`;
    }

    query += ` ORDER BY b.created_at DESC LIMIT 500`;

    const [bills] = await pool.query(query, params);

    if (bills.length === 0) {
      res.json([]);
      return;
    }

    const ids = bills.map((bill) => bill.id);
    const placeholders = ids.map(() => "?").join(",");
    const [items] = await pool.query(
      `SELECT bill_id, product_id, name, sku, price, cost_price, qty, tax_percent, mrp, batch, pack, expiry, free_qty, conversion_factor
       FROM bill_items
       WHERE user_id = ? AND bill_id IN (${placeholders})`,
      [req.auth.userId, ...ids],
    );

    const map = new Map();
    for (const item of items) {
      item.qty = Number(item.qty || 0);
      item.price = Number(item.price || 0);
      item.free_qty = Number(item.free_qty || 0);
      item.tax_percent = Number(item.tax_percent || 0);
      const arr = map.get(item.bill_id) || [];
      arr.push(item);
      map.set(item.bill_id, arr);
    }

    const data = bills.map((bill) => ({
      ...bill,
      items: map.get(bill.id) || [],
    }));

    await attachReturnsToBills(pool, req.auth.userId, data);

    res.json(data);
  } catch (error) {
    next(error);
  }
});

async function syncDraftItems(conn, userId, draftId, items) {
  await conn.query("DELETE FROM draft_bill_items WHERE draft_id = ? AND user_id = ?", [draftId, userId]);

  if (!Array.isArray(items) || items.length === 0) return;

  for (const item of items) {
    if (!item) continue;
    const rawId = (item.productId && String(item.productId).trim()) ||
                  (item.product_id && String(item.product_id).trim()) ||
                  (item.product?.id && String(item.product.id).trim()) || null;
    const rawName = (item.name && String(item.name).trim()) ||
                    (item.product?.name && String(item.product.name).trim()) || "Unknown Product";
    const rawBatch = (item.batch && String(item.batch).trim()) ||
                     (item.product?.batch && String(item.product.batch).trim()) || null;
    const itemQty = Math.abs(Number(item.qty || 0)) + Math.abs(Number(item.freeQty || item.free_qty || 0));

    if (itemQty <= 0) continue;

    let targetProductId = null;
    let targetBatchId = null;
    let targetBatchNo = rawBatch;

    if (rawId) {
      const [pCheck] = await conn.query("SELECT id FROM products WHERE user_id = ? AND id = ? LIMIT 1", [userId, rawId]);
      if (pCheck.length > 0) {
        targetProductId = pCheck[0].id;
      } else {
        const [bCheck] = await conn.query(
          "SELECT b.id, b.product_id, b.batch_no FROM product_batches b JOIN products p ON b.product_id = p.id WHERE p.user_id = ? AND b.id = ? LIMIT 1",
          [userId, rawId]
        );
        if (bCheck.length > 0) {
          targetBatchId = bCheck[0].id;
          targetProductId = bCheck[0].product_id;
          if (!targetBatchNo) targetBatchNo = bCheck[0].batch_no;
        }
      }
    }

    if (!targetProductId && rawName) {
      const [pMatch] = await conn.query(
        "SELECT id FROM products WHERE user_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1",
        [userId, rawName]
      );
      if (pMatch.length > 0) {
        targetProductId = pMatch[0].id;
      }
    }

    if (targetProductId && targetBatchNo && !targetBatchId) {
      const [bMatch] = await conn.query(
        "SELECT id, batch_no FROM product_batches WHERE product_id = ? AND LOWER(TRIM(batch_no)) = LOWER(TRIM(?)) LIMIT 1",
        [targetProductId, targetBatchNo]
      );
      if (bMatch.length > 0) {
        targetBatchId = bMatch[0].id;
        targetBatchNo = bMatch[0].batch_no;
      }
    }

    const itemId = `dbi_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await conn.query(
      `INSERT INTO draft_bill_items (id, draft_id, user_id, product_id, batch_id, batch_no, product_name, qty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, draftId, userId, targetProductId, targetBatchId, targetBatchNo, rawName, itemQty]
    );
  }
}

router.get("/drafts", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, customer_name, customer_phone, total, created_by_name, data, created_at, updated_at
       FROM draft_bills
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [req.auth.userId]
    );

    const drafts = rows.map((r) => {
      let parsed = {};
      try {
        parsed = typeof r.data === "string" ? JSON.parse(r.data) : (r.data || {});
      } catch {
        parsed = {};
      }
      return {
        ...parsed,
        id: r.id,
        name: r.name || parsed.name || "Draft Bill",
        createdAt: parsed.createdAt || (r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : (parsed.updatedAt || new Date().toISOString()),
      };
    });

    res.json(drafts);
  } catch (error) {
    next(error);
  }
});

router.post("/drafts", async (req, res, next) => {
  try {
    const draft = req.body;
    if (!draft || typeof draft !== "object") {
      throw buildApiError(400, "Draft body is required");
    }

    const id = String(draft.id || "").trim() || `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const name = String(draft.name || "Draft Bill").trim();
    const customerName = draft.customer?.name ? String(draft.customer.name).trim() : null;
    const customerPhone = draft.customer?.phone ? String(draft.customer.phone).trim() : null;
    const total = Number(draft.total) || 0;
    const createdByName = req.auth.isEmployee ? req.auth.employeeName : req.auth.name;
    const cleanDraft = {
      ...draft,
      id,
      name,
    };
    const dataStr = JSON.stringify(cleanDraft);

    await withTransaction(async (conn) => {
      await conn.query(
        `INSERT INTO draft_bills (id, user_id, name, customer_name, customer_phone, total, created_by_name, data, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           customer_name = VALUES(customer_name),
           customer_phone = VALUES(customer_phone),
           total = VALUES(total),
           created_by_name = VALUES(created_by_name),
           data = VALUES(data),
           updated_at = NOW()`,
        [id, req.auth.userId, name, customerName, customerPhone, total, createdByName, dataStr]
      );

      await syncDraftItems(conn, req.auth.userId, id, draft.items || []);
    });

    res.status(200).json({ success: true, draft: cleanDraft });
  } catch (error) {
    next(error);
  }
});

router.delete("/drafts/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    await withTransaction(async (conn) => {
      await conn.query(`DELETE FROM draft_bill_items WHERE user_id = ? AND draft_id = ?`, [req.auth.userId, id]);
      await conn.query(`DELETE FROM draft_bills WHERE user_id = ? AND id = ?`, [req.auth.userId, id]);
    });
    res.json({ success: true, id });
  } catch (error) {
    next(error);
  }
});

router.delete("/drafts", async (req, res, next) => {
  try {
    await withTransaction(async (conn) => {
      await conn.query(`DELETE FROM draft_bill_items WHERE user_id = ?`, [req.auth.userId]);
      await conn.query(`DELETE FROM draft_bills WHERE user_id = ?`, [req.auth.userId]);
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    let query = `SELECT b.id, b.number, b.customer_name, b.customer_phone, b.customer_address, b.customer_drug_lic_no, b.customer_gstin, b.customer_notes, b.cashier, b.payment_method, b.advance_amount, b.advance_payment_method,
              b.subtotal, b.tax, b.discount, b.total, b.status, b.created_by_role, b.created_by_name, b.employee_id, b.approved_at, b.approved_by, b.created_at,
              u.pharmacy_name, u.pharmacy_phone, u.pharmacy_address, u.gst_number AS pharmacy_gst_number, u.drug_lic_no AS pharmacy_drug_lic_no
       FROM bills b
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.user_id = ? AND b.id = ?`;
    const params = [req.auth.userId, req.params.id];

    if (req.auth.isEmployee) {
      const empName = req.auth.employeeName || req.auth.name;
      if (req.auth.employeeId) {
        query += ` AND (b.employee_id = ? OR b.created_by_name = ? OR b.cashier = ?)`;
        params.push(req.auth.employeeId, empName, empName);
      } else {
        query += ` AND (b.created_by_name = ? OR b.cashier = ?)`;
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
      `SELECT bill_id, product_id, name, sku, price, cost_price, qty, tax_percent, mrp, batch, pack, expiry, free_qty, conversion_factor
       FROM bill_items
       WHERE user_id = ? AND bill_id = ?`,
      [req.auth.userId, req.params.id],
    );

    for (const item of items) {
      item.qty = Number(item.qty || 0);
      item.price = Number(item.price || 0);
      item.free_qty = Number(item.free_qty || 0);
      item.tax_percent = Number(item.tax_percent || 0);
    }

    const billData = { ...bill, items };
    await attachReturnsToBills(pool, req.auth.userId, [billData]);

    res.json(billData);
  } catch (error) {
    next(error);
  }
});

async function attachReturnsToBills(connOrPool, userId, bills) {
  if (!bills || bills.length === 0) return;

  const regularBills = bills.filter((b) => b.number && !String(b.number).startsWith("SR-"));
  if (regularBills.length === 0) return;

  const [returnBills] = await connOrPool.query(
    `SELECT id, number, customer_notes, subtotal, tax, discount, total, created_at
     FROM bills
     WHERE user_id = ? AND number LIKE 'SR-%' AND (status IS NULL OR status != 'rejected')`,
    [userId]
  );

  if (returnBills.length === 0) return;

  const returnBillIds = returnBills.map((rb) => rb.id);
  const placeholders = returnBillIds.map(() => "?").join(",");
  const [returnItems] = await connOrPool.query(
    `SELECT bill_id, product_id, name, sku, price, cost_price, qty, tax_percent, mrp, batch, pack, expiry, free_qty, conversion_factor
     FROM bill_items
     WHERE user_id = ? AND bill_id IN (${placeholders})`,
    [userId, ...returnBillIds]
  );

  const returnItemsMap = new Map();
  for (const item of returnItems) {
    const arr = returnItemsMap.get(item.bill_id) || [];
    arr.push(item);
    returnItemsMap.set(item.bill_id, arr);
  }

  for (const rb of returnBills) {
    rb.items = returnItemsMap.get(rb.id) || [];
  }

  for (const bill of regularBills) {
    const billNum = String(bill.number).trim();
    const billId = String(bill.id).trim();

    const matchingReturns = returnBills.filter((rb) => {
      const notes = String(rb.customer_notes || "").trim();
      return notes.includes(billNum) || (billId && notes.includes(billId));
    });

    if (matchingReturns.length > 0) {
      let returnedSubtotal = 0;
      let returnedTax = 0;
      let returnedTotal = 0;
      const attachedReturnItems = [];

      for (const rb of matchingReturns) {
        returnedSubtotal += Number(rb.subtotal || 0);
        returnedTax += Number(rb.tax || 0);
        returnedTotal += Number(rb.total || 0);

        for (const it of rb.items) {
          attachedReturnItems.push({
            bill_id: bill.id,
            product_id: it.product_id,
            name: it.name,
            sku: it.sku,
            price: Number(it.price || 0),
            cost_price: it.cost_price != null ? Number(it.cost_price) : null,
            qty: Number(it.qty || 0),
            tax_percent: Number(it.tax_percent || 0),
            mrp: it.mrp != null ? Number(it.mrp) : null,
            batch: it.batch,
            pack: it.pack,
            expiry: it.expiry,
            free_qty: Number(it.free_qty || 0),
            conversion_factor: it.conversion_factor,
            is_return_item: true,
            return_bill_number: rb.number,
            return_bill_id: rb.id,
            return_date: rb.created_at,
          });
        }
      }

      bill.original_subtotal = Number(bill.subtotal || 0);
      bill.original_tax = Number(bill.tax || 0);
      bill.original_total = Number(bill.total || 0);
      bill.returned_subtotal = Number(returnedSubtotal.toFixed(2));
      bill.returned_tax = Number(returnedTax.toFixed(2));
      bill.returned_total = Number(returnedTotal.toFixed(2));

      bill.subtotal = Number((Number(bill.subtotal || 0) + returnedSubtotal).toFixed(2));
      bill.tax = Number((Number(bill.tax || 0) + returnedTax).toFixed(2));
      bill.total = Number((Number(bill.total || 0) + returnedTotal).toFixed(2));

      bill.items = [...(bill.items || []), ...attachedReturnItems];
      bill.has_returns = true;
      bill.returns = matchingReturns.map((rb) => ({
        id: rb.id,
        number: rb.number,
        total: Number(rb.total || 0),
        created_at: rb.created_at,
      }));
    }
  }
}

async function applyStockDeduction(conn, userId, items, invoiceNo, actorName) {
  if (!items || items.length === 0) return;

  // Idempotency check: prevent duplicate stock deduction for the same invoice
  if (invoiceNo) {
    const [existing] = await conn.query(
      `SELECT id FROM product_history WHERE user_id = ? AND invoice_no = ? AND action = 'sale' LIMIT 1`,
      [userId, invoiceNo]
    );
    if (existing.length > 0) {
      console.warn(`[Stock] Stock deduction already applied for invoice ${invoiceNo}. Skipping duplicate deduction.`);
      return;
    }
  }

  for (const item of items) {
    let rawId = (item.productId && String(item.productId).trim()) || (item.product_id && String(item.product_id).trim()) || null;
    let targetProductId = null;

    if (rawId && rawId !== "") {
      // 1. Check if rawId matches a product in products table
      const [pCheck] = await conn.query(
        "SELECT id FROM products WHERE user_id = ? AND id = ? LIMIT 1",
        [userId, rawId]
      );
      if (pCheck.length > 0) {
        targetProductId = pCheck[0].id;
      } else {
        // 2. Check if rawId matches a batch ID in product_batches table
        const [bCheck] = await conn.query(
          "SELECT b.product_id FROM product_batches b JOIN products p ON b.product_id = p.id WHERE p.user_id = ? AND b.id = ? LIMIT 1",
          [userId, rawId]
        );
        if (bCheck.length > 0) {
          targetProductId = bCheck[0].product_id;
        }
      }
    }

    // 3. Fallback: match by exact product name ONLY (Do NOT match by SKU/HSN code because HSN is shared across products)
    if (!targetProductId && item.name) {
      const [pMatch] = await conn.query(
        `SELECT id FROM products 
         WHERE user_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) 
         LIMIT 1`,
        [userId, String(item.name).trim()]
      );
      if (pMatch.length > 0) {
        targetProductId = pMatch[0].id;
      }
    }

    // 4. Fallback: match by batch_no
    if (!targetProductId && item.batch) {
      const [bMatch] = await conn.query(
        `SELECT b.product_id 
         FROM product_batches b 
         JOIN products p ON b.product_id = p.id 
         WHERE p.user_id = ? AND LOWER(TRIM(b.batch_no)) = LOWER(TRIM(?)) 
         LIMIT 1`,
        [userId, String(item.batch).trim()]
      );
      if (bMatch.length > 0) {
        targetProductId = bMatch[0].product_id;
      }
    }

    // 5. If targetProductId is valid in products table, deduct batch stock & log history
    if (targetProductId) {
      const totalItemQty = Math.abs(Number(item.qty || 0)) + Math.abs(Number(item.freeQty || item.free_qty || 0));
      if (totalItemQty > 0) {
        let batches = [];
        if (item.batch) {
          const [bMatch] = await conn.query(
            "SELECT id, batch_no, available_qty FROM product_batches WHERE product_id = ? AND LOWER(TRIM(batch_no)) = LOWER(TRIM(?)) LIMIT 1",
            [targetProductId, String(item.batch).trim()]
          );
          batches = bMatch;
        }

        if (batches.length === 0) {
          const [allBatches] = await conn.query(
            "SELECT id, batch_no, available_qty FROM product_batches WHERE product_id = ? ORDER BY (available_qty > 0) DESC, expiry_date ASC",
            [targetProductId]
          );
          batches = allBatches;
        }

        let remainingToDec = totalItemQty;
        for (let idx = 0; idx < batches.length; idx++) {
          const b = batches[idx];
          if (remainingToDec <= 0) break;

          if (idx === batches.length - 1 && remainingToDec > b.available_qty) {
            const nextQty = Math.max(0, b.available_qty - remainingToDec);
            await conn.query("UPDATE product_batches SET available_qty = ? WHERE id = ?", [nextQty, b.id]);
            remainingToDec = 0;
          } else {
            const toDec = Math.min(b.available_qty, remainingToDec);
            if (toDec > 0) {
              const nextQty = b.available_qty - toDec;
              // Never delete the batch entity from product_batches even if stock is 0,
              // so batch metadata (MRP, batch number, expiry date, purchase price) remains intact.
              await conn.query("UPDATE product_batches SET available_qty = ? WHERE id = ?", [Math.max(0, nextQty), b.id]);
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
            `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes, invoice_no)
             VALUES (?, ?, ?, 'sale', ?, ?, ?, ?)`,
            [
              generateId(),
              userId,
              targetProductId,
              totalItemQty,
              nextStock,
              `Sale via ${invoiceNo} by ${actorName || "Admin"}`,
              invoiceNo
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
  if (!items || items.length === 0) return;

  // Idempotency check: prevent duplicate return stock restoration for the same return invoice
  if (invoiceNo) {
    const [existing] = await conn.query(
      `SELECT id FROM product_history WHERE user_id = ? AND invoice_no = ? AND action = 'return' LIMIT 1`,
      [userId, invoiceNo]
    );
    if (existing.length > 0) {
      console.warn(`[Stock] Return stock already applied for invoice ${invoiceNo}. Skipping duplicate return.`);
      return;
    }
  }

  for (const item of items) {
    let rawId = (item.productId && String(item.productId).trim()) || (item.product_id && String(item.product_id).trim()) || null;
    let targetProductId = null;

    if (rawId && rawId !== "") {
      // 1. Check if rawId matches a product in products table
      const [pCheck] = await conn.query(
        "SELECT id FROM products WHERE user_id = ? AND id = ? LIMIT 1",
        [userId, rawId]
      );
      if (pCheck.length > 0) {
        targetProductId = pCheck[0].id;
      } else {
        // 2. Check if rawId matches a batch ID in product_batches table
        const [bCheck] = await conn.query(
          "SELECT b.product_id FROM product_batches b JOIN products p ON b.product_id = p.id WHERE p.user_id = ? AND b.id = ? LIMIT 1",
          [userId, rawId]
        );
        if (bCheck.length > 0) {
          targetProductId = bCheck[0].product_id;
        }
      }
    }

    // 3. Fallback to exact product name match ONLY (Do NOT match by SKU/HSN code because HSN is shared across products)
    if (!targetProductId && item.name) {
      const [pMatch] = await conn.query(
        `SELECT id FROM products 
         WHERE user_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) 
         LIMIT 1`,
        [userId, String(item.name).trim()]
      );
      if (pMatch.length > 0) {
        targetProductId = pMatch[0].id;
      }
    }

    // 4. Fallback to matching product_batches by batch_no
    if (!targetProductId && item.batch) {
      const [bMatch] = await conn.query(
        `SELECT b.product_id 
         FROM product_batches b 
         JOIN products p ON b.product_id = p.id 
         WHERE p.user_id = ? AND LOWER(TRIM(b.batch_no)) = LOWER(TRIM(?)) 
         LIMIT 1`,
        [userId, String(item.batch).trim()]
      );
      if (bMatch.length > 0) {
        targetProductId = bMatch[0].product_id;
      }
    }

    if (targetProductId) {
      const returnQty = Math.abs(Number(item.qty || 0)) + Math.abs(Number(item.freeQty || item.free_qty || 0));
      if (returnQty > 0) {
        const itemBatchNo = item.batch ? String(item.batch).trim() : "DEFAULT";

        const [existingBatch] = await conn.query(
          `SELECT id FROM product_batches WHERE product_id = ? AND LOWER(TRIM(batch_no)) = LOWER(TRIM(?)) LIMIT 1`,
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
              Number(item.costPrice || item.cost_price || 0),
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
            `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes, invoice_no)
             VALUES (?, ?, ?, 'return', ?, ?, ?, ?)`,
            [
              generateId(),
              userId,
              targetProductId,
              returnQty,
              nextStock,
              `Customer return via ${invoiceNo}`,
              invoiceNo
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
    const isReturn = !!body.isReturn || (body.number && String(body.number).startsWith("SR-"));
    const isEmployee = Boolean(req.auth.isEmployee);
    const billStatus = isEmployee ? "pending" : "completed";
    const createdByRole = isEmployee ? "employee" : "admin";
    const createdByName = req.auth.employeeName || req.auth.name || (isEmployee ? "Staff" : "Admin");
    const employeeId = req.auth.employeeId || null;
    const defaultCashier = createdByName;

    let customerPhone = (body.customerPhone || "").trim();
    let s = customerPhone.replace(/^(\+91|\+ 91)\s*[-\s]?/, "");
    let phoneDigits = s.replace(/\D/g, "");
    if (phoneDigits.length === 12 && phoneDigits.startsWith("91")) {
      phoneDigits = phoneDigits.slice(2);
    } else if (phoneDigits.length === 11 && phoneDigits.startsWith("0")) {
      phoneDigits = phoneDigits.slice(1);
    }
    phoneDigits = phoneDigits.slice(0, 10);
    if (phoneDigits.length === 10) {
      customerPhone = `+91 ${phoneDigits}`;
    } else {
      customerPhone = null;
    }

    const cName = (body.customerName || "").trim();
    const isWalkIn = !cName || ["walk-in customer", "walk-in", "walkin"].includes(cName.toLowerCase());

    if (body.paymentMethod === "credit") {
      if (isWalkIn || !customerPhone) {
        throw buildApiError(400, "Credit sales require a registered customer with name and phone number. Walk-in customers can only pay with Cash or Online.");
      }
    }

    // Check if phone number already belongs to another customer
    if (phoneDigits.length === 10 && !isWalkIn) {
      const [conflictRows] = await pool.query(
        `SELECT customer_name 
         FROM bills 
         WHERE user_id = ? 
           AND customer_phone IS NOT NULL 
           AND RIGHT(REGEXP_REPLACE(customer_phone, '[^0-9]', ''), 10) = ?
           AND LOWER(TRIM(customer_name)) != LOWER(TRIM(?))
           AND customer_name NOT IN ('Walk-in Customer', 'walk-in', 'walkin')
         LIMIT 1`,
        [req.auth.userId, phoneDigits, cName],
      );
      if (conflictRows.length > 0) {
        throw buildApiError(
          400,
          `Phone number (+91 ${phoneDigits}) already exists for customer "${conflictRows[0].customer_name}". Please use a unique phone number.`
        );
      }
    }

    const created = await withTransaction(async (conn) => {
      // 1. If generated from a draft, atomically lock and remove the draft
      if (body.draftId) {
        const [draftRows] = await conn.query(
          "SELECT id FROM draft_bills WHERE id = ? AND user_id = ? FOR UPDATE",
          [body.draftId, req.auth.userId]
        );
        if (draftRows.length === 0) {
          throw buildApiError(409, "This draft bill has already been completed or deleted on another device.");
        }
        await conn.query("DELETE FROM draft_bill_items WHERE user_id = ? AND draft_id = ?", [req.auth.userId, body.draftId]);
        await conn.query("DELETE FROM draft_bills WHERE id = ? AND user_id = ?", [body.draftId, req.auth.userId]);
      }

      // 2. Validate available stock for non-return sales (protecting locked stock)
      if (!isReturn) {
        for (const item of items) {
          const rawId = (item.productId && String(item.productId).trim()) || (item.product_id && String(item.product_id).trim()) || null;
          const rawName = item.name ? String(item.name).trim() : null;
          const totalItemQty = Math.abs(Number(item.qty || 0)) + Math.abs(Number(item.freeQty || item.free_qty || 0));

          if (totalItemQty <= 0) continue;

          let targetProductId = null;
          if (rawId) {
            const [pCheck] = await conn.query("SELECT id FROM products WHERE user_id = ? AND id = ? LIMIT 1", [req.auth.userId, rawId]);
            if (pCheck.length > 0) {
              targetProductId = pCheck[0].id;
            } else {
              const [bCheck] = await conn.query(
                "SELECT b.product_id FROM product_batches b JOIN products p ON b.product_id = p.id WHERE p.user_id = ? AND b.id = ? LIMIT 1",
                [req.auth.userId, rawId]
              );
              if (bCheck.length > 0) targetProductId = bCheck[0].product_id;
            }
          }
          if (!targetProductId && rawName) {
            const [pMatch] = await conn.query(
              "SELECT id FROM products WHERE user_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1",
              [req.auth.userId, rawName]
            );
            if (pMatch.length > 0) targetProductId = pMatch[0].id;
          }

          if (targetProductId) {
            const [stockRows] = await conn.query(
              "SELECT COALESCE(SUM(available_qty), 0) AS total_physical FROM product_batches WHERE product_id = ?",
              [targetProductId]
            );
            const totalPhysical = Math.max(0, Number(stockRows[0]?.total_physical || 0));

            const [lockedRows] = await conn.query(
              "SELECT COALESCE(SUM(qty), 0) AS total_locked FROM draft_bill_items WHERE user_id = ? AND product_id = ?",
              [req.auth.userId, targetProductId]
            );
            const totalLocked = Math.max(0, Number(lockedRows[0]?.total_locked || 0));
            const availableForSale = Math.max(0, totalPhysical - totalLocked);

            if (totalItemQty > availableForSale) {
              if (totalLocked > 0) {
                throw buildApiError(
                  400,
                  `Cannot complete sale: Insufficient available stock for "${item.name}". Requested ${totalItemQty}, but only ${availableForSale} available (${totalLocked} units are reserved in draft bills).`
                );
              } else {
                throw buildApiError(
                  400,
                  `Cannot complete sale: Insufficient stock for "${item.name}". Requested ${totalItemQty}, but only ${availableForSale} available in inventory.`
                );
              }
            }
          }
        }
      }

      const prefix = isReturn ? "SR" : "INV";
      const [maxRows] = await conn.query(
        `SELECT MAX(CAST(SUBSTRING_INDEX(number, '-', -1) AS UNSIGNED)) AS maxNo
         FROM bills
         WHERE user_id = ? AND number LIKE ?`,
         [req.auth.userId, `${prefix}-%`],
      );
      const nextNo = Number(maxRows[0]?.maxNo || 0) + 1;
      const invoiceNo = `${prefix}-${String(nextNo).padStart(4, "0")}`;

      const [userRows] = await conn.query("SELECT role FROM users WHERE id = ? LIMIT 1", [req.auth.userId]);
      const userRole = userRows[0]?.role || "retailer";
      const isRetailRole = userRole === "retailer";

      let calcSubtotal = 0;
      let calcTax = 0;
      let grossTotal = 0;

      for (const item of items) {
        const itemQty = Number(item.qty || 0);
        const itemPrice = Number(item.price || 0);
        const itemTaxPercent = Number(item.taxPercent || item.tax_percent || 0);
        const lineGross = Number((itemQty * itemPrice).toFixed(2));
        grossTotal += lineGross;

        if (isRetailRole && !isReturn) {
          const taxable = itemTaxPercent > 0 ? Number((lineGross / (1 + itemTaxPercent / 100)).toFixed(2)) : lineGross;
          const lineTax = Number((lineGross - taxable).toFixed(2));
          calcSubtotal += taxable;
          calcTax += lineTax;
        } else {
          calcSubtotal += lineGross;
          calcTax += (lineGross * itemTaxPercent) / 100;
        }
      }

      calcSubtotal = Number(calcSubtotal.toFixed(2));
      calcTax = Number(calcTax.toFixed(2));
      const discountVal = Number(body.discount || 0);
      const calcTotal = isReturn
        ? Number((calcSubtotal + calcTax - discountVal).toFixed(2))
        : isRetailRole
          ? Number(Math.max(0, grossTotal - discountVal).toFixed(2))
          : Number(Math.max(0, calcSubtotal + calcTax - discountVal).toFixed(2));

      const billSubtotal = body.subtotal != null ? Number(Number(body.subtotal).toFixed(2)) : calcSubtotal;
      const billTax = body.tax != null ? Number(Number(body.tax).toFixed(2)) : calcTax;
      const billTotal = isReturn
        ? Number((billSubtotal + billTax - discountVal).toFixed(2))
        : (body.total != null ? Number(Number(body.total).toFixed(2)) : calcTotal);

      let customerDrugLicNo = body.customerDrugLicNo ? String(body.customerDrugLicNo).trim().toUpperCase() : null;
      if (!customerDrugLicNo && customerPhone) {
        const [prevDlRows] = await conn.query(
          `SELECT customer_drug_lic_no FROM bills 
           WHERE user_id = ? AND customer_phone = ? AND customer_drug_lic_no IS NOT NULL AND customer_drug_lic_no != '' 
           ORDER BY created_at DESC LIMIT 1`,
          [req.auth.userId, customerPhone]
        );
        if (prevDlRows.length > 0 && prevDlRows[0].customer_drug_lic_no) {
          customerDrugLicNo = prevDlRows[0].customer_drug_lic_no;
        }
      }

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
          customerPhone || null,
          body.customerAddress || null,
          customerDrugLicNo,
          body.customerGstin ? String(body.customerGstin).trim().toUpperCase() : null,
          body.customerNotes || null,
          body.cashier || defaultCashier,
          ["cash", "online", "credit"].includes(body.paymentMethod) ? body.paymentMethod : "cash",
          Number(body.advanceAmount || 0),
          ["cash", "online"].includes(body.advancePaymentMethod) ? body.advancePaymentMethod : "cash",
          billSubtotal,
          billTax,
          discountVal,
          billTotal,
          billStatus,
          createdByRole,
          createdByName,
          employeeId,
        ],
      );

      for (const item of items) {
        const itemConv = Number(item.conversionFactor || item.conversion_factor || 1) || 1;
        await conn.query(
          `INSERT INTO bill_items (id, bill_id, user_id, product_id, name, sku, price, cost_price, qty, tax_percent, mrp, batch, pack, expiry, free_qty, conversion_factor)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            itemConv,
          ],
        );
      }

      // Save customer product prices for future bills
      const custName = (body.customerName || "").trim();
      if (custName && custName.toLowerCase() !== "walk-in" && custName.toLowerCase() !== "walk-in customer") {
        for (const item of items) {
          const itemPrice = Number(item.price || 0);
          const rawItemName = (item.name || "").trim();
          if (itemPrice > 0 && rawItemName) {
            try {
              const [existing] = await conn.query(
                `SELECT id FROM customer_product_prices 
                 WHERE user_id = ? AND LOWER(TRIM(customer_name)) = LOWER(TRIM(?)) AND LOWER(TRIM(product_name)) = LOWER(TRIM(?)) LIMIT 1`,
                [req.auth.userId, custName, rawItemName]
              );
              if (existing.length > 0) {
                await conn.query(
                  `UPDATE customer_product_prices 
                   SET last_price = ?, last_bill_number = ?, product_id = ?, customer_phone = COALESCE(?, customer_phone), updated_at = NOW()
                   WHERE id = ?`,
                  [itemPrice, invoiceNo, item.productId || null, customerPhone || null, existing[0].id]
                );
              } else {
                await conn.query(
                  `INSERT INTO customer_product_prices 
                   (id, user_id, customer_name, customer_phone, product_id, product_name, last_price, last_bill_number)
                   VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
                  [req.auth.userId, custName, customerPhone || null, item.productId || null, rawItemName, itemPrice, invoiceNo]
                );
              }
            } catch (priceErr) {
              console.warn("Failed to update customer product price:", priceErr.message);
            }
          }
        }
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
      `SELECT b.id, b.number, b.customer_name, b.customer_phone, b.customer_address, b.customer_drug_lic_no, b.customer_gstin, b.customer_notes, b.cashier, b.payment_method,
              b.advance_amount, b.advance_payment_method, b.subtotal, b.tax, b.discount, b.total, b.status, b.created_by_role, b.created_by_name, b.employee_id, b.approved_at, b.approved_by, b.created_at,
              u.pharmacy_name, u.pharmacy_phone, u.pharmacy_address, u.gst_number AS pharmacy_gst_number, u.drug_lic_no AS pharmacy_drug_lic_no
       FROM bills b
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.user_id = ? AND b.id = ?
       LIMIT 1`,
      [req.auth.userId, created.id],
    );
    res.status(201).json({ ...rows[0], items: [] });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/customer", async (req, res, next) => {
  try {
    const { customerName, customerPhone, customerAddress, customerDrugLicNo, customerGstin, customerNotes } = req.body || {};
    await pool.query(
      `UPDATE bills 
       SET customer_name = ?, customer_phone = ?, customer_address = ?, customer_drug_lic_no = ?, customer_gstin = ?, customer_notes = ?
       WHERE user_id = ? AND id = ?`,
      [
        customerName || null,
        customerPhone || null,
        customerAddress || null,
        customerDrugLicNo ? String(customerDrugLicNo).trim().toUpperCase() : null,
        customerGstin ? String(customerGstin).trim().toUpperCase() : null,
        customerNotes || null,
        req.auth.userId,
        req.params.id,
      ]
    );
    res.json({ success: true });
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
        `SELECT id, product_id, name, sku, batch, qty, free_qty, price, cost_price, expiry, mrp FROM bill_items WHERE bill_id = ? AND user_id = ?`,
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

