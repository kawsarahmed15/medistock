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
    console.log(`Targeting ONLY User ID: ${user.id}, Email: ${user.email}, Name: ${user.name}`);

    await conn.beginTransaction();

    // 1. Delete bill items for this user only
    const [dBillItems] = await conn.query('DELETE FROM bill_items WHERE user_id = ?', [user.id]);
    console.log(`Deleted ${dBillItems.affectedRows} bill items for ${email}.`);

    // 2. Delete bills for this user only
    const [dBills] = await conn.query('DELETE FROM bills WHERE user_id = ?', [user.id]);
    console.log(`Deleted ${dBills.affectedRows} bills for ${email}.`);

    // 3. Delete purchase items for this user only
    const [dPurchaseItems] = await conn.query('DELETE FROM purchase_items WHERE user_id = ?', [user.id]);
    console.log(`Deleted ${dPurchaseItems.affectedRows} purchase items for ${email}.`);

    // 4. Delete purchases for this user only
    const [dPurchases] = await conn.query('DELETE FROM purchases WHERE user_id = ?', [user.id]);
    console.log(`Deleted ${dPurchases.affectedRows} purchases for ${email}.`);

    // 5. Delete product history for this user only
    const [dHistory] = await conn.query('DELETE FROM product_history WHERE user_id = ?', [user.id]);
    console.log(`Deleted ${dHistory.affectedRows} product history entries for ${email}.`);

    // 6. Delete product batches for products of this user only
    const [dBatches] = await conn.query(
      `DELETE b FROM product_batches b JOIN products p ON b.product_id = p.id WHERE p.user_id = ?`,
      [user.id]
    );
    console.log(`Deleted ${dBatches.affectedRows} product batches for ${email}.`);

    // 7. Delete products for this user only
    const [dProducts] = await conn.query('DELETE FROM products WHERE user_id = ?', [user.id]);
    console.log(`Deleted ${dProducts.affectedRows} products for ${email}.`);

    // 8. Delete customer payments for this user only
    const [dPayments] = await conn.query('DELETE FROM customer_payments WHERE user_id = ?', [user.id]);
    console.log(`Deleted ${dPayments.affectedRows} customer payments for ${email}.`);

    await conn.commit();
    console.log(`\nSUCCESS: Operational data for user ${email} deleted successfully.`);

    // Verification check
    const [pCheck] = await conn.query('SELECT COUNT(*) as count FROM products WHERE user_id = ?', [user.id]);
    const [bCheck] = await conn.query('SELECT COUNT(*) as count FROM bills WHERE user_id = ?', [user.id]);
    const [poCheck] = await conn.query('SELECT COUNT(*) as count FROM purchases WHERE user_id = ?', [user.id]);
    const [hCheck] = await conn.query('SELECT COUNT(*) as count FROM product_history WHERE user_id = ?', [user.id]);

    console.log('\n--- VERIFICATION FOR zafarmohammadekbal@gmail.com ---');
    console.log(`Products remaining: ${pCheck[0].count}`);
    console.log(`Bills remaining: ${bCheck[0].count}`);
    console.log(`Purchases remaining: ${poCheck[0].count}`);
    console.log(`Product History remaining: ${hCheck[0].count}`);

    // Verify other users data is intact
    const [otherProducts] = await conn.query('SELECT COUNT(*) as count FROM products WHERE user_id != ?', [user.id]);
    console.log(`Products of other users intact: ${otherProducts[0].count}`);

  } catch (err) {
    console.error('FAILED to delete user data:', err);
    await conn.rollback();
  } finally {
    await conn.end();
  }
}

main();
