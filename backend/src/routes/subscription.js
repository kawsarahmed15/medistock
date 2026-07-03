import { Router } from "express";
import { pool } from "../db.js";
import { buildApiError, generateId } from "../utils.js";
import { requireAuth } from "../middleware/auth.js";
import {
  createCashfreeOrder,
  getCashfreeOrderStatus,
  getCashfreeOrderPayments,
  verifyCashfreeWebhookSignature,
} from "../services/cashfree.js";
import { config } from "../config.js";

const router = Router();

// ────────────────────────────────────────────
// GET /subscription/plans — list active plans
// ────────────────────────────────────────────
router.get("/plans", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, description, price, duration_days, trial_days, features, sort_order
       FROM subscription_plans
       WHERE is_active = 1
       ORDER BY sort_order ASC`,
    );

    const plans = rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      price: Number(r.price),
      durationDays: r.duration_days,
      trialDays: r.trial_days,
      features: typeof r.features === "string" ? JSON.parse(r.features) : r.features || [],
      sortOrder: r.sort_order,
    }));

    res.json({ plans });
  } catch (error) {
    next(error);
  }
});

// ────────────────────────────────────────────
// GET /subscription/status — current user's subscription
// ────────────────────────────────────────────
router.get("/status", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth.userId;

    // Get the most recent subscription
    const [rows] = await pool.query(
      `SELECT s.id, s.user_id, s.plan_id, s.status, s.starts_at, s.ends_at, s.trial_ends_at,
              s.cashfree_order_id, s.created_at,
              p.name AS plan_name, p.description AS plan_description, p.price AS plan_price,
              p.duration_days, p.features AS plan_features
       FROM subscriptions s
       JOIN subscription_plans p ON p.id = s.plan_id
       WHERE s.user_id = ?
       ORDER BY s.ends_at DESC
       LIMIT 1`,
      [userId],
    );

    if (rows.length === 0) {
      return res.json({
        subscription: null,
        hasSubscription: false,
        status: "none",
      });
    }

    const sub = rows[0];
    const now = new Date();
    const endsAt = new Date(sub.ends_at);
    const trialEndsAt = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null;

    // Auto-expire if past end date
    if (["active", "trial"].includes(sub.status) && endsAt <= now) {
      await pool.query(`UPDATE subscriptions SET status = 'expired' WHERE id = ?`, [sub.id]);
      sub.status = "expired";
    }

    const daysRemaining = Math.max(0, Math.ceil((endsAt - now) / (1000 * 60 * 60 * 24)));
    const trialDaysRemaining = trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24)))
      : 0;

    res.json({
      subscription: {
        id: sub.id,
        status: sub.status,
        planId: sub.plan_id,
        planName: sub.plan_name,
        planDescription: sub.plan_description,
        planPrice: Number(sub.plan_price),
        planFeatures:
          typeof sub.plan_features === "string"
            ? JSON.parse(sub.plan_features)
            : sub.plan_features || [],
        durationDays: sub.duration_days,
        startsAt: sub.starts_at,
        endsAt: sub.ends_at,
        trialEndsAt: sub.trial_ends_at,
        daysRemaining,
        trialDaysRemaining,
        createdAt: sub.created_at,
      },
      hasSubscription: true,
      status: sub.status,
    });
  } catch (error) {
    next(error);
  }
});

// ────────────────────────────────────────────
// POST /subscription/create-order — create Cashfree order
// ────────────────────────────────────────────
router.post("/create-order", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const { planId } = req.body;

    if (!planId) {
      throw buildApiError(400, "Plan ID is required");
    }

    // Get the plan
    const [planRows] = await pool.query(
      `SELECT id, name, price, duration_days FROM subscription_plans WHERE id = ? AND is_active = 1 LIMIT 1`,
      [planId],
    );

    if (planRows.length === 0) {
      throw buildApiError(404, "Plan not found");
    }

    const plan = planRows[0];

    // Get user details
    const [userRows] = await pool.query(
      `SELECT id, name, email, pharmacy_phone FROM users WHERE id = ? LIMIT 1`,
      [userId],
    );

    if (userRows.length === 0) {
      throw buildApiError(404, "User not found");
    }

    const user = userRows[0];

    // Create a unique order ID
    const orderId = `MEDI_${Date.now()}_${generateId().slice(0, 8)}`;

    // Create Cashfree order
    const cfOrder = await createCashfreeOrder({
      orderId,
      orderAmount: Number(plan.price),
      orderCurrency: "INR",
      customerDetails: {
        customerId: userId.slice(0, 50),
        customerEmail: user.email,
        customerPhone: user.pharmacy_phone || "9999999999",
        customerName: user.name,
      },
      orderMeta: {
        returnUrl: `${config.appBaseUrl}/subscription?order_id={order_id}`,
        notifyUrl: `${config.appBaseUrl}/api/subscription/webhook`,
      },
      orderNote: `MediStock ${plan.name} Plan Subscription`,
    });

    // Create or update subscription record
    const subId = generateId();
    const now = new Date();
    const endsAt = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO subscriptions (id, user_id, plan_id, status, starts_at, ends_at, cashfree_order_id)
       VALUES (?, ?, ?, 'trial', ?, ?, ?)`,
      [subId, userId, plan.id, now, endsAt, orderId],
    );

    // Create payment record
    const paymentId = generateId();
    await pool.query(
      `INSERT INTO subscription_payments (id, user_id, subscription_id, cashfree_order_id, amount, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [paymentId, userId, subId, orderId, Number(plan.price)],
    );

    res.json({
      orderId: cfOrder.orderId,
      paymentSessionId: cfOrder.paymentSessionId,
      subscriptionId: subId,
    });
  } catch (error) {
    if (error.message) {
      return next(buildApiError(400, error.message));
    }
    next(error);
  }
});

// ────────────────────────────────────────────
// POST /subscription/verify-payment — verify after Cashfree checkout
// ────────────────────────────────────────────
router.post("/verify-payment", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const { orderId } = req.body;

    if (!orderId) {
      throw buildApiError(400, "Order ID is required");
    }

    // Get order status from Cashfree
    const orderData = await getCashfreeOrderStatus(orderId);

    if (orderData.order_status !== "PAID") {
      // Update payment record
      await pool.query(
        `UPDATE subscription_payments SET status = 'failed' WHERE cashfree_order_id = ? AND user_id = ?`,
        [orderId, userId],
      );

      return res.json({
        success: false,
        status: orderData.order_status,
        message: `Payment status: ${orderData.order_status}`,
      });
    }

    // Get payment details
    let paymentDetails = null;
    try {
      const payments = await getCashfreeOrderPayments(orderId);
      if (Array.isArray(payments) && payments.length > 0) {
        paymentDetails = payments[0];
      }
    } catch (err) {
      console.warn("Could not fetch payment details:", err.message);
    }

    // Update subscription to active
    const [subRows] = await pool.query(
      `SELECT id, plan_id FROM subscriptions WHERE cashfree_order_id = ? AND user_id = ? LIMIT 1`,
      [orderId, userId],
    );

    if (subRows.length > 0) {
      const sub = subRows[0];

      // Get plan to calculate new end date
      const [planRows] = await pool.query(
        `SELECT duration_days FROM subscription_plans WHERE id = ? LIMIT 1`,
        [sub.plan_id],
      );

      const durationDays = planRows.length > 0 ? planRows[0].duration_days : 30;
      const now = new Date();
      const newEndsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // Expire any other active subscriptions for this user
      await pool.query(
        `UPDATE subscriptions SET status = 'expired'
         WHERE user_id = ? AND id != ? AND status IN ('active', 'trial')`,
        [userId, sub.id],
      );

      // Activate this subscription
      await pool.query(
        `UPDATE subscriptions SET status = 'active', starts_at = ?, ends_at = ? WHERE id = ?`,
        [now, newEndsAt, sub.id],
      );

      // Update payment record
      await pool.query(
        `UPDATE subscription_payments
         SET status = 'paid',
             cashfree_payment_id = ?,
             payment_method = ?,
             cf_payment_details = ?
         WHERE cashfree_order_id = ? AND user_id = ?`,
        [
          paymentDetails?.cf_payment_id || null,
          paymentDetails?.payment_group || null,
          paymentDetails ? JSON.stringify(paymentDetails) : null,
          orderId,
          userId,
        ],
      );
    }

    res.json({
      success: true,
      status: "PAID",
      message: "Subscription activated successfully",
    });
  } catch (error) {
    next(error);
  }
});

// ────────────────────────────────────────────
// POST /subscription/webhook — Cashfree webhook (no auth)
// ────────────────────────────────────────────
router.post("/webhook", async (req, res, next) => {
  try {
    const timestamp = req.headers["x-cashfree-timestamp"];
    const signature = req.headers["x-cashfree-signature"];

    // If signature headers present, verify them
    if (timestamp && signature && config.cashfree.secretKey) {
      const rawBody = JSON.stringify(req.body);
      const isValid = verifyCashfreeWebhookSignature(rawBody, timestamp, signature);
      if (!isValid) {
        console.warn("Invalid Cashfree webhook signature");
        return res.status(400).json({ message: "Invalid signature" });
      }
    }

    const event = req.body;
    const eventType = event?.type;
    const orderData = event?.data?.order;
    const paymentData = event?.data?.payment;

    if (!orderData) {
      return res.json({ received: true });
    }

    const orderId = orderData.order_id;
    const orderStatus = orderData.order_status;

    console.log(`Cashfree webhook: ${eventType} for order ${orderId}, status: ${orderStatus}`);

    if (orderStatus === "PAID") {
      // Find subscription by order ID
      const [subRows] = await pool.query(
        `SELECT s.id, s.user_id, s.plan_id
         FROM subscriptions s
         WHERE s.cashfree_order_id = ?
         LIMIT 1`,
        [orderId],
      );

      if (subRows.length > 0) {
        const sub = subRows[0];

        const [planRows] = await pool.query(
          `SELECT duration_days FROM subscription_plans WHERE id = ? LIMIT 1`,
          [sub.plan_id],
        );

        const durationDays = planRows.length > 0 ? planRows[0].duration_days : 30;
        const now = new Date();
        const newEndsAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

        // Expire other active subs
        await pool.query(
          `UPDATE subscriptions SET status = 'expired'
           WHERE user_id = ? AND id != ? AND status IN ('active', 'trial')`,
          [sub.user_id, sub.id],
        );

        // Activate subscription
        await pool.query(
          `UPDATE subscriptions SET status = 'active', starts_at = ?, ends_at = ? WHERE id = ?`,
          [now, newEndsAt, sub.id],
        );

        // Update payment record
        await pool.query(
          `UPDATE subscription_payments
           SET status = 'paid',
               cashfree_payment_id = ?,
               payment_method = ?,
               cf_payment_details = ?
           WHERE cashfree_order_id = ?`,
          [
            paymentData?.cf_payment_id || null,
            paymentData?.payment_group || null,
            paymentData ? JSON.stringify(paymentData) : null,
            orderId,
          ],
        );
      }
    } else if (["EXPIRED", "CANCELLED", "VOID"].includes(orderStatus)) {
      await pool.query(
        `UPDATE subscription_payments SET status = 'failed' WHERE cashfree_order_id = ?`,
        [orderId],
      );
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.json({ received: true, error: error.message });
  }
});

// ────────────────────────────────────────────
// GET /subscription/payments — payment history
// ────────────────────────────────────────────
router.get("/payments", requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT sp.id, sp.cashfree_order_id, sp.cashfree_payment_id, sp.amount, sp.currency,
              sp.status, sp.payment_method, sp.created_at,
              p.name AS plan_name
       FROM subscription_payments sp
       JOIN subscriptions s ON s.id = sp.subscription_id
       JOIN subscription_plans p ON p.id = s.plan_id
       WHERE sp.user_id = ?
       ORDER BY sp.created_at DESC
       LIMIT 50`,
      [req.auth.userId],
    );

    const payments = rows.map((r) => ({
      id: r.id,
      orderId: r.cashfree_order_id,
      paymentId: r.cashfree_payment_id,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      paymentMethod: r.payment_method,
      planName: r.plan_name,
      createdAt: r.created_at,
    }));

    res.json({ payments });
  } catch (error) {
    next(error);
  }
});

// ────────────────────────────────────────────
// GET /subscription/admin/all — admin list all subscriptions
// ────────────────────────────────────────────
router.get("/admin/all", requireAuth, async (req, res, next) => {
  try {
    // Check admin role
    const [userRows] = await pool.query(
      `SELECT role FROM users WHERE id = ? LIMIT 1`,
      [req.auth.userId],
    );

    if (userRows.length === 0 || userRows[0].role !== "admin") {
      throw buildApiError(403, "Admin access required");
    }

    const [rows] = await pool.query(
      `SELECT s.id, s.user_id, s.status, s.starts_at, s.ends_at, s.trial_ends_at, s.created_at,
              u.name AS user_name, u.email AS user_email,
              p.name AS plan_name, p.price AS plan_price
       FROM subscriptions s
       JOIN users u ON u.id = s.user_id
       JOIN subscription_plans p ON p.id = s.plan_id
       ORDER BY s.created_at DESC
       LIMIT 100`,
    );

    res.json({ subscriptions: rows });
  } catch (error) {
    next(error);
  }
});

export { router as subscriptionRouter };
