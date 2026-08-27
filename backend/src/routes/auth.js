import { Router } from "express";
import { pool } from "../db.js";
import {
  buildApiError,
  comparePassword,
  generateId,
  generateToken,
  hashPassword,
  hashToken,
  sanitizeUser,
  signAuthToken,
} from "../utils.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendEmailChangeVerification,
  sendLoginNotificationEmail,
} from "../services/email.js";

const router = Router();

function ensureEmail(value) {
  const email = String(value || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    throw buildApiError(400, "Valid email is required");
  }
  return email;
}

function ensurePassword(value, label = "Password") {
  const password = String(value || "");
  if (password.length < 8) {
    throw buildApiError(400, `${label} must be at least 8 characters`);
  }
  return password;
}

function ensureName(value) {
  const name = String(value || "").trim();
  if (!name) {
    throw buildApiError(400, "Name is required");
  }
  if (name.length > 80) {
    throw buildApiError(400, "Name is too long");
  }
  return name;
}

router.post("/signup", async (req, res, next) => {
  try {
    const name = ensureName(req.body?.name);
    const email = ensureEmail(req.body?.email);
    const password = ensurePassword(req.body?.password);
    const role = req.body?.role === "wholesaler" ? "wholesaler" : "retailer";
    const pharmacyName = String(req.body?.pharmacyName || "").trim() || null;

    const [existing] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (existing.length > 0) {
      throw buildApiError(409, "An account already exists with this email");
    }

    const userId = generateId();
    const passwordHash = await hashPassword(password);
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, is_verified, role, pharmacy_name)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [userId, name, email, passwordHash, role, pharmacyName],
    );

    const token = generateToken();
    const tokenHash = hashToken(token);
    await pool.query(
      `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
      [generateId(), userId, tokenHash],
    );

    // Auto-create trial subscription
    try {
      const [planRows] = await pool.query(
        `SELECT id, trial_days FROM subscription_plans WHERE is_active = 1 ORDER BY sort_order ASC LIMIT 1`,
      );
      if (planRows.length > 0) {
        const plan = planRows[0];
        const trialDays = plan.trial_days || 14;
        const now = new Date();
        const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
        await pool.query(
          `INSERT INTO subscriptions (id, user_id, plan_id, status, starts_at, ends_at, trial_ends_at)
           VALUES (?, ?, ?, 'trial', ?, ?, ?)`,
          [generateId(), userId, plan.id, now, trialEndsAt, trialEndsAt],
        );
      }
    } catch (trialErr) {
      console.warn("Could not create trial subscription:", trialErr.message);
    }

    const verificationUrl = `${config.appBaseUrl}/verify-email?token=${token}`;
    await sendVerificationEmail({ to: email, name, verificationUrl });

    res.status(201).json({
      message: "Account created. Please verify your email before logging in.",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = ensureEmail(req.body?.email);
    const password = String(req.body?.password || "");

    const [rows] = await pool.query(
      `SELECT id, name, email, password_hash, is_verified, created_at, pharmacy_name, pharmacy_phone, pharmacy_address, gst_number, drug_lic_no, bill_color, signature, role, account_status, expiring_days, low_stock_qty, default_tax
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email],
    );
    const user = rows[0];

    if (!user) {
      throw buildApiError(401, "Invalid email or password");
    }

    const ok = await comparePassword(password, user.password_hash);
    if (!ok) {
      throw buildApiError(401, "Invalid email or password");
    }

    if (!user.is_verified) {
      throw buildApiError(403, "Please verify your email before logging in");
    }

    // Register session if provided
    const sessionId = req.body?.sessionId;
    const deviceId = req.body?.deviceId;
    if (sessionId && deviceId) {
      const deviceOs = req.body?.deviceOs || null;
      const deviceBrowser = req.body?.deviceBrowser || null;
      const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

      // Check if session already exists for this user and device
      const [existing] = await pool.query(
        "SELECT id, session_id FROM user_sessions WHERE user_id = ? AND device_id = ? LIMIT 1",
        [user.id, deviceId]
      );

      // Check if user has an admin session
      const [adminSessions] = await pool.query(
        "SELECT id FROM user_sessions WHERE user_id = ? AND is_admin = 1 LIMIT 1",
        [user.id]
      );
      const hasAdmin = adminSessions.length > 0;

      if (existing.length > 0) {
        // Update existing device session record with the new session_id
        await pool.query(
          `UPDATE user_sessions 
           SET session_id = ?, last_active = CURRENT_TIMESTAMP, ip_address = ?, device_os = ?, device_browser = ?
           WHERE id = ?`,
          [sessionId, ipAddress, deviceOs, deviceBrowser, existing[0].id]
        );
      } else {
        const makeAdmin = !hasAdmin ? 1 : 0;
        await pool.query(
          `INSERT INTO user_sessions (id, user_id, session_id, device_id, device_os, device_browser, ip_address, is_admin)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [generateId(), user.id, sessionId, deviceId, deviceOs, deviceBrowser, ipAddress, makeAdmin]
        );

        // Send new login notification email
        await sendLoginNotificationEmail({
          to: user.email,
          name: user.name,
          deviceOs,
          deviceBrowser,
          ipAddress,
        });
      }
    }

    const token = signAuthToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get("/verify-email", async (req, res, next) => {
  try {
    const token = String(req.query?.token || "").trim();
    if (!token) {
      throw buildApiError(400, "Verification token is required");
    }

    const tokenHash = hashToken(token);
    const [rows] = await pool.query(
      `SELECT id, user_id FROM email_verification_tokens
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [tokenHash],
    );
    const row = rows[0];
    if (!row) {
      throw buildApiError(400, "Verification link is invalid or expired");
    }

    await pool.query("UPDATE users SET is_verified = 1 WHERE id = ?", [row.user_id]);
    await pool.query("UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ?", [row.id]);

    res.json({ message: "Email verified successfully" });
  } catch (error) {
    next(error);
  }
});

router.post("/resend-verification", async (req, res, next) => {
  try {
    const email = ensureEmail(req.body?.email);

    const [rows] = await pool.query(
      `SELECT id, name, email, is_verified FROM users WHERE email = ? LIMIT 1`,
      [email],
    );
    const user = rows[0];

    if (!user || user.is_verified) {
      res.json({ message: "If your account is pending verification, a link has been sent." });
      return;
    }

    const token = generateToken();
    await pool.query(
      `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
      [generateId(), user.id, hashToken(token)],
    );

    const verificationUrl = `${config.appBaseUrl}/verify-email?token=${token}`;
    await sendVerificationEmail({ to: user.email, name: user.name, verificationUrl });

    res.json({ message: "Verification email sent" });
  } catch (error) {
    next(error);
  }
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    const email = ensureEmail(req.body?.email);

    const [rows] = await pool.query(`SELECT id, name, email FROM users WHERE email = ? LIMIT 1`, [
      email,
    ]);
    const user = rows[0];

    if (!user) {
      res.json({ message: "If an account exists, a reset link has been sent." });
      return;
    }

    const token = generateToken();
    await pool.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 2 HOUR))`,
      [generateId(), user.id, hashToken(token)],
    );

    const resetUrl = `${config.appBaseUrl}/reset-password?token=${token}`;
    await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });

    res.json({ message: "If an account exists, a reset link has been sent." });
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const token = String(req.body?.token || "").trim();
    if (!token) {
      throw buildApiError(400, "Reset token is required");
    }
    const newPassword = ensurePassword(req.body?.newPassword, "New password");

    const [rows] = await pool.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [hashToken(token)],
    );
    const row = rows[0];

    if (!row) {
      throw buildApiError(400, "Reset link is invalid or expired");
    }

    const passwordHash = await hashPassword(newPassword);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [
      passwordHash,
      row.user_id,
    ]);
    await pool.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?", [row.id]);

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, is_verified, created_at, pharmacy_name, pharmacy_phone, pharmacy_address, gst_number, drug_lic_no, bill_color, signature, role, account_status, expiring_days, low_stock_qty, default_tax FROM users WHERE id = ? LIMIT 1`,
      [req.auth.userId],
    );
    const user = rows[0];
    if (!user) {
      throw buildApiError(401, "Unauthorized");
    }
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.patch("/profile", requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, is_verified, created_at, pharmacy_name, pharmacy_phone, pharmacy_address, gst_number, drug_lic_no, bill_color, signature, role, account_status, expiring_days, low_stock_qty, default_tax FROM users WHERE id = ? LIMIT 1`,
      [req.auth.userId],
    );
    const user = rows[0];
    if (!user) {
      throw buildApiError(401, "Unauthorized");
    }

    const name = req.body.name !== undefined ? ensureName(req.body.name) : user.name;
    const pharmacyName = ensureName(req.body.pharmacyName || user.pharmacy_name);
    const pharmacyPhone =
      req.body.pharmacyPhone !== undefined ? req.body.pharmacyPhone : user.pharmacy_phone;
    const pharmacyAddress =
      req.body.pharmacyAddress !== undefined ? req.body.pharmacyAddress : user.pharmacy_address;
    const gstNumber = req.body.gstNumber !== undefined ? req.body.gstNumber : user.gst_number;
    const drugLicNo = req.body.drugLicNo !== undefined ? req.body.drugLicNo : user.drug_lic_no;
    const billColor = req.body.billColor !== undefined ? req.body.billColor : user.bill_color;
    const signature = req.body.signature !== undefined ? req.body.signature : user.signature;
    const expiryDays =
      req.body.expiryDays !== undefined ? Number(req.body.expiryDays) || 60 : user.expiring_days;
    const lowStockQty =
      req.body.lowStockQty !== undefined ? Number(req.body.lowStockQty) || 10 : user.low_stock_qty;
    const defaultTax =
      req.body.defaultTax !== undefined ? Number(req.body.defaultTax) : user.default_tax;

    await pool.query(
      "UPDATE users SET name = ?, pharmacy_name = ?, pharmacy_phone = ?, pharmacy_address = ?, gst_number = ?, drug_lic_no = ?, bill_color = ?, signature = ?, expiring_days = ?, low_stock_qty = ?, default_tax = ? WHERE id = ?",
      [
        name,
        pharmacyName,
        pharmacyPhone,
        pharmacyAddress,
        gstNumber,
        drugLicNo,
        billColor,
        signature,
        expiryDays,
        lowStockQty,
        defaultTax,
        req.auth.userId,
      ],
    );

    const [updatedRows] = await pool.query(
      `SELECT id, name, email, is_verified, created_at, pharmacy_name, pharmacy_phone, pharmacy_address, gst_number, drug_lic_no, bill_color, signature, role, account_status, expiring_days, low_stock_qty, default_tax FROM users WHERE id = ? LIMIT 1`,
      [req.auth.userId],
    );

    res.json({ user: sanitizeUser(updatedRows[0]) });
  } catch (error) {
    next(error);
  }
});

router.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = ensurePassword(req.body?.newPassword, "New password");

    const [rows] = await pool.query(`SELECT id, password_hash FROM users WHERE id = ? LIMIT 1`, [
      req.auth.userId,
    ]);
    const user = rows[0];
    if (!user) {
      throw buildApiError(401, "Unauthorized");
    }

    const ok = await comparePassword(currentPassword, user.password_hash);
    if (!ok) {
      throw buildApiError(400, "Current password is incorrect");
    }

    const passwordHash = await hashPassword(newPassword);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [
      passwordHash,
      req.auth.userId,
    ]);

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    next(error);
  }
});

router.post("/request-email-change", requireAuth, async (req, res, next) => {
  try {
    const newEmail = ensureEmail(req.body?.newEmail);

    const [existing] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [newEmail]);
    if (existing.length > 0) {
      throw buildApiError(409, "An account already exists with this email");
    }

    const token = generateToken();
    await pool.query(
      `INSERT INTO email_change_tokens (id, user_id, new_email, token_hash, expires_at)
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 2 HOUR))`,
      [generateId(), req.auth.userId, newEmail, hashToken(token)],
    );

    const [rows] = await pool.query(`SELECT name FROM users WHERE id = ? LIMIT 1`, [
      req.auth.userId,
    ]);
    const user = rows[0];

    const verificationUrl = `${config.appBaseUrl}/confirm-email?token=${token}`;
    await sendEmailChangeVerification({ to: newEmail, name: user?.name, verificationUrl });

    res.json({ message: "A confirmation link has been sent to your new email." });
  } catch (error) {
    next(error);
  }
});

router.post("/confirm-email-change", async (req, res, next) => {
  try {
    const token = String(req.body?.token || "").trim();
    if (!token) {
      throw buildApiError(400, "Token is required");
    }

    const [rows] = await pool.query(
      `SELECT id, user_id, new_email FROM email_change_tokens
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [hashToken(token)],
    );
    const row = rows[0];

    if (!row) {
      throw buildApiError(400, "Confirmation link is invalid or expired");
    }

    await pool.query("UPDATE users SET email = ?, is_verified = 1 WHERE id = ?", [
      row.new_email,
      row.user_id,
    ]);
    await pool.query("UPDATE email_change_tokens SET used_at = NOW() WHERE id = ?", [row.id]);

    res.json({ message: "Email changed successfully" });
  } catch (error) {
    next(error);
  }
});

router.post("/session", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const { sessionId, deviceId, deviceOs, deviceBrowser } = req.body;
    if (!sessionId || !deviceId) {
      return res.status(400).json({ error: "sessionId and deviceId are required" });
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

    // Check if session already exists for this user and device
    const [existing] = await pool.query(
      "SELECT id, session_id, is_admin FROM user_sessions WHERE user_id = ? AND device_id = ? LIMIT 1",
      [userId, deviceId]
    );

    // Check if the user has an admin session
    const [adminSessions] = await pool.query(
      "SELECT id FROM user_sessions WHERE user_id = ? AND is_admin = 1 LIMIT 1",
      [userId]
    );
    const hasAdmin = adminSessions.length > 0;
    const makeAdmin = !hasAdmin ? 1 : 0;

    if (existing.length > 0) {
      await pool.query(
        `UPDATE user_sessions 
         SET session_id = ?, last_active = CURRENT_TIMESTAMP, ip_address = ?, device_os = ?, device_browser = ?,
             is_admin = CASE WHEN is_admin = 1 THEN 1 ELSE ? END
         WHERE id = ?`,
        [sessionId, ipAddress, deviceOs || null, deviceBrowser || null, makeAdmin, existing[0].id]
      );
      res.json({ message: "Session updated" });
    } else {
      // Check total sessions count
      const [totalCount] = await pool.query(
        "SELECT COUNT(*) as count FROM user_sessions WHERE user_id = ?",
        [userId]
      );

      // If sessions exist in db, but not this device session -> revoked
      if (totalCount[0].count > 0) {
        return res.status(401).json({ message: "Session has been revoked", revoked: true });
      }

      const id = generateId();
      await pool.query(
        `INSERT INTO user_sessions (id, user_id, session_id, device_id, device_os, device_browser, ip_address, is_admin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, sessionId, deviceId, deviceOs || null, deviceBrowser || null, ipAddress, makeAdmin]
      );
      res.json({ message: "Session registered" });
    }
  } catch (error) {
    next(error);
  }
});

router.get("/sessions", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth.userId;

    // Clean up sessions older than 30 days
    try {
      await pool.query(
        "DELETE FROM user_sessions WHERE last_active < DATE_SUB(NOW(), INTERVAL 30 DAY)"
      );
    } catch (cleanupErr) {
      console.error("Failed to clean up old sessions:", cleanupErr);
    }

    const [rows] = await pool.query(
      `SELECT session_id as sessionId, device_os as deviceOs, device_browser as deviceBrowser, ip_address as ipAddress, is_admin as isAdmin, last_active as lastActive, created_at as createdAt
       FROM user_sessions
       WHERE user_id = ?
       ORDER BY last_active DESC`,
      [userId]
    );

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.delete("/sessions/:sessionId", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const targetSessionId = req.params.sessionId;
    const reqSessionId = req.auth.sessionId;

    if (!reqSessionId) {
      return res.status(400).json({ error: "X-Session-ID header is missing" });
    }

    // Get the requester's session info
    const [reqSessionRows] = await pool.query(
      "SELECT is_admin FROM user_sessions WHERE session_id = ? AND user_id = ? LIMIT 1",
      [reqSessionId, userId]
    );
    const reqSession = reqSessionRows[0];

    const isSelf = targetSessionId === reqSessionId;
    const isAdmin = reqSession && reqSession.is_admin === 1;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: "Only the Admin Device can log out other devices" });
    }

    // Check if target session is the admin session
    const [targetSessionRows] = await pool.query(
      "SELECT is_admin FROM user_sessions WHERE session_id = ? AND user_id = ? LIMIT 1",
      [targetSessionId, userId]
    );
    const targetSession = targetSessionRows[0];

    await pool.query(
      "DELETE FROM user_sessions WHERE user_id = ? AND session_id = ?",
      [userId, targetSessionId]
    );

    // If the deleted session was the admin session, transfer admin rights to another active session
    if (targetSession && targetSession.is_admin === 1) {
      const [remaining] = await pool.query(
        "SELECT session_id FROM user_sessions WHERE user_id = ? ORDER BY last_active DESC LIMIT 1",
        [userId]
      );
      if (remaining.length > 0) {
        await pool.query(
          "UPDATE user_sessions SET is_admin = 1 WHERE session_id = ?",
          [remaining[0].session_id]
        );
      }
    }

    res.json({ message: "Session revoked successfully" });
  } catch (error) {
    next(error);
  }
});

router.post("/sessions/:sessionId/transfer-admin", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const targetSessionId = req.params.sessionId;
    const reqSessionId = req.auth.sessionId;

    if (!reqSessionId) {
      return res.status(400).json({ error: "X-Session-ID header is missing" });
    }

    // Get the requester's session info
    const [reqSessionRows] = await pool.query(
      "SELECT is_admin FROM user_sessions WHERE session_id = ? AND user_id = ? LIMIT 1",
      [reqSessionId, userId]
    );
    const reqSession = reqSessionRows[0];

    const isAdmin = reqSession && reqSession.is_admin === 1;
    if (!isAdmin) {
      return res.status(403).json({ error: "Only the Admin Device can transfer admin rights" });
    }

    // Verify target session exists
    const [targetSessionRows] = await pool.query(
      "SELECT id FROM user_sessions WHERE session_id = ? AND user_id = ? LIMIT 1",
      [targetSessionId, userId]
    );
    if (targetSessionRows.length === 0) {
      return res.status(404).json({ error: "Target session not found" });
    }

    // Transfer admin
    await pool.query(
      "UPDATE user_sessions SET is_admin = 0 WHERE user_id = ?",
      [userId]
    );
    await pool.query(
      "UPDATE user_sessions SET is_admin = 1 WHERE session_id = ?",
      [targetSessionId]
    );

    res.json({ message: "Admin rights transferred successfully" });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
