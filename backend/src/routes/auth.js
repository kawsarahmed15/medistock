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
      `SELECT id, name, email, password_hash, is_verified, created_at, pharmacy_name, pharmacy_phone, gst_number, drug_lic_no, bill_color, signature, role, account_status, default_tax
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

export { router as authRouter };
