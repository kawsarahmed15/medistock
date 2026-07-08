import mysql from 'mysql2/promise';
import { config } from '../src/config.js';
import { generateId } from '../src/utils.js';

async function main() {
  const conn = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
  });

  try {
    const email = 'northeastdrugdistributor@gmail.com';
    
    // 1. Get user details
    const [users] = await conn.query('SELECT id, name, email, role FROM users WHERE email = ? LIMIT 1', [email]);
    if (users.length === 0) {
      console.log(`User ${email} not found in the database.`);
      return;
    }
    
    const user = users[0];
    console.log(`Found user: ID=${user.id}, Name=${user.name}, Current Role=${user.role}`);

    // 2. Update role to 'wholesaler'
    await conn.query('UPDATE users SET role = ? WHERE id = ?', ['wholesaler', user.id]);
    console.log(`Updated user role to 'wholesaler' for ${email}`);

    // 3. Find Wholesaler subscription plan
    const [plans] = await conn.query('SELECT id FROM subscription_plans WHERE name = ? LIMIT 1', ['Wholesaler']);
    let wholesalerPlanId;
    if (plans.length > 0) {
      wholesalerPlanId = plans[0].id;
      console.log(`Found Wholesaler plan ID: ${wholesalerPlanId}`);
    } else {
      // If Wholesaler plan doesn't exist, we run setup_plans logic or create a default one
      console.log("Wholesaler subscription plan not found. Creating one...");
      wholesalerPlanId = generateId();
      await conn.query(
        'INSERT INTO subscription_plans (id, name, description, price, duration_days, trial_days, features, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [wholesalerPlanId, 'Wholesaler', 'For growing medical stores with high volume.', 299.00, 30, 7, JSON.stringify(["Unlimited SKUs", "Up to 5 User Accounts", "Advanced Analytics", "Batch & Expiry Tracking", "Priority 24/7 Support"]), 1, 2]
      );
      console.log(`Created Wholesaler plan with ID: ${wholesalerPlanId}`);
    }

    // 4. Update or create Wholesaler subscription
    const [subs] = await conn.query('SELECT id FROM subscriptions WHERE user_id = ?', [user.id]);
    const now = new Date();
    const endsAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

    if (subs.length > 0) {
      await conn.query(
        "UPDATE subscriptions SET plan_id = ?, status = 'active', ends_at = ? WHERE user_id = ?",
        [wholesalerPlanId, endsAt, user.id]
      );
      console.log("Updated existing subscription to Wholesaler plan.");
    } else {
      const subId = generateId();
      await conn.query(
        "INSERT INTO subscriptions (id, user_id, plan_id, status, starts_at, ends_at) VALUES (?, ?, ?, 'active', ?, ?)",
        [subId, user.id, wholesalerPlanId, now, endsAt]
      );
      console.log("Created new active Wholesaler subscription.");
    }

    // Verification check
    const [updatedUsers] = await conn.query('SELECT role FROM users WHERE id = ?', [user.id]);
    const [updatedSubs] = await conn.query(
      'SELECT s.status, p.name FROM subscriptions s JOIN subscription_plans p ON s.plan_id = p.id WHERE s.user_id = ?',
      [user.id]
    );
    console.log(`Verification: Role = ${updatedUsers[0].role}, Subscription Plan = ${updatedSubs[0]?.name}, Status = ${updatedSubs[0]?.status}`);

  } catch (err) {
    console.error("Error executing database update:", err);
  } finally {
    await conn.end();
  }
}

main();
