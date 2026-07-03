import mysql from 'mysql2/promise';
import { config } from './src/config.js';
import { generateId } from './src/utils.js';

async function main() {
  const conn = await mysql.createConnection({
    host: config.mysql.host,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
  });

  try {
    // 1. Clear old plans
    await conn.query('DELETE FROM subscription_plans');

    // 2. Insert new plans matching landing page
    const retailerId = generateId();
    const wholesalerId = generateId();
    const enterpriseId = generateId();

    const plans = [
      [retailerId, 'Retailer', 'Perfect for single small pharmacies getting started.', 149.00, 30, 14, JSON.stringify(["Up to 5,000 SKUs", "1 User Account", "Basic Billing", "Standard Support"]), 1, 1],
      [wholesalerId, 'Wholesaler', 'For growing medical stores with high volume.', 299.00, 30, 7, JSON.stringify(["Unlimited SKUs", "Up to 5 User Accounts", "Advanced Analytics", "Batch & Expiry Tracking", "Priority 24/7 Support"]), 1, 2],
      [enterpriseId, 'Enterprise', 'Multi-store chains requiring maximum control.', 599.00, 30, 14, JSON.stringify(["Unlimited Everything", "Custom Integrations", "Dedicated Account Manager", "API Access", "99.9% Uptime SLA"]), 1, 3]
    ];

    for (const p of plans) {
      await conn.query(
        'INSERT INTO subscription_plans (id, name, description, price, duration_days, trial_days, features, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        p
      );
    }
    console.log("Subscription plans updated to match landing page.");

    // 3. Find user and subscribe them to Wholesaler plan
    const [users] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', ['northeastdrugdistributor@gmail.com']);
    if (users.length > 0) {
      const userId = users[0].id;
      
      // Check if they already have a subscription and update or create
      const [subs] = await conn.query('SELECT id FROM subscriptions WHERE user_id = ?', [userId]);
      
      const now = new Date();
      const endsAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
      
      if (subs.length > 0) {
        // Update existing
        await conn.query(
          "UPDATE subscriptions SET plan_id = ?, status = 'active', ends_at = ? WHERE user_id = ?",
          [wholesalerId, endsAt, userId]
        );
        console.log("Updated existing subscription for user.");
      } else {
        // Create new
        const subId = generateId();
        await conn.query(
          "INSERT INTO subscriptions (id, user_id, plan_id, status, starts_at, ends_at) VALUES (?, ?, ?, 'active', ?, ?)",
          [subId, userId, wholesalerId, now, endsAt]
        );
        console.log("Created new active Wholesaler subscription for user.");
      }
    } else {
      console.log("User northeastdrugdistributor@gmail.com not found in the database.");
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await conn.end();
  }
}

main();
