import { pool } from "./db.js";

export async function normalizeCustomerPhones() {
  console.log("Normalizing customer phone numbers to +91 <10-digits>...");
  const [bills] = await pool.query(
    "SELECT id, customer_phone FROM bills WHERE customer_phone IS NOT NULL AND customer_phone != ''"
  );
  let updatedBills = 0;
  for (const b of bills) {
    const raw = (b.customer_phone || "").trim();
    let s = raw.replace(/^(\+91|\+ 91)\s*[-\s]?/, "");
    let digits = s.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith("0")) {
      digits = digits.slice(1);
    }
    digits = digits.slice(0, 10);
    if (digits.length === 10) {
      const formatted = `+91 ${digits}`;
      if (raw !== formatted) {
        await pool.query("UPDATE bills SET customer_phone = ? WHERE id = ?", [formatted, b.id]);
        updatedBills++;
      }
    } else {
      await pool.query("UPDATE bills SET customer_phone = NULL WHERE id = ?", [b.id]);
    }
  }

  const [pays] = await pool.query(
    "SELECT id, customer_phone FROM customer_payments WHERE customer_phone IS NOT NULL AND customer_phone != ''"
  );
  let updatedPays = 0;
  for (const p of pays) {
    const raw = (p.customer_phone || "").trim();
    let s = raw.replace(/^(\+91|\+ 91)\s*[-\s]?/, "");
    let digits = s.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith("0")) {
      digits = digits.slice(1);
    }
    digits = digits.slice(0, 10);
    if (digits.length === 10) {
      const formatted = `+91 ${digits}`;
      if (raw !== formatted) {
        await pool.query("UPDATE customer_payments SET customer_phone = ? WHERE id = ?", [formatted, p.id]);
        updatedPays++;
      }
    } else {
      await pool.query("UPDATE customer_payments SET customer_phone = NULL WHERE id = ?", [p.id]);
    }
  }

  console.log(`Updated ${updatedBills} bills and ${updatedPays} customer payments with +91 format.`);
}

if (process.argv[1]?.endsWith("alter_customer_phone_91.js")) {
  normalizeCustomerPhones()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
