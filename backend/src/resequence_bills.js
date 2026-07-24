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
    const [users] = await db.query("SELECT DISTINCT user_id FROM bills");
    for (const u of users) {
      // Resequence INV bills
      const [invBills] = await db.query(
        "SELECT id FROM bills WHERE user_id = ? AND (number LIKE 'INV-%' OR (number NOT LIKE 'SR-%' AND number NOT LIKE 'PR-%')) ORDER BY created_at ASC",
        [u.user_id]
      );
      for (let i = 0; i < invBills.length; i++) {
        const newNo = `INV-${String(i + 1).padStart(4, "0")}`;
        await db.query("UPDATE bills SET number = ? WHERE id = ?", [newNo, invBills[i].id]);
      }

      // Resequence SR bills
      const [srBills] = await db.query(
        "SELECT id FROM bills WHERE user_id = ? AND number LIKE 'SR-%' ORDER BY created_at ASC",
        [u.user_id]
      );
      for (let j = 0; j < srBills.length; j++) {
        const newNo = `SR-${String(j + 1).padStart(4, "0")}`;
        await db.query("UPDATE bills SET number = ? WHERE id = ?", [newNo, srBills[j].id]);
      }
    }
    console.log("Successfully re-sequenced all bills into separate INV- and SR- series.");
  } catch (e) {
    console.error("Resequence error:", e);
  }

  await db.end();
}

main().catch(console.error);
