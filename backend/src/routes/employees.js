import { Router } from "express";
import { pool } from "../db.js";
import { buildApiError, generateId, hashPassword, comparePassword } from "../utils.js";
import { requireAdminOnly } from "../middleware/auth.js";

const router = Router();

// Protect all employee routes to Admin only
router.use(requireAdminOnly);

// List all employees for the current pharmacy owner
router.get("/", async (req, res, next) => {
  try {
    const [employees] = await pool.query(
      `SELECT id, user_id, name, username, email, phone, status, created_at, updated_at
       FROM employees
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.auth.userId],
    );

    res.json({ employees });
  } catch (error) {
    next(error);
  }
});

// Create a new employee
router.post("/", async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    const username = String(req.body?.username || "").trim();
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;
    const phone = req.body?.phone ? String(req.body.phone).trim() : null;
    const password = String(req.body?.password || "");
    const status = req.body?.status === "disabled" ? "disabled" : "active";

    if (!name) {
      throw buildApiError(400, "Employee name is required");
    }
    if (name.length > 100) {
      throw buildApiError(400, "Employee name is too long (max 100 characters)");
    }
    if (!username) {
      throw buildApiError(400, "Employee username is required");
    }
    if (username.length > 100) {
      throw buildApiError(400, "Employee username is too long (max 100 characters)");
    }
    if (!password || password.length < 4) {
      throw buildApiError(400, "Employee password must be at least 4 characters");
    }

    // Check if username is already taken
    const [dupUser] = await pool.query(
      "SELECT id FROM employees WHERE LOWER(username) = LOWER(?) LIMIT 1",
      [username],
    );
    if (dupUser.length > 0) {
      throw buildApiError(400, "Username already in use");
    }

    // Check if employee password matches admin password
    const [adminRows] = await pool.query(
      "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
      [req.auth.userId],
    );
    if (adminRows.length > 0) {
      const matchesAdmin = await comparePassword(password, adminRows[0].password_hash);
      if (matchesAdmin) {
        throw buildApiError(400, "Employee password cannot be the same as admin password");
      }
    }

    const passwordHash = await hashPassword(password);
    const employeeId = generateId();

    await pool.query(
      `INSERT INTO employees (id, user_id, name, username, email, phone, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [employeeId, req.auth.userId, name, username, email, phone, passwordHash, status],
    );

    const [rows] = await pool.query(
      `SELECT id, user_id, name, username, email, phone, status, created_at, updated_at
       FROM employees
       WHERE id = ? LIMIT 1`,
      [employeeId],
    );

    res.status(201).json({
      message: "Employee created successfully",
      employee: rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// Update employee details (name, username, email, phone, status)
router.patch("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const name = req.body?.name !== undefined ? String(req.body.name).trim() : undefined;
    const username = req.body?.username !== undefined ? String(req.body.username).trim() : undefined;
    const email = req.body?.email !== undefined ? (req.body.email ? String(req.body.email).trim().toLowerCase() : null) : undefined;
    const phone = req.body?.phone !== undefined ? (req.body.phone ? String(req.body.phone).trim() : null) : undefined;
    const status = req.body?.status !== undefined ? (req.body.status === "disabled" ? "disabled" : "active") : undefined;

    const [existing] = await pool.query(
      "SELECT id FROM employees WHERE id = ? AND user_id = ? LIMIT 1",
      [id, req.auth.userId],
    );
    if (existing.length === 0) {
      throw buildApiError(404, "Employee not found");
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      if (!name) throw buildApiError(400, "Employee name cannot be empty");
      updates.push("name = ?");
      values.push(name);
    }
    if (username !== undefined) {
      if (!username) throw buildApiError(400, "Employee username cannot be empty");
      const [dupUser] = await pool.query(
        "SELECT id FROM employees WHERE LOWER(username) = LOWER(?) AND id != ? LIMIT 1",
        [username, id],
      );
      if (dupUser.length > 0) {
        throw buildApiError(400, "Username already in use");
      }
      updates.push("username = ?");
      values.push(username);
    }
    if (email !== undefined) {
      updates.push("email = ?");
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push("phone = ?");
      values.push(phone);
    }
    if (status !== undefined) {
      updates.push("status = ?");
      values.push(status);
    }

    if (updates.length > 0) {
      values.push(id, req.auth.userId);
      await pool.query(
        `UPDATE employees SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`,
        values,
      );
    }

    const [rows] = await pool.query(
      `SELECT id, user_id, name, username, email, phone, status, created_at, updated_at
       FROM employees
       WHERE id = ? LIMIT 1`,
      [id],
    );

    res.json({
      message: "Employee updated successfully",
      employee: rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// Update employee password
router.patch("/:id/password", async (req, res, next) => {
  try {
    const { id } = req.params;
    const password = String(req.body?.password || "");

    if (!password || password.length < 4) {
      throw buildApiError(400, "Password must be at least 4 characters");
    }

    const [existing] = await pool.query(
      "SELECT id FROM employees WHERE id = ? AND user_id = ? LIMIT 1",
      [id, req.auth.userId],
    );
    if (existing.length === 0) {
      throw buildApiError(404, "Employee not found");
    }

    // Check if employee password matches admin password
    const [adminRows] = await pool.query(
      "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
      [req.auth.userId],
    );
    if (adminRows.length > 0) {
      const matchesAdmin = await comparePassword(password, adminRows[0].password_hash);
      if (matchesAdmin) {
        throw buildApiError(400, "Employee password cannot be the same as admin password");
      }
    }

    const passwordHash = await hashPassword(password);
    await pool.query(
      "UPDATE employees SET password_hash = ? WHERE id = ? AND user_id = ?",
      [passwordHash, id, req.auth.userId],
    );

    res.json({ message: "Employee password updated successfully" });
  } catch (error) {
    next(error);
  }
});

// Toggle employee status
router.patch("/:id/status", async (req, res, next) => {
  try {
    const { id } = req.params;
    const status = req.body?.status === "disabled" ? "disabled" : "active";

    const [existing] = await pool.query(
      "SELECT id FROM employees WHERE id = ? AND user_id = ? LIMIT 1",
      [id, req.auth.userId],
    );
    if (existing.length === 0) {
      throw buildApiError(404, "Employee not found");
    }

    await pool.query(
      "UPDATE employees SET status = ? WHERE id = ? AND user_id = ?",
      [status, id, req.auth.userId],
    );

    res.json({ message: `Employee status changed to ${status}`, status });
  } catch (error) {
    next(error);
  }
});

// Delete an employee
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT id FROM employees WHERE id = ? AND user_id = ? LIMIT 1",
      [id, req.auth.userId],
    );
    if (existing.length === 0) {
      throw buildApiError(404, "Employee not found");
    }

    await pool.query("DELETE FROM employees WHERE id = ? AND user_id = ?", [id, req.auth.userId]);

    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    next(error);
  }
});

export { router as employeesRouter };
