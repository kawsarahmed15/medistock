import { pool } from "../db.js";
import { buildApiError } from "../utils.js";

/**
 * Middleware to require an active or trial subscription.
 * Attaches subscription info to req.subscription.
 * Returns 403 with code SUBSCRIPTION_REQUIRED if no active subscription found.
 */
export async function requireActiveSubscription(req, _res, next) {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return next(buildApiError(401, "Unauthorized"));
    }

    const [rows] = await pool.query(
      `SELECT s.id, s.user_id, s.plan_id, s.status, s.starts_at, s.ends_at, s.trial_ends_at,
              p.name AS plan_name, p.price AS plan_price, p.duration_days
       FROM subscriptions s
       JOIN subscription_plans p ON p.id = s.plan_id
       WHERE s.user_id = ?
         AND s.status IN ('active', 'trial')
         AND s.ends_at > NOW()
       ORDER BY s.ends_at DESC
       LIMIT 1`,
      [userId],
    );

    if (rows.length === 0) {
      // Check if there's an expired subscription
      const [expiredRows] = await pool.query(
        `SELECT s.id, s.status, s.ends_at
         FROM subscriptions s
         WHERE s.user_id = ?
         ORDER BY s.ends_at DESC
         LIMIT 1`,
        [userId],
      );

      // Update status to expired if it was active/trial but now past end date
      if (expiredRows.length > 0 && ["active", "trial"].includes(expiredRows[0].status)) {
        await pool.query(
          `UPDATE subscriptions SET status = 'expired' WHERE id = ?`,
          [expiredRows[0].id],
        );
      }

      const error = buildApiError(403, "Active subscription required");
      error.code = "SUBSCRIPTION_REQUIRED";
      error.subscription = null;
      return next(error);
    }

    const sub = rows[0];
    const now = new Date();
    const endsAt = new Date(sub.ends_at);
    const daysRemaining = Math.max(0, Math.ceil((endsAt - now) / (1000 * 60 * 60 * 24)));

    req.subscription = {
      id: sub.id,
      status: sub.status,
      planName: sub.plan_name,
      planPrice: sub.plan_price,
      daysRemaining,
      endsAt: sub.ends_at,
      trialEndsAt: sub.trial_ends_at,
    };

    next();
  } catch (error) {
    next(error);
  }
}
