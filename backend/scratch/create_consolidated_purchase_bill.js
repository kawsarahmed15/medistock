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
    const email = 'zafarmohammadekbal@gmail.com';
    const [users] = await conn.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    if (users.length === 0) {
      console.log(`User ${email} not found!`);
      return;
    }
    const user = users[0];
    console.log(`Creating purchase bill for User: ${user.name} (${user.email}), ID: ${user.id}`);

    // Get Next PO Number
    const [maxRows] = await conn.query(
      `SELECT MAX(CAST(SUBSTRING_INDEX(number, '-', -1) AS UNSIGNED)) AS maxNo
       FROM purchases
       WHERE user_id = ? AND number LIKE 'PO-%'`,
      [user.id]
    );
    const nextNo = Number(maxRows[0]?.maxNo || 0) + 1;
    const poNo = `PO-${String(nextNo).padStart(4, '0')}`;
    console.log(`Generated Purchase Order Number: ${poNo}`);

    // Fetch all batches for this user
    const [batches] = await conn.query(
      `SELECT b.id as batch_id, b.batch_no, b.expiry_date, b.purchase_price, b.mrp, b.selling_price, b.available_qty, b.sku as batch_sku,
              p.id as product_id, p.name as product_name, p.category, p.pack as product_pack, p.sku as product_sku, p.tax_percent
       FROM product_batches b
       JOIN products p ON b.product_id = p.id
       WHERE p.user_id = ?
       ORDER BY p.name ASC, b.batch_no ASC`,
      [user.id]
    );

    console.log(`Total stock items / batches to cover: ${batches.length}`);

    let subtotal = 0;
    let tax = 0;
    let totalQty = 0;

    const purchaseId = generateId();

    const itemsToInsert = batches.map((b) => {
      const qty = Math.max(0, Number(b.available_qty || 0));
      const costPrice = Number(b.purchase_price || 0);
      const taxPercent = Number(b.tax_percent || 0);
      const lineSubtotal = costPrice * qty;
      const lineTax = lineSubtotal * (taxPercent / 100);

      subtotal += lineSubtotal;
      tax += lineTax;
      totalQty += qty;

      const expiryStr = b.expiry_date ? new Date(b.expiry_date).toISOString().slice(0, 10) : '2028-12-31';

      return {
        id: generateId(),
        purchaseId,
        userId: user.id,
        productId: b.product_id,
        name: b.product_name,
        sku: b.batch_sku || b.product_sku || null,
        qty,
        costPrice,
        taxPercent,
        mrp: Number(b.mrp || 0),
        batch: b.batch_no || 'DEFAULT',
        pack: b.product_pack || null,
        expiry: expiryStr,
        freeQty: 0,
        saleRate: Number(b.selling_price || b.mrp || 0),
      };
    });

    subtotal = Math.round(subtotal * 100) / 100;
    tax = Math.round(tax * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    console.log(`Summary of Consolidated Purchase Bill (${poNo}):`);
    console.log(`- Total Items: ${itemsToInsert.length}`);
    console.log(`- Total Quantity: ${totalQty}`);
    console.log(`- Subtotal: ₹${subtotal.toFixed(2)}`);
    console.log(`- Tax: ₹${tax.toFixed(2)}`);
    console.log(`- Total Amount: ₹${total.toFixed(2)}`);

    const notesMeta = JSON.stringify({
      supplierGst: '06AAMCC0647G1ZR',
      supplierDl: 'WLF20B2024HR001702,WLF21B2024HR001710',
      supplierAddress: 'PLOT NO.367, INDUSTRIAL AREA, PHASE 1 PANCHKULA, HARYANA-134113',
      supplierEmail: '',
      invoiceDate: new Date().toISOString().slice(0, 10),
      purchaseDate: new Date().toISOString().slice(0, 10),
      creditDays: 0,
      dueDate: new Date().toISOString().slice(0, 10),
      transportName: 'CONSOLIDATED LOGISTICS',
      lrNumber: 'PREV-STOCK-LR01',
      remarks: 'Consolidated purchase bill covering all previous inventory stock and batches in a single bill.',
    });

    // Begin transaction
    await conn.beginTransaction();

    // 1. Insert Purchase
    await conn.query(
      `INSERT INTO purchases (id, user_id, number, supplier_name, supplier_phone, supplier_invoice, notes, created_by, payment_status, payment_method, amount_paid, subtotal, tax, discount, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        purchaseId,
        user.id,
        poNo,
        'CAFOLI LIFECARE PVT.LTD.',
        '9518447302',
        'INV-PREV-ALL',
        notesMeta,
        'System',
        'paid',
        'cash',
        total,
        subtotal,
        tax,
        0,
        total,
      ]
    );

    // 2. Insert Purchase Items
    for (const item of itemsToInsert) {
      await conn.query(
        `INSERT INTO purchase_items (id, purchase_id, user_id, product_id, name, sku, qty, cost_price, tax_percent, mrp, batch, pack, expiry, free_qty, sale_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.purchaseId,
          item.userId,
          item.productId,
          item.name,
          item.sku,
          item.qty,
          item.costPrice,
          item.taxPercent,
          item.mrp,
          item.batch,
          item.pack,
          item.expiry,
          item.freeQty,
          item.saleRate,
        ]
      );
    }

    // 3. Update invoice_id for product_batches
    await conn.query(
      `UPDATE product_batches b
       JOIN products p ON b.product_id = p.id
       SET b.invoice_id = ?
       WHERE p.user_id = ? AND b.invoice_id IS NULL`,
      [purchaseId, user.id]
    );

    await conn.commit();
    console.log(`SUCCESS! Purchase Bill ${poNo} created with ID ${purchaseId}`);

  } catch (err) {
    console.error('FAILED to create purchase bill:', err);
    await conn.rollback();
  } finally {
    await conn.end();
  }
}

main();
