import { Router } from "express";
import { pool } from "../db.js";
import { buildApiError, sanitizeUser } from "../utils.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Middleware to protect admin routes
async function requireSuperAdmin(req, res, next) {
  try {
    const [rows] = await pool.query("SELECT role, account_status FROM users WHERE id = ?", [
      req.auth.userId,
    ]);
    const user = rows[0];

    if (!user || user.role !== "superadmin") {
      throw buildApiError(403, "Forbidden: Superadmin access required");
    }

    if (user.account_status !== "active") {
      throw buildApiError(403, "Forbidden: Account is not active");
    }

    next();
  } catch (error) {
    next(error);
  }
}

router.use(requireAuth);
router.use(requireSuperAdmin);

// Get platform metrics
router.get("/metrics", async (req, res, next) => {
  try {
    const [userCountRows] = await pool.query("SELECT COUNT(*) as total FROM users");
    const totalUsers = userCountRows[0].total;

    const [activeUserRows] = await pool.query(
      "SELECT COUNT(*) as total FROM users WHERE account_status = 'active'",
    );
    const activeUsers = activeUserRows[0].total;

    const [billsCountRows] = await pool.query("SELECT COUNT(*) as total FROM bills");
    const totalBills = billsCountRows[0].total;

    const [revenueRows] = await pool.query("SELECT SUM(total_amount) as total FROM bills");
    const totalRevenue = revenueRows[0].total || 0;

    res.json({
      metrics: {
        totalUsers,
        activeUsers,
        totalBills,
        totalRevenue,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get users list
router.get("/users", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, is_verified, created_at, pharmacy_name, gst_number, role, account_status, last_login 
       FROM users 
       ORDER BY created_at DESC`,
    );

    res.json({ users: rows });
  } catch (error) {
    next(error);
  }
});

// Update user status
router.patch("/users/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["active", "suspended", "banned"].includes(status)) {
      throw buildApiError(400, "Invalid status");
    }

    await pool.query("UPDATE users SET account_status = ? WHERE id = ?", [status, req.params.id]);

    res.json({ message: "User status updated successfully" });
  } catch (error) {
    next(error);
  }
});

// Delete user
router.delete("/users/:id", async (req, res, next) => {
  try {
    // Delete user's data first
    await pool.query(
      "DELETE FROM bill_items WHERE bill_id IN (SELECT id FROM bills WHERE user_id = ?)",
      [req.params.id],
    );
    await pool.query("DELETE FROM bills WHERE user_id = ?", [req.params.id]);
    await pool.query("DELETE FROM inventory WHERE user_id = ?", [req.params.id]);
    await pool.query("DELETE FROM customers WHERE user_id = ?", [req.params.id]);

    // Delete user
    await pool.query("DELETE FROM users WHERE id = ?", [req.params.id]);

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    next(error);
  }
});

export { router as adminRouter };
