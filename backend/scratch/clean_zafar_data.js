import mysql from 'mysql2/promise';
import { config } from '../src/config.js';

async function main() {
  const conn = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
  });

  try {
    const email = 'zafarmohammadekbal@gmail.com';
    const [users] = await conn.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    if (users.length === 0) {
      console.log(`User ${email} not found!`);
      return;
    }
    const user = users[0];
    console.log(`Cleaning all data for User ID: ${user.id}, Email: ${user.email}, Name: ${user.name}`);

    await conn.beginTransaction();

    // 1. Delete bill items
    const [dBillItems] = await conn.query('DELETE FROM bill_items WHERE user_id = ?', [user.id]);
    console.log(`Deleted ${dBillItems.affectedRows} bill items.`);

    // 2. Delete bills
    const [dBills] = await conn.query('DELETE FROM bills WHERE user_id = ?', [user.id]);
    console.log(`Deleted ${dBills.affectedRows} bills.`);

    // 3. Delete purchase items
    const [dPurchaseItems] = await conn.query('DELETE FROM purchase_items WHERE user_id = ?', [user.id]);
    console.log(`Deleted ${dPurchaseItems.affectedRows} purchase items.`);

    // 4. Delete purchases
    const [dPurchases] = await conn.query('DELETE FROM purchases WHERE user_id = ?', [user.id]);
    console.log(`Deleted ${dPurchases.affectedRows} purchases.`);

    // 5. Delete product history
    const [dHistory] = await conn.query('DELETE FROM product_history WHERE user_id = ?', [user.id]);
    console.log(`Deleted ${dHistory.affectedRows} product history entries.`);

    // 6. Delete product batches
    const [dBatches] = await conn.query(
      `DELETE b FROM product_batches b JOIN products p ON b.product_id = p.id WHERE p.user_id = ?`,
      [user.id]
    );
    console.log(`Deleted ${dBatches.affectedRows} product batches.`);

    // 7. Delete products
    const [dProducts] = await conn.query('DELETE FROM products WHERE user_id = ?', [user.id]);
    console.log(`Deleted ${dProducts.affectedRows} products.`);

    // 8. Delete customer payments
    const [dPayments] = await conn.query('DELETE FROM customer_payments WHERE user_id = ?', [user.id]);
    console.log(`Deleted ${dPayments.affectedRows} customer payments.`);

    await conn.commit();
    console.log(`\nSUCCESS! All data for user ${email} has been cleaned successfully.`);

    // Verification check
    const [pCheck] = await conn.query('SELECT COUNT(*) as count FROM products WHERE user_id = ?', [user.id]);
    const [bCheck] = await conn.query('SELECT COUNT(*) as count FROM bills WHERE user_id = ?', [user.id]);
    const [poCheck] = await conn.query('SELECT COUNT(*) as count FROM purchases WHERE user_id = ?', [user.id]);
    const [hCheck] = await conn.query('SELECT COUNT(*) as count FROM product_history WHERE user_id = ?', [user.id]);

    console.log('\n--- VERIFICATION AFTER CLEANUP ---');
    console.log(`Products: ${pCheck[0].count}`);
    console.log(`Bills: ${bCheck[0].count}`);
    console.log(`Purchases: ${poCheck[0].count}`);
    console.log(`History: ${hCheck[0].count}`);

  } catch (err) {
    console.error('FAILED to clean user data:', err);
    await conn.rollback();
  } finally {
    await conn.end();
  }
}

main();
