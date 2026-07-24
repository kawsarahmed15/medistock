import mysql from "mysql2/promise";
import { config } from "./config.js";

async function main() {
  const db = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
  });

  try {
    const [users] = await db.query("SELECT DISTINCT user_id FROM purchases");
    for (const u of users) {
      // Resequence PO purchases
      const [poPurchases] = await db.query(
        "SELECT id FROM purchases WHERE user_id = ? AND (number LIKE 'PO-%' OR (number NOT LIKE 'PR-%')) ORDER BY created_at ASC",
        [u.user_id]
      );
      for (let i = 0; i < poPurchases.length; i++) {
        const newNo = `PO-${String(i + 1).padStart(4, "0")}`;
        await db.query("UPDATE purchases SET number = ? WHERE id = ?", [newNo, poPurchases[i].id]);
      }

      // Resequence PR purchases
      const [prPurchases] = await db.query(
        "SELECT id FROM purchases WHERE user_id = ? AND number LIKE 'PR-%' ORDER BY created_at ASC",
        [u.user_id]
      );
      for (let j = 0; j < prPurchases.length; j++) {
        const newNo = `PR-${String(j + 1).padStart(4, "0")}`;
        await db.query("UPDATE purchases SET number = ? WHERE id = ?", [newNo, prPurchases[j].id]);
      }
    }
    console.log("Successfully re-sequenced all purchases into separate PO- and PR- series.");
  } catch (e) {
    console.error("Resequence error:", e);
  }

  await db.end();
}

main().catch(console.error);
