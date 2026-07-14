import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    let billsQuery = `SELECT customer_name, customer_phone, customer_address, customer_drug_lic_no, customer_gstin, customer_notes, payment_method, advance_amount, total, created_at
       FROM bills
       WHERE user_id = ?`;
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

    const map = new Map();
    for (const row of rows) {
      const phone = String(row.customer_phone || "").trim();
      const name = String(row.customer_name || "").trim();
      if (!phone && !name) continue;
      const key = phone || `name:${name.toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, {
          phone,
          name,
          address: row.customer_address || undefined,
          drugLicNo: row.customer_drug_lic_no || undefined,
          gstin: row.customer_gstin || undefined,
          notes: row.customer_notes || undefined,
          visits: 1,
          totalSpent: Number(row.total || 0),
          totalCredit:
            row.payment_method === "credit"
              ? Number(row.total || 0)
              : 0,
          totalPaid:
            row.payment_method === "credit"
              ? Number(row.advance_amount || 0)
              : 0,
          balance: 0,
          lastVisit: row.created_at,
        });
      } else {
        const current = map.get(key);
        current.visits += 1;
        current.totalSpent += Number(row.total || 0);
        if (row.payment_method === "credit") {
          current.totalCredit += Number(row.total || 0);
          current.totalPaid += Number(row.advance_amount || 0);
        }
      }
    }

    const [payments] = await pool.query(paymentsQuery, payParams);

    for (const p of payments) {
      const phone = String(p.customer_phone || "").trim();
      const name = String(p.customer_name || "").trim();
      if (!phone && !name) continue;
      const key = phone || `name:${name.toLowerCase()}`;
      if (map.has(key)) {
        map.get(key).totalPaid += Number(p.amount || 0);
      }
    }

    for (const c of map.values()) {
      c.balance = c.totalCredit - c.totalPaid;
    }

    res.json(Array.from(map.values()));
  } catch (error) {
    next(error);
  }
});

import { generateId } from "../utils.js";

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
    const phone = req.params.phone;

    // Get credit bills (show full total)
    const [bills] = await pool.query(
      `SELECT id, number, total as amount, created_at, 'bill' as type 
       FROM bills 
       WHERE user_id = ? AND customer_phone = ? AND payment_method = 'credit'
       ORDER BY created_at DESC`,
      [req.auth.userId, phone],
    );

    // Get payments (including advance payments)
    const [payments] = await pool.query(
      `SELECT id, amount, payment_method as method, created_at, 'payment' as type, 0 as is_advance
       FROM customer_payments 
       WHERE user_id = ? AND customer_phone = ?
       UNION ALL
       SELECT id, advance_amount as amount, advance_payment_method as method, created_at, 'payment' as type, 1 as is_advance
       FROM bills
       WHERE user_id = ? AND customer_phone = ? AND payment_method = 'credit' AND advance_amount > 0
       ORDER BY created_at DESC`,
      [req.auth.userId, phone, req.auth.userId, phone],
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
    const oldPhone = req.params.phone;
    const { name, phone, address, drugLicNo, gstin, notes } = req.body;

    // Update bills
    await pool.query(
      `UPDATE bills SET customer_name = ?, customer_phone = ?, customer_address = ?, customer_drug_lic_no = ?, customer_gstin = ?, customer_notes = ? WHERE user_id = ? AND customer_phone = ?`,
      [name || null, phone || null, address || null, drugLicNo || null, gstin || null, notes || null, req.auth.userId, oldPhone],
    );

    // Update payments
    await pool.query(
      `UPDATE customer_payments SET customer_name = ?, customer_phone = ? WHERE user_id = ? AND customer_phone = ?`,
      [name || null, phone || null, req.auth.userId, oldPhone],
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export { router as customersRouter };
