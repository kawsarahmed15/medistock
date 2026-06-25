import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT customer_name, customer_phone, customer_notes, total, created_at
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
          notes: row.customer_notes || undefined,
          visits: 1,
          totalSpent: Number(row.total || 0),
          lastVisit: row.created_at,
        });
      } else {
        const current = map.get(key);
        current.visits += 1;
        current.totalSpent += Number(row.total || 0);
      }
    }

    res.json(Array.from(map.values()));
  } catch (error) {
    next(error);
  }
});

export { router as customersRouter };
