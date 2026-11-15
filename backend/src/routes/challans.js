import { Router } from "express";
import { pool, withTransaction } from "../db.js";
import { buildApiError, generateId } from "../utils.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

/**
 * Helper to get the next auto-generated challan number
 */
async function getNextChallanNumber(connOrPool, userId) {
  const [maxRows] = await connOrPool.query(
    `SELECT MAX(CAST(SUBSTRING_INDEX(challan_number, '-', -1) AS UNSIGNED)) AS maxNo
     FROM sale_challans
     WHERE user_id = ? AND challan_number LIKE 'CH-%'`,
    [userId]
  );
  const nextNo = Number(maxRows[0]?.maxNo || 0) + 1;
  return `CH-${String(nextNo).padStart(4, "0")}`;
}

// ─── Dashboard Metrics ────────────────────────────────────────────────────────
router.get("/dashboard-metrics", async (req, res, next) => {
  try {
    const userId = req.auth.userId;

    const [countRows] = await pool.query(
      `SELECT
         COUNT(*) AS totalChallans,
         COUNT(CASE WHEN DATE(challan_date) = CURRENT_DATE() OR DATE(created_at) = CURRENT_DATE() THEN 1 END) AS todayChallans,
         COUNT(CASE WHEN status = 'issued' THEN 1 END) AS pendingChallans,
         COUNT(CASE WHEN status = 'partially_billed' THEN 1 END) AS partiallyBilledChallans,
         COUNT(CASE WHEN status = 'billed' THEN 1 END) AS fullyBilledChallans,
         COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelledChallans,
         COUNT(CASE WHEN status = 'draft' THEN 1 END) AS draftChallans
       FROM sale_challans
       WHERE user_id = ?`,
      [userId]
    );

    const counts = countRows[0] || {};

    // Total reserved stock value
    const [valRows] = await pool.query(
      `SELECT COALESCE(SUM(sr.remaining_qty * COALESCE(sci.rate, 0)), 0) AS reservedValue
       FROM stock_reservations sr
       LEFT JOIN sale_challan_items sci ON sr.challan_item_id = sci.id
       WHERE sr.user_id = ? AND sr.status = 'active' AND sr.remaining_qty > 0`,
      [userId]
    );

    const totalReservedStockValue = Number(Number(valRows[0]?.reservedValue || 0).toFixed(2));

    res.json({
      totalChallans: Number(counts.totalChallans || 0),
      todayChallans: Number(counts.todayChallans || 0),
      pendingChallans: Number(counts.pendingChallans || 0),
      partiallyBilledChallans: Number(counts.partiallyBilledChallans || 0),
      fullyBilledChallans: Number(counts.fullyBilledChallans || 0),
      cancelledChallans: Number(counts.cancelledChallans || 0),
      draftChallans: Number(counts.draftChallans || 0),
      totalReservedStockValue,
    });
  } catch (error) {
    next(error);
  }
});

// ─── Next Challan Number ───────────────────────────────────────────────────────
router.get("/next-number", async (req, res, next) => {
  try {
    const nextNumber = await getNextChallanNumber(pool, req.auth.userId);
    res.json({ nextNumber });
  } catch (error) {
    next(error);
  }
});

// ─── List Challans (with filters) ─────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const { status, from, to, customer, q } = req.query;

    let query = `
      SELECT sc.*,
        (SELECT COUNT(*) FROM sale_challan_items WHERE challan_id = sc.id) AS item_count,
        (SELECT COALESCE(SUM(remaining_qty), 0) FROM stock_reservations WHERE challan_id = sc.id AND status = 'active') AS remaining_reserved_qty
      FROM sale_challans sc
      WHERE sc.user_id = ?
    `;
    const params = [userId];

    if (status && status !== "all") {
      query += ` AND sc.status = ?`;
      params.push(String(status).toLowerCase().trim());
    }

    if (from) {
      query += ` AND sc.challan_date >= ?`;
      params.push(from);
    }
    if (to) {
      query += ` AND sc.challan_date <= ?`;
      params.push(to);
    }

    if (customer) {
      query += ` AND (sc.customer_name LIKE ? OR sc.customer_phone LIKE ?)`;
      params.push(`%${customer}%`, `%${customer}%`);
    }

    if (q) {
      query += ` AND (sc.challan_number LIKE ? OR sc.customer_name LIKE ? OR sc.customer_phone LIKE ? OR sc.notes LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    query += ` ORDER BY sc.created_at DESC LIMIT 500`;

    const [challans] = await pool.query(query, params);

    if (challans.length === 0) {
      return res.json([]);
    }

    const challanIds = challans.map((c) => c.id);
    const placeholders = challanIds.map(() => "?").join(",");

    // Fetch linked invoices
    const [invoices] = await pool.query(
      `SELECT challan_id, bill_id, challan_number, invoice_number, created_at
       FROM challan_invoices
       WHERE user_id = ? AND challan_id IN (${placeholders})`,
      [userId, ...challanIds]
    );

    const invMap = new Map();
    for (const inv of invoices) {
      const arr = invMap.get(inv.challan_id) || [];
      arr.push({
        billId: inv.bill_id,
        invoiceNumber: inv.invoice_number,
        createdAt: inv.created_at,
      });
      invMap.set(inv.challan_id, arr);
    }

    const data = challans.map((c) => ({
      id: c.id,
      challanNumber: c.challan_number,
      challanDate: c.challan_date,
      customerName: c.customer_name || "",
      customerPhone: c.customer_phone || "",
      customerAddress: c.customer_address || "",
      customerGstin: c.customer_gstin || "",
      notes: c.notes || "",
      subtotal: Number(c.subtotal || 0),
      tax: Number(c.tax || 0),
      discount: Number(c.discount || 0),
      total: Number(c.total || 0),
      status: c.status,
      createdByRole: c.created_by_role,
      createdByName: c.created_by_name,
      employeeId: c.employee_id,
      createdAt: c.created_at,
      itemCount: Number(c.item_count || 0),
      remainingReservedQty: Number(c.remaining_reserved_qty || 0),
      linkedInvoices: invMap.get(c.id) || [],
    }));

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// ─── Get Single Challan ───────────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const challanId = req.params.id;

    const [rows] = await pool.query(
      `SELECT sc.*,
              u.pharmacy_name, u.pharmacy_phone, u.pharmacy_address,
              u.gst_number AS pharmacy_gst_number, u.drug_lic_no AS pharmacy_drug_lic_no,
              u.bill_color, u.signature
       FROM sale_challans sc
       LEFT JOIN users u ON sc.user_id = u.id
       WHERE sc.user_id = ? AND sc.id = ?
       LIMIT 1`,
      [userId, challanId]
    );

    if (rows.length === 0) {
      throw buildApiError(404, "Sale Challan not found");
    }

    const c = rows[0];

    // Fetch items
    const [items] = await pool.query(
      `SELECT sci.*,
              sr.id AS reservation_id, sr.reserved_qty, sr.billed_qty AS res_billed_qty, sr.remaining_qty, sr.status AS res_status
       FROM sale_challan_items sci
       LEFT JOIN stock_reservations sr ON sr.challan_item_id = sci.id
       WHERE sci.challan_id = ? AND sci.user_id = ?
       ORDER BY sci.created_at ASC`,
      [challanId, userId]
    );

    // Fetch linked invoices
    const [linkedInvoices] = await pool.query(
      `SELECT ci.bill_id, ci.invoice_number, ci.created_at, b.total, b.status AS bill_status
       FROM challan_invoices ci
       LEFT JOIN bills b ON ci.bill_id = b.id
       WHERE ci.challan_id = ? AND ci.user_id = ?`,
      [challanId, userId]
    );

    res.json({
      id: c.id,
      challanNumber: c.challan_number,
      challanDate: c.challan_date,
      customerName: c.customer_name || "",
      customerPhone: c.customer_phone || "",
      customerAddress: c.customer_address || "",
      customerGstin: c.customer_gstin || "",
      notes: c.notes || "",
      subtotal: Number(c.subtotal || 0),
      tax: Number(c.tax || 0),
      discount: Number(c.discount || 0),
      total: Number(c.total || 0),
      status: c.status,
      createdByRole: c.created_by_role,
      createdByName: c.created_by_name,
      employeeId: c.employee_id,
      createdAt: c.created_at,
      pharmacy: {
        name: c.pharmacy_name || "",
        phone: c.pharmacy_phone || "",
        address: c.pharmacy_address || "",
        gstin: c.pharmacy_gst_number || "",
        drugLicNo: c.pharmacy_drug_lic_no || "",
        billColor: c.bill_color || "#059669",
        signature: c.signature || null,
      },
      items: items.map((it) => ({
        id: it.id,
        productId: it.product_id,
        batchId: it.batch_id,
        productName: it.product_name,
        batchNo: it.batch_no,
        expiryDate: it.expiry_date,
        availableStock: Number(it.available_stock || 0),
        qty: Number(it.qty || 0),
        freeQty: Number(it.free_qty || 0),
        mrp: it.mrp != null ? Number(it.mrp) : null,
        rate: Number(it.rate || 0),
        discountPercent: Number(it.discount_percent || 0),
        taxPercent: Number(it.tax_percent || 0),
        amount: Number(it.amount || 0),
        billedQty: Number(it.billed_qty || 0),
        billedFreeQty: Number(it.billed_free_qty || 0),
        remainingQtyToBill: Math.max(0, Number(it.qty || 0) - Number(it.billed_qty || 0)),
        pack: it.pack || "",
        sku: it.sku || "",
        conversionFactor: Number(it.conversion_factor || 1),
        reservation: it.reservation_id
          ? {
              id: it.reservation_id,
              reservedQty: Number(it.reserved_qty || 0),
              billedQty: Number(it.res_billed_qty || 0),
              remainingQty: Number(it.remaining_qty || 0),
              status: it.res_status,
            }
          : null,
      })),
      linkedInvoices: linkedInvoices.map((inv) => ({
        billId: inv.bill_id,
        invoiceNumber: inv.invoice_number,
        total: Number(inv.total || 0),
        status: inv.bill_status,
        createdAt: inv.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ─── Create Sale Challan ──────────────────────────────────────────────────────
router.post("/", async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      throw buildApiError(400, "At least one product item is required for the Sale Challan.");
    }

    const challanDate = body.challanDate ? String(body.challanDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const status = (body.status === "draft" ? "draft" : "issued"); // Default is 'issued'
    const isEmployee = Boolean(req.auth.isEmployee);
    const createdByRole = isEmployee ? "employee" : "admin";
    const createdByName = req.auth.employeeName || req.auth.name || (isEmployee ? "Staff" : "Admin");
    const employeeId = req.auth.employeeId || null;

    const result = await withTransaction(async (conn) => {
      // 1. Determine Challan Number
      let challanNumber = String(body.challanNumber || "").trim();
      if (!challanNumber) {
        challanNumber = await getNextChallanNumber(conn, userId);
      } else {
        // Check uniqueness for this user
        const [existing] = await conn.query(
          "SELECT id FROM sale_challans WHERE user_id = ? AND challan_number = ? LIMIT 1",
          [userId, challanNumber]
        );
        if (existing.length > 0) {
          challanNumber = await getNextChallanNumber(conn, userId);
        }
      }

      const challanId = generateId();

      let subtotal = 0;
      let totalTax = 0;
      let totalDiscount = 0;
      let grandTotal = 0;

      const preparedItems = [];

      // 2. Process each item and validate stock if status === 'issued'
      for (const item of items) {
        const rawProductId = item.productId || item.product_id;
        const rawBatchId = item.batchId || item.batch_id;
        const rawName = String(item.productName || item.name || "").trim();
        const rawBatchNo = String(item.batchNo || item.batch || "").trim();
        const rawExpiry = item.expiryDate || item.expiry || null;
        const qty = Math.max(0, Number(item.qty || 0));
        const freeQty = Math.max(0, Number(item.freeQty || item.free_qty || 0));
        const totalItemQty = qty + freeQty;
        const rate = Math.max(0, Number(item.rate || item.price || 0));
        const mrp = item.mrp != null ? Math.max(0, Number(item.mrp)) : null;
        const discountPercent = Math.max(0, Math.min(100, Number(item.discountPercent || item.discount || 0)));
        const taxPercent = Math.max(0, Number(item.taxPercent || item.tax_percent || 0));
        const pack = item.pack || null;
        const sku = item.sku || null;
        const conversionFactor = Number(item.conversionFactor || 1);

        if (!rawName) {
          throw buildApiError(400, "Product name is required for all items.");
        }
        if (totalItemQty <= 0) {
          throw buildApiError(400, `Quantity for "${rawName}" must be greater than zero.`);
        }

        // Resolve product & batch in DB
        let resolvedProductId = rawProductId;
        let resolvedBatchId = rawBatchId;
        let batchNo = rawBatchNo;
        let expiryDate = rawExpiry ? String(rawExpiry).slice(0, 10) : null;
        let availableStock = 0;

        if (resolvedProductId) {
          const [pCheck] = await conn.query("SELECT id, name, tax_percent FROM products WHERE user_id = ? AND id = ? LIMIT 1", [userId, resolvedProductId]);
          if (pCheck.length === 0) resolvedProductId = null;
        }

        if (!resolvedProductId) {
          const [pMatch] = await conn.query("SELECT id FROM products WHERE user_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1", [userId, rawName]);
          if (pMatch.length > 0) resolvedProductId = pMatch[0].id;
        }

        // Resolve batch
        if (resolvedProductId) {
          let batchRows = [];
          if (resolvedBatchId) {
            const [bCheck] = await conn.query(
              "SELECT id, batch_no, expiry_date, available_qty, mrp, selling_price FROM product_batches WHERE id = ? AND product_id = ? LIMIT 1 FOR UPDATE",
              [resolvedBatchId, resolvedProductId]
            );
            batchRows = bCheck;
          } else if (batchNo) {
            const [bMatch] = await conn.query(
              "SELECT id, batch_no, expiry_date, available_qty, mrp, selling_price FROM product_batches WHERE product_id = ? AND LOWER(TRIM(batch_no)) = LOWER(TRIM(?)) LIMIT 1 FOR UPDATE",
              [resolvedProductId, batchNo]
            );
            batchRows = bMatch;
          } else {
            const [bFirst] = await conn.query(
              "SELECT id, batch_no, expiry_date, available_qty, mrp, selling_price FROM product_batches WHERE product_id = ? ORDER BY available_qty DESC, expiry_date ASC LIMIT 1 FOR UPDATE",
              [resolvedProductId]
            );
            batchRows = bFirst;
          }

          if (batchRows.length > 0) {
            const b = batchRows[0];
            resolvedBatchId = b.id;
            batchNo = b.batch_no;
            if (!expiryDate && b.expiry_date) {
              expiryDate = String(b.expiry_date).slice(0, 10);
            }
            const physicalStock = Math.max(0, Number(b.available_qty || 0));

            // Check current active reservations for this batch
            const [resRows] = await conn.query(
              `SELECT COALESCE(SUM(remaining_qty), 0) AS reserved_qty
               FROM stock_reservations
               WHERE user_id = ? AND batch_id = ? AND status = 'active' AND remaining_qty > 0`,
              [userId, b.id]
            );
            const currentReserved = Math.max(0, Number(resRows[0]?.reserved_qty || 0));

            // Check draft bill locked qty
            const [draftRows] = await conn.query(
              `SELECT COALESCE(SUM(qty), 0) AS draft_qty
               FROM draft_bill_items
               WHERE user_id = ? AND batch_id = ?`,
              [userId, b.id]
            );
            const draftLocked = Math.max(0, Number(draftRows[0]?.draft_qty || 0));

            availableStock = Math.max(0, Number((physicalStock - (currentReserved + draftLocked)).toFixed(4)));

            // If issuing challan, enforce strict stock reservation check
            if (status === "issued") {
              if (totalItemQty > availableStock) {
                throw buildApiError(
                  400,
                  `Cannot create Sale Challan: Insufficient available stock for "${rawName}" (Batch: ${batchNo || "DEFAULT"}). Requested: ${totalItemQty}, Available: ${availableStock} (Physical: ${physicalStock}, Reserved: ${currentReserved}${draftLocked > 0 ? `, Drafts: ${draftLocked}` : ""}).`
                );
              }
            }
          }
        }

        // Calculations
        const itemGross = qty * rate;
        const itemDiscountAmount = itemGross * (discountPercent / 100);
        const taxable = itemGross - itemDiscountAmount;
        const itemTaxAmount = taxable * (taxPercent / 100);
        const itemTotal = taxable + itemTaxAmount;

        subtotal += taxable;
        totalDiscount += itemDiscountAmount;
        totalTax += itemTaxAmount;
        grandTotal += itemTotal;

        preparedItems.push({
          id: generateId(),
          productId: resolvedProductId,
          batchId: resolvedBatchId,
          productName: rawName,
          batchNo: batchNo || "DEFAULT",
          expiryDate: expiryDate || "2030-12-31",
          availableStock,
          qty,
          freeQty,
          mrp,
          rate,
          discountPercent,
          taxPercent,
          amount: Number(itemTotal.toFixed(2)),
          pack,
          sku,
          conversionFactor,
        });
      }

      grandTotal = Math.round(grandTotal * 100) / 100;
      subtotal = Math.round(subtotal * 100) / 100;
      totalTax = Math.round(totalTax * 100) / 100;

      // 3. Insert into sale_challans
      await conn.query(
        `INSERT INTO sale_challans (
           id, user_id, challan_number, challan_date, customer_name, customer_phone,
           customer_address, customer_gstin, subtotal, tax, discount, total, status,
           notes, created_by_role, created_by_name, employee_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          challanId,
          userId,
          challanNumber,
          challanDate,
          body.customerName ? String(body.customerName).trim() : null,
          body.customerPhone ? String(body.customerPhone).trim() : null,
          body.customerAddress ? String(body.customerAddress).trim() : null,
          body.customerGstin ? String(body.customerGstin).trim() : null,
          subtotal,
          totalTax,
          totalDiscount,
          grandTotal,
          status,
          body.notes ? String(body.notes).trim() : null,
          createdByRole,
          createdByName,
          employeeId,
        ]
      );

      // 4. Insert items & stock reservations
      for (const item of preparedItems) {
        await conn.query(
          `INSERT INTO sale_challan_items (
             id, challan_id, user_id, product_id, batch_id, product_name, batch_no,
             expiry_date, available_stock, qty, free_qty, mrp, rate, discount_percent,
             tax_percent, amount, pack, sku, conversion_factor
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            challanId,
            userId,
            item.productId,
            item.batchId,
            item.productName,
            item.batchNo,
            item.expiryDate,
            item.availableStock,
            item.qty,
            item.freeQty,
            item.mrp,
            item.rate,
            item.discountPercent,
            item.taxPercent,
            item.amount,
            item.pack,
            item.sku,
            item.conversionFactor,
          ]
        );

        // If status is 'issued', create stock reservation record
        if (status === "issued" && item.productId) {
          const totalReservedQty = item.qty + item.freeQty;
          await conn.query(
            `INSERT INTO stock_reservations (
               id, user_id, challan_id, challan_item_id, challan_number, product_id,
               batch_id, batch_no, reserved_qty, billed_qty, remaining_qty, status
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'active')`,
            [
              generateId(),
              userId,
              challanId,
              item.id,
              challanNumber,
              item.productId,
              item.batchId,
              item.batchNo,
              totalReservedQty,
              totalReservedQty,
            ]
          );
        }
      }

      return {
        id: challanId,
        challanNumber,
        status,
        total: grandTotal,
      };
    });

    res.status(201).json({
      success: true,
      message: `Sale Challan ${result.challanNumber} created successfully with status ${result.status}.`,
      challan: result,
    });
  } catch (error) {
    next(error);
  }
});

// ─── Edit Sale Challan ────────────────────────────────────────────────────────
router.put("/:id", async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const challanId = req.params.id;
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      throw buildApiError(400, "At least one product item is required for the Sale Challan.");
    }

    const challanDate = body.challanDate ? String(body.challanDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const newStatus = (body.status === "draft" ? "draft" : "issued");

    const result = await withTransaction(async (conn) => {
      // 1. Lock existing challan
      const [existingRows] = await conn.query(
        "SELECT * FROM sale_challans WHERE id = ? AND user_id = ? FOR UPDATE",
        [challanId, userId]
      );

      if (existingRows.length === 0) {
        throw buildApiError(404, "Sale Challan not found");
      }

      const existing = existingRows[0];
      if (existing.status === "billed") {
        throw buildApiError(400, "Cannot edit a fully billed challan.");
      }
      if (existing.status === "cancelled") {
        throw buildApiError(400, "Cannot edit a cancelled challan.");
      }

      // Check if any items are already billed
      const [billedItems] = await conn.query(
        "SELECT SUM(billed_qty) AS billed_total FROM sale_challan_items WHERE challan_id = ?",
        [challanId]
      );
      if (Number(billedItems[0]?.billed_total || 0) > 0) {
        throw buildApiError(400, "Cannot edit a challan that has already been partially billed.");
      }

      // 2. Temporarily release previous active reservations for this challan
      await conn.query("DELETE FROM stock_reservations WHERE challan_id = ? AND user_id = ?", [challanId, userId]);
      await conn.query("DELETE FROM sale_challan_items WHERE challan_id = ? AND user_id = ?", [challanId, userId]);

      let subtotal = 0;
      let totalTax = 0;
      let totalDiscount = 0;
      let grandTotal = 0;

      const preparedItems = [];

      // 3. Process new items and validate stock
      for (const item of items) {
        const rawProductId = item.productId || item.product_id;
        const rawBatchId = item.batchId || item.batch_id;
        const rawName = String(item.productName || item.name || "").trim();
        const rawBatchNo = String(item.batchNo || item.batch || "").trim();
        const rawExpiry = item.expiryDate || item.expiry || null;
        const qty = Math.max(0, Number(item.qty || 0));
        const freeQty = Math.max(0, Number(item.freeQty || item.free_qty || 0));
        const totalItemQty = qty + freeQty;
        const rate = Math.max(0, Number(item.rate || item.price || 0));
        const mrp = item.mrp != null ? Math.max(0, Number(item.mrp)) : null;
        const discountPercent = Math.max(0, Math.min(100, Number(item.discountPercent || item.discount || 0)));
        const taxPercent = Math.max(0, Number(item.taxPercent || item.tax_percent || 0));
        const pack = item.pack || null;
        const sku = item.sku || null;
        const conversionFactor = Number(item.conversionFactor || 1);

        if (!rawName) throw buildApiError(400, "Product name is required for all items.");
        if (totalItemQty <= 0) throw buildApiError(400, `Quantity for "${rawName}" must be greater than zero.`);

        let resolvedProductId = rawProductId;
        let resolvedBatchId = rawBatchId;
        let batchNo = rawBatchNo;
        let expiryDate = rawExpiry ? String(rawExpiry).slice(0, 10) : null;
        let availableStock = 0;

        if (resolvedProductId) {
          const [pCheck] = await conn.query("SELECT id FROM products WHERE user_id = ? AND id = ? LIMIT 1", [userId, resolvedProductId]);
          if (pCheck.length === 0) resolvedProductId = null;
        }
        if (!resolvedProductId) {
          const [pMatch] = await conn.query("SELECT id FROM products WHERE user_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1", [userId, rawName]);
          if (pMatch.length > 0) resolvedProductId = pMatch[0].id;
        }

        if (resolvedProductId) {
          let batchRows = [];
          if (resolvedBatchId) {
            const [bCheck] = await conn.query(
              "SELECT id, batch_no, expiry_date, available_qty FROM product_batches WHERE id = ? AND product_id = ? LIMIT 1 FOR UPDATE",
              [resolvedBatchId, resolvedProductId]
            );
            batchRows = bCheck;
          } else if (batchNo) {
            const [bMatch] = await conn.query(
              "SELECT id, batch_no, expiry_date, available_qty FROM product_batches WHERE product_id = ? AND LOWER(TRIM(batch_no)) = LOWER(TRIM(?)) LIMIT 1 FOR UPDATE",
              [resolvedProductId, batchNo]
            );
            batchRows = bMatch;
          }

          if (batchRows.length > 0) {
            const b = batchRows[0];
            resolvedBatchId = b.id;
            batchNo = b.batch_no;
            if (!expiryDate && b.expiry_date) expiryDate = String(b.expiry_date).slice(0, 10);
            const physicalStock = Math.max(0, Number(b.available_qty || 0));

            const [resRows] = await conn.query(
              `SELECT COALESCE(SUM(remaining_qty), 0) AS reserved_qty
               FROM stock_reservations
               WHERE user_id = ? AND batch_id = ? AND status = 'active' AND remaining_qty > 0`,
              [userId, b.id]
            );
            const currentReserved = Math.max(0, Number(resRows[0]?.reserved_qty || 0));

            const [draftRows] = await conn.query(
              `SELECT COALESCE(SUM(qty), 0) AS draft_qty
               FROM draft_bill_items
               WHERE user_id = ? AND batch_id = ?`,
              [userId, b.id]
            );
            const draftLocked = Math.max(0, Number(draftRows[0]?.draft_qty || 0));

            availableStock = Math.max(0, Number((physicalStock - (currentReserved + draftLocked)).toFixed(4)));

            if (newStatus === "issued" && totalItemQty > availableStock) {
              throw buildApiError(
                400,
                `Cannot update Sale Challan: Insufficient stock for "${rawName}" (Batch: ${batchNo || "DEFAULT"}). Requested: ${totalItemQty}, Available: ${availableStock}.`
              );
            }
          }
        }

        const itemGross = qty * rate;
        const itemDiscountAmount = itemGross * (discountPercent / 100);
        const taxable = itemGross - itemDiscountAmount;
        const itemTaxAmount = taxable * (taxPercent / 100);
        const itemTotal = taxable + itemTaxAmount;

        subtotal += taxable;
        totalDiscount += itemDiscountAmount;
        totalTax += itemTaxAmount;
        grandTotal += itemTotal;

        preparedItems.push({
          id: generateId(),
          productId: resolvedProductId,
          batchId: resolvedBatchId,
          productName: rawName,
          batchNo: batchNo || "DEFAULT",
          expiryDate: expiryDate || "2030-12-31",
          availableStock,
          qty,
          freeQty,
          mrp,
          rate,
          discountPercent,
          taxPercent,
          amount: Number(itemTotal.toFixed(2)),
          pack,
          sku,
          conversionFactor,
        });
      }

      grandTotal = Math.round(grandTotal * 100) / 100;
      subtotal = Math.round(subtotal * 100) / 100;
      totalTax = Math.round(totalTax * 100) / 100;

      // 4. Update sale_challans
      await conn.query(
        `UPDATE sale_challans SET
           challan_date = ?, customer_name = ?, customer_phone = ?,
           customer_address = ?, customer_gstin = ?, subtotal = ?, tax = ?,
           discount = ?, total = ?, status = ?, notes = ?, updated_at = NOW()
         WHERE id = ? AND user_id = ?`,
        [
          challanDate,
          body.customerName ? String(body.customerName).trim() : null,
          body.customerPhone ? String(body.customerPhone).trim() : null,
          body.customerAddress ? String(body.customerAddress).trim() : null,
          body.customerGstin ? String(body.customerGstin).trim() : null,
          subtotal,
          totalTax,
          totalDiscount,
          grandTotal,
          newStatus,
          body.notes ? String(body.notes).trim() : null,
          challanId,
          userId,
        ]
      );

      // 5. Re-insert items & stock reservations
      for (const item of preparedItems) {
        await conn.query(
          `INSERT INTO sale_challan_items (
             id, challan_id, user_id, product_id, batch_id, product_name, batch_no,
             expiry_date, available_stock, qty, free_qty, mrp, rate, discount_percent,
             tax_percent, amount, pack, sku, conversion_factor
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            challanId,
            userId,
            item.productId,
            item.batchId,
            item.productName,
            item.batchNo,
            item.expiryDate,
            item.availableStock,
            item.qty,
            item.freeQty,
            item.mrp,
            item.rate,
            item.discountPercent,
            item.taxPercent,
            item.amount,
            item.pack,
            item.sku,
            item.conversionFactor,
          ]
        );

        if (newStatus === "issued" && item.productId) {
          const totalReservedQty = item.qty + item.freeQty;
          await conn.query(
            `INSERT INTO stock_reservations (
               id, user_id, challan_id, challan_item_id, challan_number, product_id,
               batch_id, batch_no, reserved_qty, billed_qty, remaining_qty, status
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'active')`,
            [
              generateId(),
              userId,
              challanId,
              item.id,
              existing.challan_number,
              item.productId,
              item.batchId,
              item.batchNo,
              totalReservedQty,
              totalReservedQty,
            ]
          );
        }
      }

      return {
        id: challanId,
        challanNumber: existing.challan_number,
        status: newStatus,
        total: grandTotal,
      };
    });

    res.json({
      success: true,
      message: `Sale Challan ${result.challanNumber} updated successfully.`,
      challan: result,
    });
  } catch (error) {
    next(error);
  }
});

// ─── Cancel Sale Challan ──────────────────────────────────────────────────────
router.post("/:id/cancel", async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const challanId = req.params.id;

    const result = await withTransaction(async (conn) => {
      const [rows] = await conn.query(
        "SELECT * FROM sale_challans WHERE id = ? AND user_id = ? FOR UPDATE",
        [challanId, userId]
      );

      if (rows.length === 0) {
        throw buildApiError(404, "Sale Challan not found");
      }

      const challan = rows[0];

      if (challan.status === "cancelled") {
        throw buildApiError(400, "This Sale Challan is already cancelled.");
      }
      if (challan.status === "billed") {
        throw buildApiError(400, "Cannot cancel a fully billed Sale Challan.");
      }

      // Update status to cancelled
      await conn.query(
        "UPDATE sale_challans SET status = 'cancelled', updated_at = NOW() WHERE id = ? AND user_id = ?",
        [challanId, userId]
      );

      // Release all remaining active reservations
      await conn.query(
        `UPDATE stock_reservations 
         SET status = 'cancelled', remaining_qty = 0, updated_at = NOW()
         WHERE challan_id = ? AND user_id = ? AND status = 'active'`,
        [challanId, userId]
      );

      return challan;
    });

    res.json({
      success: true,
      message: `Sale Challan ${result.challan_number} cancelled and reserved stock successfully released.`,
    });
  } catch (error) {
    next(error);
  }
});

// ─── Convert Sale Challan to Final Sales Bill ──────────────────────────────────
router.post("/:id/generate-bill", async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const challanId = req.params.id;
    const body = req.body || {};
    const paymentMethod = body.paymentMethod || "cash";
    const advanceAmount = Math.max(0, Number(body.advanceAmount || 0));
    const isEmployee = Boolean(req.auth.isEmployee);
    const actorName = req.auth.employeeName || req.auth.name || (isEmployee ? "Staff" : "Admin");
    const createdByRole = isEmployee ? "employee" : "admin";
    const employeeId = req.auth.employeeId || null;

    const result = await withTransaction(async (conn) => {
      // 1. Lock and fetch challan
      const [cRows] = await conn.query(
        "SELECT * FROM sale_challans WHERE id = ? AND user_id = ? FOR UPDATE",
        [challanId, userId]
      );

      if (cRows.length === 0) {
        throw buildApiError(404, "Sale Challan not found");
      }

      const challan = cRows[0];

      if (challan.status === "billed") {
        throw buildApiError(400, "This Sale Challan has already been fully converted into a sales invoice.");
      }
      if (challan.status === "cancelled") {
        throw buildApiError(400, "Cannot generate bill for a cancelled Sale Challan.");
      }

      // Fetch challan items
      const [items] = await conn.query(
        "SELECT * FROM sale_challan_items WHERE challan_id = ? AND user_id = ? FOR UPDATE",
        [challanId, userId]
      );

      if (items.length === 0) {
        throw buildApiError(400, "Challan contains no items to bill.");
      }

      // Check which items to bill (supports full or partial billing)
      // body.items can optionally specify [{ challanItemId, qty, freeQty }]
      const requestedOverrides = new Map();
      if (Array.isArray(body.items) && body.items.length > 0) {
        for (const reqIt of body.items) {
          if (reqIt.challanItemId) {
            requestedOverrides.set(reqIt.challanItemId, {
              qty: Math.max(0, Number(reqIt.qty || 0)),
              freeQty: Math.max(0, Number(reqIt.freeQty || 0)),
            });
          }
        }
      }

      const itemsToBill = [];
      for (const it of items) {
        const remainingQty = Math.max(0, Number(it.qty) - Number(it.billed_qty || 0));
        const remainingFreeQty = Math.max(0, Number(it.free_qty) - Number(it.billed_free_qty || 0));

        let billQty = remainingQty;
        let billFreeQty = remainingFreeQty;

        if (requestedOverrides.has(it.id)) {
          const override = requestedOverrides.get(it.id);
          billQty = Math.min(remainingQty, override.qty);
          billFreeQty = Math.min(remainingFreeQty, override.freeQty);
        }

        if (billQty > 0 || billFreeQty > 0) {
          itemsToBill.push({
            challanItem: it,
            billQty,
            billFreeQty,
            totalBillQty: billQty + billFreeQty,
          });
        }
      }

      if (itemsToBill.length === 0) {
        throw buildApiError(400, "All items in this Sale Challan have already been billed.");
      }

      // 2. Generate Next Invoice Number (INV-xxxx)
      const [maxRows] = await conn.query(
        `SELECT MAX(CAST(SUBSTRING_INDEX(number, '-', -1) AS UNSIGNED)) AS maxNo
         FROM bills
         WHERE user_id = ? AND number LIKE 'INV-%'`,
        [userId]
      );
      const nextNo = Number(maxRows[0]?.maxNo || 0) + 1;
      const invoiceNumber = `INV-${String(nextNo).padStart(4, "0")}`;

      // 3. Atomically deduct physical inventory & release stock reservations
      let billSubtotal = 0;
      let billTax = 0;
      let billDiscount = 0;
      let billTotal = 0;

      const preparedBillItems = [];

      for (const { challanItem, billQty, billFreeQty, totalBillQty } of itemsToBill) {
        const productId = challanItem.product_id;
        const batchId = challanItem.batch_id;
        const rate = Number(challanItem.rate || 0);
        const mrp = challanItem.mrp != null ? Number(challanItem.mrp) : null;
        const discountPercent = Number(challanItem.discount_percent || 0);
        const taxPercent = Number(challanItem.tax_percent || 0);

        const itemGross = billQty * rate;
        const itemDiscount = itemGross * (discountPercent / 100);
        const taxable = itemGross - itemDiscount;
        const itemTax = taxable * (taxPercent / 100);
        const itemAmount = taxable + itemTax;

        billSubtotal += taxable;
        billDiscount += itemDiscount;
        billTax += itemTax;
        billTotal += itemAmount;

        // Deduct actual physical stock from product_batches
        let targetBatchId = batchId;
        if (targetBatchId) {
          const [bRows] = await conn.query(
            "SELECT id, available_qty FROM product_batches WHERE id = ? FOR UPDATE",
            [targetBatchId]
          );
          if (bRows.length > 0) {
            const currentQty = Number(bRows[0].available_qty || 0);
            const nextQty = Math.max(0, currentQty - totalBillQty);
            await conn.query("UPDATE product_batches SET available_qty = ? WHERE id = ?", [nextQty, targetBatchId]);
          }
        } else if (productId) {
          // If no specific batch ID, deduct from earliest expiring batch with stock
          const [allBatches] = await conn.query(
            "SELECT id, available_qty FROM product_batches WHERE product_id = ? ORDER BY (available_qty > 0) DESC, expiry_date ASC FOR UPDATE",
            [productId]
          );
          let toDec = totalBillQty;
          for (const b of allBatches) {
            if (toDec <= 0) break;
            const bQty = Number(b.available_qty || 0);
            const deductNow = Math.min(bQty, toDec);
            await conn.query("UPDATE product_batches SET available_qty = ? WHERE id = ?", [Math.max(0, bQty - deductNow), b.id]);
            toDec -= deductNow;
            if (!targetBatchId) targetBatchId = b.id;
          }
        }

        // Calculate new product total stock & log history
        if (productId) {
          const [sumRows] = await conn.query(
            "SELECT COALESCE(SUM(available_qty), 0) AS total FROM product_batches WHERE product_id = ?",
            [productId]
          );
          const nextStock = Number(sumRows[0]?.total || 0);

          try {
            await conn.query(
              `INSERT INTO product_history (id, user_id, product_id, action, quantity, balance, notes, invoice_no)
               VALUES (?, ?, ?, 'sale', ?, ?, ?, ?)`,
              [
                generateId(),
                userId,
                productId,
                totalBillQty,
                nextStock,
                `Sale via ${invoiceNumber} from Challan ${challan.challan_number} by ${actorName}`,
                invoiceNumber,
              ]
            );
          } catch (hErr) {
            console.warn("Product history log error:", hErr.message);
          }
        }

        // Release / decrement stock reservation
        const [resRows] = await conn.query(
          `SELECT id, reserved_qty, billed_qty, remaining_qty 
           FROM stock_reservations 
           WHERE challan_item_id = ? AND user_id = ? FOR UPDATE`,
          [challanItem.id, userId]
        );

        if (resRows.length > 0) {
          const res = resRows[0];
          const newBilled = Number(res.billed_qty || 0) + totalBillQty;
          const newRemaining = Math.max(0, Number(res.reserved_qty || 0) - newBilled);
          const newResStatus = newRemaining <= 0 ? "billed" : "active";

          await conn.query(
            `UPDATE stock_reservations
             SET billed_qty = ?, remaining_qty = ?, status = ?, updated_at = NOW()
             WHERE id = ?`,
            [newBilled, newRemaining, newResStatus, res.id]
          );
        }

        // Update sale_challan_items
        const newBilledQty = Number(challanItem.billed_qty || 0) + billQty;
        const newBilledFreeQty = Number(challanItem.billed_free_qty || 0) + billFreeQty;
        await conn.query(
          "UPDATE sale_challan_items SET billed_qty = ?, billed_free_qty = ? WHERE id = ?",
          [newBilledQty, newBilledFreeQty, challanItem.id]
        );

        preparedBillItems.push({
          id: generateId(),
          productId,
          name: challanItem.product_name,
          sku: challanItem.sku,
          price: rate,
          costPrice: null,
          qty: billQty,
          freeQty: billFreeQty,
          taxPercent,
          mrp,
          batch: challanItem.batch_no,
          pack: challanItem.pack,
          expiry: challanItem.expiry_date,
          conversionFactor: challanItem.conversion_factor,
        });
      }

      billTotal = Math.round(billTotal * 100) / 100;
      billSubtotal = Math.round(billSubtotal * 100) / 100;
      billTax = Math.round(billTax * 100) / 100;
      billDiscount = Math.round(billDiscount * 100) / 100;

      // 4. Create Bill Record
      const billId = generateId();
      await conn.query(
        `INSERT INTO bills (
           id, user_id, number, customer_name, customer_phone, customer_address,
           customer_gstin, customer_notes, cashier, payment_method, advance_amount,
           subtotal, tax, discount, total, status, created_by_role, created_by_name,
           employee_id, challan_id, challan_number
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)`,
        [
          billId,
          userId,
          invoiceNumber,
          challan.customer_name,
          challan.customer_phone,
          challan.customer_address,
          challan.customer_gstin,
          body.notes || `Generated from Delivery Challan ${challan.challan_number}`,
          actorName,
          paymentMethod,
          advanceAmount,
          billSubtotal,
          billTax,
          billDiscount,
          billTotal,
          createdByRole,
          actorName,
          employeeId,
          challan.id,
          challan.challan_number,
        ]
      );

      // 5. Insert Bill Items
      for (const bi of preparedBillItems) {
        await conn.query(
          `INSERT INTO bill_items (
             id, bill_id, user_id, product_id, name, sku, price, qty, free_qty,
             tax_percent, mrp, batch, pack, expiry, conversion_factor
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            bi.id,
            billId,
            userId,
            bi.productId,
            bi.name,
            bi.sku,
            bi.price,
            bi.qty,
            bi.freeQty,
            bi.taxPercent,
            bi.mrp,
            bi.batch,
            bi.pack,
            bi.expiry,
            bi.conversionFactor,
          ]
        );
      }

      // 6. Insert Mapping into challan_invoices
      await conn.query(
        `INSERT INTO challan_invoices (id, user_id, challan_id, bill_id, challan_number, invoice_number)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [generateId(), userId, challan.id, billId, challan.challan_number, invoiceNumber]
      );

      // 7. Check if all items in challan are now fully billed
      const [remRows] = await conn.query(
        "SELECT SUM(qty - billed_qty) AS remainingTotal FROM sale_challan_items WHERE challan_id = ?",
        [challan.id]
      );
      const remainingTotal = Number(remRows[0]?.remainingTotal || 0);
      const newChallanStatus = remainingTotal <= 0.001 ? "billed" : "partially_billed";

      await conn.query(
        "UPDATE sale_challans SET status = ?, updated_at = NOW() WHERE id = ?",
        [newChallanStatus, challan.id]
      );

      return {
        billId,
        invoiceNumber,
        newChallanStatus,
        challanNumber: challan.challan_number,
        total: billTotal,
      };
    });

    res.json({
      success: true,
      message: `Invoice ${result.invoiceNumber} successfully created from Challan ${result.challanNumber}. Actual inventory has been deducted and stock reservation released.`,
      billId: result.billId,
      invoiceNumber: result.invoiceNumber,
      challanStatus: result.newChallanStatus,
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
});

export { router as challansRouter };
