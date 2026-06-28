import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT customer_name, customer_phone, customer_address, customer_notes, payment_method, total, created_at
       FROM bills
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.auth.userId],
    );

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
          notes: row.customer_notes || undefined,
          visits: 1,
          totalSpent: Number(row.total || 0),
          totalCredit: row.payment_method === 'credit' ? Number(row.total || 0) : 0,
          totalPaid: 0,
          balance: 0,
          lastVisit: row.created_at,
        });
      } else {
        const current = map.get(key);
        current.visits += 1;
        current.totalSpent += Number(row.total || 0);
        if (row.payment_method === 'credit') {
          current.totalCredit += Number(row.total || 0);
        }
      }
    }

    const [payments] = await pool.query(
      `SELECT customer_phone, customer_name, amount 
       FROM customer_payments 
       WHERE user_id = ?`,
      [req.auth.userId]
    );

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
        notes || null
      ]
    );
    res.status(201).json({ success: true, id });
  } catch (err) {
    next(err);
  }
});

export { router as customersRouter };
