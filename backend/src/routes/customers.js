import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { generateId } from "../utils.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    let billsQuery = `SELECT customer_name, customer_phone, customer_address, customer_drug_lic_no, customer_gstin, customer_notes, payment_method, advance_amount, total, created_at
       FROM bills
       WHERE user_id = ? AND (status IS NULL OR status != 'rejected')`;
    let paymentsQuery = `SELECT customer_phone, customer_name, amount, created_at 
       FROM customer_payments 
       WHERE user_id = ?`;
    const params = [req.auth.userId];
    const payParams = [req.auth.userId];

    if (req.query.from) {
      billsQuery += ` AND created_at >= ?`;
      paymentsQuery += ` AND created_at >= ?`;
      params.push(req.query.from);
      payParams.push(req.query.from);
    }
    if (req.query.to) {
      billsQuery += ` AND created_at <= ?`;
      paymentsQuery += ` AND created_at <= ?`;
      params.push(`${req.query.to} 23:59:59`);
      payParams.push(`${req.query.to} 23:59:59`);
    }

    billsQuery += ` ORDER BY created_at DESC`;

    const [rows] = await pool.query(billsQuery, params);

    const customers = [];

    function findCustomer(name, phone) {
      const normName = String(name || "").trim().toLowerCase();
      const rawPhone = String(phone || "").trim();
      const cleanDigits = rawPhone.replace(/\D/g, "").slice(-10);

      // Pass 1: exact name AND clean phone digits match
      for (const c of customers) {
        const cNormName = c.name.trim().toLowerCase();
        const cCleanDigits = c.phone.replace(/\D/g, "").slice(-10);

        if (normName && cNormName && normName !== cNormName) continue;
        if (cleanDigits && cCleanDigits && cleanDigits.length === 10 && cCleanDigits.length === 10 && cleanDigits !== cCleanDigits) continue;

        if (normName && cNormName && normName === cNormName && cleanDigits && cCleanDigits && cleanDigits === cCleanDigits) {
          return c;
        }
      }

      // Pass 2: name matches (and one lacks phone)
      for (const c of customers) {
        const cNormName = c.name.trim().toLowerCase();
        const cCleanDigits = c.phone.replace(/\D/g, "").slice(-10);

        if (normName && cNormName && normName !== cNormName) continue;
        if (cleanDigits && cCleanDigits && cleanDigits.length === 10 && cCleanDigits.length === 10 && cleanDigits !== cCleanDigits) continue;

        if (normName && cNormName && normName === cNormName && (!cleanDigits || !cCleanDigits)) {
          return c;
        }
      }

      // Pass 3: phone matches (and one lacks name)
      for (const c of customers) {
        const cNormName = c.name.trim().toLowerCase();
        const cCleanDigits = c.phone.replace(/\D/g, "").slice(-10);

        if (normName && cNormName && normName !== cNormName) continue;
        if (cleanDigits && cCleanDigits && cleanDigits.length === 10 && cCleanDigits.length === 10 && cleanDigits !== cCleanDigits) continue;

        if (cleanDigits && cCleanDigits && cleanDigits.length === 10 && cleanDigits === cCleanDigits && (!normName || !cNormName)) {
          return c;
        }
      }

      return null;
    }

    for (const row of rows) {
      const phone = String(row.customer_phone || "").trim();
      const name = String(row.customer_name || "").trim();
      if (!phone && !name) continue;

      const rowTotal = Number(row.total || 0);
      const isCredit = row.payment_method === "credit";
      const advance = isCredit ? Number(row.advance_amount || 0) : 0;

      let current = findCustomer(name, phone);
      if (!current) {
        current = {
          phone,
          name,
          address: row.customer_address || undefined,
          drugLicNo: row.customer_drug_lic_no || undefined,
          gstin: row.customer_gstin || undefined,
          notes: row.customer_notes || undefined,
          visits: 1,
          totalSpent: rowTotal,
          totalCredit: isCredit ? rowTotal : 0,
          totalPaid: advance,
          balance: 0,
          lastVisit: row.created_at,
        };
        customers.push(current);
      } else {
        current.visits += 1;
        current.totalSpent = Number((current.totalSpent + rowTotal).toFixed(2));
        if (isCredit) {
          current.totalCredit = Number((current.totalCredit + rowTotal).toFixed(2));
          current.totalPaid = Number((current.totalPaid + advance).toFixed(2));
        }
        if (!current.address && row.customer_address) current.address = row.customer_address;
        if (!current.drugLicNo && row.customer_drug_lic_no) current.drugLicNo = row.customer_drug_lic_no;
        if (!current.gstin && row.customer_gstin) current.gstin = row.customer_gstin;
        if (!current.phone && phone) current.phone = phone;
        if (!current.name && name) current.name = name;
      }
    }

    const [payments] = await pool.query(paymentsQuery, payParams);

    for (const p of payments) {
      const phone = String(p.customer_phone || "").trim();
      const name = String(p.customer_name || "").trim();
      if (!phone && !name) continue;
      const current = findCustomer(name, phone);
      if (current) {
        current.totalPaid = Number((current.totalPaid + Number(p.amount || 0)).toFixed(2));
      }
    }

    for (const c of customers) {
      c.totalSpent = Number(c.totalSpent.toFixed(2));
      c.totalCredit = Number(c.totalCredit.toFixed(2));
      c.totalPaid = Number(c.totalPaid.toFixed(2));
      c.balance = Number((c.totalCredit - c.totalPaid).toFixed(2));
    }

    res.json(customers);
  } catch (error) {
    next(error);
  }
});

router.get("/payments/all", async (req, res, next) => {
  try {
    const params = [req.auth.userId];
    let query = `SELECT id, amount, payment_method as method, created_at, customer_name, customer_phone FROM customer_payments WHERE user_id = ?`;
    if (req.query.from) {
      query += ` AND created_at >= ?`;
      params.push(req.query.from);
    }
    if (req.query.to) {
      query += ` AND created_at <= ?`;
      params.push(`${req.query.to} 23:59:59`);
    }
    query += ` ORDER BY created_at DESC`;
    const [payments] = await pool.query(query, params);
    res.json(payments);
  } catch (err) {
    next(err);
  }
});

router.post("/pay", async (req, res, next) => {
  try {
    const { phone, name, amount, method, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });
    if (!phone && !name) return res.status(400).json({ error: "Customer phone or name required" });

    const id = generateId();
    await pool.query(
      `INSERT INTO customer_payments (id, user_id, customer_phone, customer_name, amount, payment_method, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.auth.userId,
        phone || null,
        name || null,
        Number(amount),
        ["cash", "online"].includes(method) ? method : "cash",
        notes || null,
      ],
    );
    res.status(201).json({ success: true, id });
  } catch (err) {
    next(err);
  }
});

router.get("/:phone/credit-history", async (req, res, next) => {
  try {
    const rawPhone = (req.params.phone || "").trim();
    const customerName = String(req.query.name || "").trim();
    const phoneDigits = rawPhone.replace(/\D/g, "").slice(-10);

    const hasPhone = rawPhone && rawPhone !== "none";
    const hasName = Boolean(customerName);

    // Get credit bills (show full total)
    let whereBill = "user_id = ? AND payment_method = 'credit' AND (status IS NULL OR status != 'rejected')";
    let paramsBill = [req.auth.userId];

    if (hasPhone && phoneDigits.length === 10) {
      whereBill += " AND (customer_phone = ? OR RIGHT(REGEXP_REPLACE(customer_phone, '[^0-9]', ''), 10) = ?)";
      paramsBill.push(rawPhone, phoneDigits);
    } else if (hasPhone) {
      whereBill += " AND customer_phone = ?";
      paramsBill.push(rawPhone);
    }
    if (hasName) {
      whereBill += " AND LOWER(TRIM(customer_name)) = LOWER(TRIM(?))";
      paramsBill.push(customerName);
    }

    const [bills] = await pool.query(
      `SELECT id, number, total as amount, created_at, 'bill' as type 
       FROM bills 
       WHERE ${whereBill}
       ORDER BY created_at DESC`,
      paramsBill,
    );

    // Get payments (including advance payments)
    let wherePay = "user_id = ?";
    let paramsPay = [req.auth.userId];

    if (hasPhone && phoneDigits.length === 10) {
      wherePay += " AND (customer_phone = ? OR RIGHT(REGEXP_REPLACE(customer_phone, '[^0-9]', ''), 10) = ?)";
      paramsPay.push(rawPhone, phoneDigits);
    } else if (hasPhone) {
      wherePay += " AND customer_phone = ?";
      paramsPay.push(rawPhone);
    }
    if (hasName) {
      wherePay += " AND LOWER(TRIM(customer_name)) = LOWER(TRIM(?))";
      paramsPay.push(customerName);
    }

    let whereAdv = "user_id = ? AND payment_method = 'credit' AND advance_amount > 0 AND (status IS NULL OR status != 'rejected')";
    let paramsAdv = [req.auth.userId];

    if (hasPhone && phoneDigits.length === 10) {
      whereAdv += " AND (customer_phone = ? OR RIGHT(REGEXP_REPLACE(customer_phone, '[^0-9]', ''), 10) = ?)";
      paramsAdv.push(rawPhone, phoneDigits);
    } else if (hasPhone) {
      whereAdv += " AND customer_phone = ?";
      paramsAdv.push(rawPhone);
    }
    if (hasName) {
      whereAdv += " AND LOWER(TRIM(customer_name)) = LOWER(TRIM(?))";
      paramsAdv.push(customerName);
    }

    const [payments] = await pool.query(
      `SELECT id, amount, payment_method as method, created_at, 'payment' as type, 0 as is_advance
       FROM customer_payments 
       WHERE ${wherePay}
       UNION ALL
       SELECT id, advance_amount as amount, advance_payment_method as method, created_at, 'payment' as type, 1 as is_advance
       FROM bills
       WHERE ${whereAdv}
       ORDER BY created_at DESC`,
      [...paramsPay, ...paramsAdv],
    );

    const history = [...bills, ...payments].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );
    res.json(history);
  } catch (err) {
    next(err);
  }
});

router.put("/:phone", async (req, res, next) => {
  try {
    const oldPhone = (req.params.phone || "").trim();
    const { name, phone, address, drugLicNo, gstin, notes, oldName } = req.body;

    // Update bills
    let billsUpdate = `UPDATE bills SET customer_name = ?, customer_phone = ?, customer_address = ?, customer_drug_lic_no = ?, customer_gstin = ?, customer_notes = ? WHERE user_id = ?`;
    const billsParams = [name || null, phone || null, address || null, drugLicNo || null, gstin || null, notes || null, req.auth.userId];

    if (oldPhone && oldPhone !== "none") {
      const phoneDigits = oldPhone.replace(/\D/g, "").slice(-10);
      if (phoneDigits.length === 10) {
        billsUpdate += ` AND (customer_phone = ? OR RIGHT(REGEXP_REPLACE(customer_phone, '[^0-9]', ''), 10) = ?)`;
        billsParams.push(oldPhone, phoneDigits);
      } else {
        billsUpdate += ` AND customer_phone = ?`;
        billsParams.push(oldPhone);
      }
    }
    if (oldName) {
      billsUpdate += ` AND LOWER(TRIM(customer_name)) = LOWER(TRIM(?))`;
      billsParams.push(oldName);
    }
    await pool.query(billsUpdate, billsParams);

    // Update payments
    let payUpdate = `UPDATE customer_payments SET customer_name = ?, customer_phone = ? WHERE user_id = ?`;
    const payParams = [name || null, phone || null, req.auth.userId];
    if (oldPhone && oldPhone !== "none") {
      const phoneDigits = oldPhone.replace(/\D/g, "").slice(-10);
      if (phoneDigits.length === 10) {
        payUpdate += ` AND (customer_phone = ? OR RIGHT(REGEXP_REPLACE(customer_phone, '[^0-9]', ''), 10) = ?)`;
        payParams.push(oldPhone, phoneDigits);
      } else {
        payUpdate += ` AND customer_phone = ?`;
        payParams.push(oldPhone);
      }
    }
    if (oldName) {
      payUpdate += ` AND LOWER(TRIM(customer_name)) = LOWER(TRIM(?))`;
      payParams.push(oldName);
    }
    await pool.query(payUpdate, payParams);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export { router as customersRouter };
