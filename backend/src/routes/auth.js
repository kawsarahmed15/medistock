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
import { requireAuth, requireAdminOnly } from "../middleware/auth.js";
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
    const rawIdentifier = String(req.body?.email || req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!rawIdentifier) {
      throw buildApiError(400, "Username or Email is required");
    }
    if (!password) {
      throw buildApiError(400, "Password is required");
    }

    let isEmployee = false;
    let employeeMeta = null;
    let ok = false;
    let user = null;

    // 1. Check if identifier matches an Admin email in users table
    const [adminRows] = await pool.query(
      `SELECT id, name, email, password_hash, employee_password_hash, is_employee_enabled, is_verified, created_at, pharmacy_name, pharmacy_phone, pharmacy_address, gst_number, drug_lic_no, bill_color, signature, role, account_status, expiring_days, low_stock_qty, default_tax, admin_device_id
       FROM users
       WHERE LOWER(email) = LOWER(?)
       LIMIT 1`,
      [rawIdentifier],
    );

    if (adminRows.length > 0) {
      user = adminRows[0];
      const isAdminOk = await comparePassword(password, user.password_hash);
      if (isAdminOk) {
        ok = true;
        isEmployee = false;
      }
    }

    // 2. If not logged in as Admin, check if identifier matches an Employee username in employees table
    if (!ok) {
      const [empRows] = await pool.query(
        `SELECT e.id as emp_id, e.user_id, e.name as emp_name, e.username as emp_username, e.email as emp_email, e.password_hash as emp_password_hash, e.status as emp_status,
                u.id, u.name, u.email, u.password_hash, u.employee_password_hash, u.is_employee_enabled, u.is_verified, u.created_at, u.pharmacy_name, u.pharmacy_phone, u.pharmacy_address, u.gst_number, u.drug_lic_no, u.bill_color, u.signature, u.role, u.account_status, u.expiring_days, u.low_stock_qty, u.default_tax, u.admin_device_id
         FROM employees e
         JOIN users u ON e.user_id = u.id
         WHERE LOWER(e.username) = LOWER(?) AND e.status = 'active'
         LIMIT 1`,
        [rawIdentifier],
      );

      if (empRows.length > 0) {
        const isEmpOk = await comparePassword(password, empRows[0].emp_password_hash);
        if (isEmpOk) {
          ok = true;
          isEmployee = true;
          user = empRows[0];
          employeeMeta = {
            employeeId: empRows[0].emp_id,
            employeeName: empRows[0].emp_name,
          };
        }
      }
    }

    // 3. Fallback check for legacy single employee password if admin email was entered
    if (!ok && user && user.employee_password_hash && Number(user.is_employee_enabled ?? 1) === 1) {
      const isLegacyEmpOk = await comparePassword(password, user.employee_password_hash);
      if (isLegacyEmpOk) {
        ok = true;
        isEmployee = true;
        employeeMeta = {
          employeeId: null,
          employeeName: `${user.name} (Staff)`,
        };
      }
    }

    if (!ok || !user) {
      throw buildApiError(401, "Invalid username/email or password");
    }

    if (!user.is_verified) {
      throw buildApiError(403, "Please verify your email before logging in");
    }

    // Register session if provided
    const sessionId = req.body?.sessionId;
    const deviceId = req.body?.deviceId;
    if (sessionId && deviceId) {
      try {
        const cleanSessionId = String(sessionId).trim().substring(0, 50);
        const cleanDeviceId = String(deviceId).trim().substring(0, 50);
        const deviceOs = req.body?.deviceOs ? String(req.body.deviceOs).trim().substring(0, 100) : null;
        const deviceBrowser = req.body?.deviceBrowser ? String(req.body.deviceBrowser).trim().substring(0, 100) : null;
        const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
        const ipAddress = rawIp ? String(rawIp).split(',')[0].trim().substring(0, 45) : null;

        // Assign admin_device_id if not set yet and logging in as admin
        let adminDeviceId = user.admin_device_id;
        if (!adminDeviceId && !isEmployee) {
          await pool.query("UPDATE users SET admin_device_id = ? WHERE id = ?", [cleanDeviceId, user.id]);
          adminDeviceId = cleanDeviceId;
        }

        // Check if session already exists for this user and device
        const [existing] = await pool.query(
          "SELECT id, session_id FROM user_sessions WHERE user_id = ? AND device_id = ? LIMIT 1",
          [user.id, cleanDeviceId]
        );

        const makeAdmin = (!isEmployee && cleanDeviceId === adminDeviceId) ? 1 : 0;

        if (existing.length > 0) {
          await pool.query(
            `UPDATE user_sessions 
             SET session_id = ?, last_active = CURRENT_TIMESTAMP, last_user_activity = CURRENT_TIMESTAMP, ip_address = ?, device_os = ?, device_browser = ?, is_admin = ?, status = 'active'
             WHERE id = ?`,
            [cleanSessionId, ipAddress, deviceOs, deviceBrowser, makeAdmin, existing[0].id]
          );
        } else {
          await pool.query(
            `INSERT INTO user_sessions (id, user_id, session_id, device_id, device_os, device_browser, ip_address, is_admin, last_user_activity, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'active')`,
            [generateId(), user.id, cleanSessionId, cleanDeviceId, deviceOs, deviceBrowser, ipAddress, makeAdmin]
          );

          // Send new login notification email
          try {
            await sendLoginNotificationEmail({
              to: user.email,
              name: isEmployee ? (employeeMeta?.employeeName || `${user.name} (Staff)`) : user.name,
              deviceOs,
              deviceBrowser,
              ipAddress,
            });
          } catch (mailErr) {
            console.warn("Could not send login notification email:", mailErr.message);
          }
        }
      } catch (sessionErr) {
        console.warn("Could not register user session during login:", sessionErr.message);
      }
    }

    const token = signAuthToken(user, isEmployee, employeeMeta);
    res.json({ token, user: sanitizeUser(user, isEmployee, employeeMeta) });
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

    // Check if candidate new admin password matches any employee password
    const [storeEmployees] = await pool.query(
      "SELECT password_hash FROM employees WHERE user_id = ?",
      [row.user_id],
    );
    for (const emp of storeEmployees) {
      const matchesEmp = await comparePassword(newPassword, emp.password_hash);
      if (matchesEmp) {
        throw buildApiError(400, "Admin password cannot be the same as any employee password");
      }
    }
    const [userRows] = await pool.query("SELECT employee_password_hash FROM users WHERE id = ? LIMIT 1", [row.user_id]);
    if (userRows[0]?.employee_password_hash) {
      const matchesLegacyEmp = await comparePassword(newPassword, userRows[0].employee_password_hash);
      if (matchesLegacyEmp) {
        throw buildApiError(400, "Admin password cannot be the same as any employee password");
      }
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
      `SELECT id, name, email, password_hash, employee_password_hash, is_employee_enabled, is_verified, created_at, pharmacy_name, pharmacy_phone, pharmacy_address, gst_number, drug_lic_no, bill_color, signature, role, account_status, expiring_days, low_stock_qty, default_tax FROM users WHERE id = ? LIMIT 1`,
      [req.auth.userId],
    );
    const user = rows[0];
    if (!user) {
      throw buildApiError(401, "Unauthorized");
    }
    const employeeMeta = req.auth.isEmployee
      ? { employeeId: req.auth.employeeId, employeeName: req.auth.employeeName }
      : null;
    res.json({ user: sanitizeUser(user, req.auth.isEmployee, employeeMeta) });
  } catch (error) {
    next(error);
  }
});

router.post("/employee-password", requireAuth, requireAdminOnly, async (req, res, next) => {
  try {
    const password = ensurePassword(req.body?.employeePassword, "Employee password");
    const isEnabled = req.body?.isEnabled !== undefined ? (req.body.isEnabled ? 1 : 0) : 1;

    // Check if candidate employee password matches admin password
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
      "UPDATE users SET employee_password_hash = ?, is_employee_enabled = ? WHERE id = ?",
      [passwordHash, isEnabled, req.auth.userId],
    );

    res.json({
      message: "Employee password updated successfully",
      hasEmployeePassword: true,
      isEmployeeEnabled: Boolean(isEnabled),
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/employee-status", requireAuth, requireAdminOnly, async (req, res, next) => {
  try {
    const isEnabled = req.body?.isEnabled ? 1 : 0;
    await pool.query(
      "UPDATE users SET is_employee_enabled = ? WHERE id = ?",
      [isEnabled, req.auth.userId],
    );
    res.json({
      message: isEnabled ? "Employee access enabled" : "Employee access disabled",
      isEmployeeEnabled: Boolean(isEnabled),
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/employee-password", requireAuth, requireAdminOnly, async (req, res, next) => {
  try {
    await pool.query(
      "UPDATE users SET employee_password_hash = NULL, is_employee_enabled = 0 WHERE id = ?",
      [req.auth.userId],
    );
    res.json({
      message: "Employee password removed",
      hasEmployeePassword: false,
      isEmployeeEnabled: false,
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/profile", requireAuth, requireAdminOnly, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, employee_password_hash, is_employee_enabled, is_verified, created_at, pharmacy_name, pharmacy_phone, pharmacy_address, gst_number, drug_lic_no, bill_color, signature, role, account_status, expiring_days, low_stock_qty, default_tax FROM users WHERE id = ? LIMIT 1`,
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
      `SELECT id, name, email, employee_password_hash, is_employee_enabled, is_verified, created_at, pharmacy_name, pharmacy_phone, pharmacy_address, gst_number, drug_lic_no, bill_color, signature, role, account_status, expiring_days, low_stock_qty, default_tax FROM users WHERE id = ? LIMIT 1`,
      [req.auth.userId],
    );

    res.json({ user: sanitizeUser(updatedRows[0]) });
  } catch (error) {
    next(error);
  }
});

router.post("/change-password", requireAuth, requireAdminOnly, async (req, res, next) => {
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

    // Check if new admin password matches any employee password
    const [storeEmployees] = await pool.query(
      "SELECT password_hash FROM employees WHERE user_id = ?",
      [req.auth.userId],
    );
    for (const emp of storeEmployees) {
      const matchesEmp = await comparePassword(newPassword, emp.password_hash);
      if (matchesEmp) {
        throw buildApiError(400, "Admin password cannot be the same as any employee password");
      }
    }
    const [adminUserRows] = await pool.query("SELECT employee_password_hash FROM users WHERE id = ? LIMIT 1", [req.auth.userId]);
    if (adminUserRows[0]?.employee_password_hash) {
      const matchesLegacyEmp = await comparePassword(newPassword, adminUserRows[0].employee_password_hash);
      if (matchesLegacyEmp) {
        throw buildApiError(400, "Admin password cannot be the same as any employee password");
      }
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

router.post("/request-email-change", requireAuth, requireAdminOnly, async (req, res, next) => {
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
    const { sessionId, deviceId, deviceOs, deviceBrowser, isUserActive } = req.body;
    if (!sessionId || !deviceId) {
      return res.status(400).json({ error: "sessionId and deviceId are required" });
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

    // Get user's admin_device_id
    const [userRows] = await pool.query(
      "SELECT admin_device_id FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    const user = userRows[0];
    let adminDeviceId = user?.admin_device_id;
    if (!adminDeviceId) {
      await pool.query("UPDATE users SET admin_device_id = ? WHERE id = ?", [deviceId, userId]);
      adminDeviceId = deviceId;
    }

    // Check if session already exists for this user and device
    const [existing] = await pool.query(
      "SELECT id, session_id FROM user_sessions WHERE user_id = ? AND device_id = ? LIMIT 1",
      [userId, deviceId]
    );

    const makeAdmin = (deviceId === adminDeviceId) ? 1 : 0;

    if (existing.length > 0) {
      await pool.query(
        `UPDATE user_sessions 
         SET session_id = ?, last_active = CURRENT_TIMESTAMP, 
             last_user_activity = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE last_user_activity END,
             ip_address = ?, device_os = ?, device_browser = ?, is_admin = ?, status = 'active'
         WHERE id = ?`,
        [sessionId, isUserActive ? 1 : 0, ipAddress, deviceOs || null, deviceBrowser || null, makeAdmin, existing[0].id]
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
        `INSERT INTO user_sessions (id, user_id, session_id, device_id, device_os, device_browser, ip_address, is_admin, last_user_activity, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END, 'active')`,
        [id, userId, sessionId, deviceId, deviceOs || null, deviceBrowser || null, ipAddress, makeAdmin, isUserActive ? 1 : 0]
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
      // Clean up logged out sessions older than 3 days
      await pool.query(
        "DELETE FROM user_sessions WHERE status = 'logged_out' AND last_active < DATE_SUB(NOW(), INTERVAL 3 DAY)"
      );
    } catch (cleanupErr) {
      console.error("Failed to clean up old sessions:", cleanupErr);
    }

    const [userRows] = await pool.query(
      "SELECT admin_device_id FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    const user = userRows[0];
    const adminDeviceId = user?.admin_device_id;

    const [rows] = await pool.query(
      `SELECT session_id as sessionId, device_id as deviceId, device_os as deviceOs, device_browser as deviceBrowser, ip_address as ipAddress, status, last_user_activity as lastUserActivity, last_active as lastActive, created_at as createdAt,
              CASE 
                WHEN status = 'active' AND (
                  (last_user_activity IS NOT NULL AND last_user_activity >= DATE_SUB(NOW(), INTERVAL 2 MINUTE)) OR
                  (last_user_activity IS NULL AND last_active >= DATE_SUB(NOW(), INTERVAL 2 MINUTE))
                ) THEN 1 
                ELSE 0 
              END as isDeviceActive
       FROM user_sessions
       WHERE user_id = ?
       ORDER BY last_active DESC`,
      [userId]
    );

    const sessionsWithAdmin = rows.map(r => ({
      ...r,
      isAdmin: (r.deviceId === adminDeviceId) ? 1 : 0
    }));

    res.json(sessionsWithAdmin);
  } catch (error) {
    next(error);
  }
});

router.delete("/sessions/:sessionId", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const targetSessionId = req.params.sessionId;
    const reqSessionId = req.auth.sessionId;
    const reqDeviceId = req.auth.deviceId;

    if (!reqSessionId) {
      return res.status(400).json({ error: "X-Session-ID header is missing" });
    }

    // Get the user's admin_device_id
    const [userRows] = await pool.query(
      "SELECT admin_device_id FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    const user = userRows[0];
    const adminDeviceId = user?.admin_device_id;

    const isSelf = targetSessionId === reqSessionId;
    const isAdmin = reqDeviceId && reqDeviceId === adminDeviceId;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: "Only the Admin Device can log out other devices" });
    }

    const [sessRows] = await pool.query(
      "SELECT status FROM user_sessions WHERE user_id = ? AND session_id = ? LIMIT 1",
      [userId, targetSessionId]
    );

    if (sessRows.length > 0) {
      if (sessRows[0].status === 'logged_out') {
        // If already logged_out, this is a manual "Remove" action. Delete permanently.
        await pool.query(
          "DELETE FROM user_sessions WHERE user_id = ? AND session_id = ?",
          [userId, targetSessionId]
        );
      } else {
        // Mark session as logged_out instead of deleting
        await pool.query(
          "UPDATE user_sessions SET status = 'logged_out', last_active = CURRENT_TIMESTAMP WHERE user_id = ? AND session_id = ?",
          [userId, targetSessionId]
        );
      }
    }

    res.json({ message: "Session updated successfully" });
  } catch (error) {
    next(error);
  }
});

router.post("/sessions/:sessionId/transfer-admin", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const targetSessionId = req.params.sessionId;
    const reqSessionId = req.auth.sessionId;
    const reqDeviceId = req.auth.deviceId;

    if (!reqSessionId) {
      return res.status(400).json({ error: "X-Session-ID header is missing" });
    }

    // Get the user's admin_device_id
    const [userRows] = await pool.query(
      "SELECT admin_device_id FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    const user = userRows[0];
    const adminDeviceId = user?.admin_device_id;

    const isAdmin = reqDeviceId && reqDeviceId === adminDeviceId;
    if (!isAdmin) {
      return res.status(403).json({ error: "Only the Admin Device can transfer admin rights" });
    }

    // Get target session's device info
    const [targetSessionRows] = await pool.query(
      "SELECT device_id FROM user_sessions WHERE session_id = ? AND user_id = ? LIMIT 1",
      [targetSessionId, userId]
    );
    if (targetSessionRows.length === 0) {
      return res.status(404).json({ error: "Target session not found" });
    }
    const targetDeviceId = targetSessionRows[0].device_id;

    // Transfer admin device status persistently in the users table
    await pool.query(
      "UPDATE users SET admin_device_id = ? WHERE id = ?",
      [targetDeviceId, userId]
    );

    // Also update the is_admin column in user_sessions for frontend reactivity if queried
    await pool.query(
      "UPDATE user_sessions SET is_admin = 0 WHERE user_id = ?",
      [userId]
    );
    await pool.query(
      "UPDATE user_sessions SET is_admin = 1 WHERE device_id = ?",
      [targetDeviceId]
    );

    res.json({ message: "Admin rights transferred successfully" });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
