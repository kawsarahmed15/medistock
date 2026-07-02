const fs = require("fs");
const mysql = require("mysql2/promise");
const crypto = require("crypto");

function generateId() {
  return crypto.randomUUID();
}

function parseCsvLine(line) {
  const result = [];
  let inQuotes = false;
  let current = "";

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function run() {
  const pool = mysql.createPool({
    host: "127.0.0.1",
    user: "tekl_medistock",
    password: "medistock",
    database: "tekl_medistock",
  });

  const userId = "220a9129-0129-4efc-aa51-4a2096c617a8";
  const data = fs.readFileSync("/home/teklin.in/medistock.teklin.in/CAFOLI_PRODUCTS.csv", "utf8");
  const lines = data.split("\n").filter((l) => l.trim() !== "");

  // Skip header
  const headers = parseCsvLine(lines[0]);

  let count = 0;
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < 9) continue;

    const name = row[1];
    const sku = row[2]; // HSN mapped to SKU for reference
    const packStr = row[3].toUpperCase();
    const qtyStr = row[4];
    const mrpStr = row[6];
    const rateStr = row[7];
    const gstStr = row[8];

    // Determine Packaging
    let baseUnit = "Unit";
    let packUnit = "Pack";
    let conversionFactor = 1;

    if (packStr.includes("X")) {
      const parts = packStr.split("X");
      const firstNum = parseInt(parts[0], 10);
      if (!isNaN(firstNum)) {
        conversionFactor = firstNum;
        baseUnit = "Strip";
        packUnit = "Box";
      }
    } else if (packStr.includes("ML") || packStr.includes("MOL")) {
      baseUnit = "Bottle";
      packUnit = "Bottle";
      conversionFactor = 1;
    } else if (packStr.includes("GM")) {
      baseUnit = "Tube";
      packUnit = "Tube";
      conversionFactor = 1;
    }

    const packPrice = parseFloat(mrpStr) || 0;
    const packCostPrice = parseFloat(rateStr) || 0;

    const price = +(packPrice / conversionFactor).toFixed(2);
    const costPrice = +(packCostPrice / conversionFactor).toFixed(2);

    const packQty = parseFloat(qtyStr) || 0;
    const stock = packQty * conversionFactor;

    const taxPercent = parseFloat(gstStr) || 0;

    // Future date for expiry
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 2);
    const expiryStr = expiry.toISOString().split("T")[0];

    const productId = generateId();

    try {
      await pool.query(
        `INSERT INTO products (id, user_id, name, category, price, cost_price, stock, expiry, sku, tax_percent, base_unit, pack_unit, conversion_factor, pack_price, pack_cost_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productId,
          userId,
          name,
          "General",
          price,
          costPrice,
          stock,
          expiryStr,
          sku,
          taxPercent,
          baseUnit,
          packUnit,
          conversionFactor,
          packPrice,
          packCostPrice,
        ],
      );

      // Also add initial stock to history
      if (stock > 0) {
        await pool.query(
          `INSERT INTO product_history (id, product_id, user_id, action, quantity, balance, notes)
               VALUES (?, ?, ?, 'purchase', ?, ?, ?)`,
          [
            generateId(),
            productId,
            userId,
            stock,
            stock,
            `Initial import (${packQty} ${packUnit}s)`,
          ],
        );
      }

      count++;
    } catch (e) {
      console.error("Error inserting", name, e.message);
    }
  }

  console.log(`Successfully seeded \${count} products with packaging data.`);
  process.exit(0);
}

run();
