// MySQL error-code → friendly message map
const MYSQL_ERRORS = {
  ER_TRUNCATED_WRONG_VALUE: (err) => {
    // e.g. "Incorrect date value: '2045-34-31' for column 'expiry'"
    const m = err.sqlMessage || "";
    const colMatch = m.match(/for column ['`]?(\w+)['`]?/i);
    const valMatch = m.match(/value[:\s]+['"]([^'"]+)['"]/i);
    const col = colMatch ? colMatch[1] : "a field";
    const val = valMatch ? valMatch[1] : "the given value";
    // Human-readable column name map
    const colNames = {
      expiry: "Expiry date",
      tax_percent: "Tax %",
      price: "Selling price",
      cost_price: "Buying price",
      mrp: "MRP",
      stock: "Stock",
      pack_price: "Pack price",
      pack_cost_price: "Pack cost price",
      conversion_factor: "Conversion factor",
    };
    const friendly = colNames[col] || col;
    return `Invalid value "${val}" for ${friendly}. Please check the format and try again.`;
  },
  ER_DATA_TOO_LONG: (err) => {
    const m = err.sqlMessage || "";
    const colMatch = m.match(/column ['`]?(\w+)['`]?/i);
    const col = colMatch ? colMatch[1] : "a field";
    const colNames = {
      name: "Product name",
      category: "Category",
      batch: "Batch",
      manufacturer: "Manufacturer",
      sku: "HSN / SKU",
      pack: "Pack",
      base_unit: "Base unit",
      pack_unit: "Pack unit",
    };
    const limits = {
      name: 255,
      category: 120,
      batch: 120,
      manufacturer: 180,
      sku: 120,
      pack: 50,
      base_unit: 50,
      pack_unit: 50,
    };
    const friendly = colNames[col] || col;
    const limit = limits[col] ? ` (max ${limits[col]} characters)` : "";
    return `${friendly} is too long${limit}. Please shorten it.`;
  },
  ER_WARN_DATA_OUT_OF_RANGE: (err) => {
    const m = err.sqlMessage || "";
    const colMatch = m.match(/column ['`]?(\w+)['`]?/i);
    const col = colMatch ? colMatch[1] : "a field";
    const colNames = {
      tax_percent: "Tax % (max 999.99)",
      price: "Selling price",
      cost_price: "Buying price",
      mrp: "MRP",
      stock: "Stock quantity",
      pack_price: "Pack selling price",
      pack_cost_price: "Pack cost price",
    };
    const friendly = colNames[col] || col;
    return `${friendly} is out of the allowed range. Please enter a valid number.`;
  },
  ER_DUP_ENTRY: () =>
    "A duplicate entry already exists. Please check for duplicates and try again.",
  ER_NO_REFERENCED_ROW_2: () => "A referenced record does not exist.",
  ER_ROW_IS_REFERENCED_2: () =>
    "Cannot delete this record because it is referenced by other data.",
  ER_BAD_NULL_ERROR: (err) => {
    const m = err.sqlMessage || "";
    const colMatch = m.match(/column ['`]?(\w+)['`]?/i);
    const col = colMatch ? colMatch[1] : "a required field";
    const colNames = {
      name: "Product name",
      price: "Selling price",
      expiry: "Expiry date",
      stock: "Stock",
    };
    const friendly = colNames[col] || col;
    return `${friendly} is required and cannot be empty.`;
  },
  ER_ACCESS_DENIED_ERROR: () => "Database access denied. Please contact support.",
  ER_LOCK_WAIT_TIMEOUT: () => "The request timed out due to a database lock. Please try again.",
  ER_PARSE_ERROR: () => "A database query error occurred. Please contact support.",
};

export function notFoundHandler(_req, _res, next) {
  const error = new Error("Not found");
  error.status = 404;
  next(error);
}

export function errorHandler(err, _req, res, _next) {
  // Always log the real error server-side
  if (!err.status || err.status >= 500) {
    console.error("[Error]", err.code || "", err.message, err.sqlMessage || "");
  }

  // Known API errors (built with buildApiError) – expose as-is
  if (err.status && err.status < 500) {
    const body = { message: err.message };
    if (err.code) body.code = err.code;
    return res.status(err.status).json(body);
  }

  // MySQL / DB errors – map to friendly messages
  if (err.code && MYSQL_ERRORS[err.code]) {
    const friendlyMessage =
      typeof MYSQL_ERRORS[err.code] === "function"
        ? MYSQL_ERRORS[err.code](err)
        : MYSQL_ERRORS[err.code];
    return res.status(422).json({
      message: friendlyMessage,
      code: err.code,
    });
  }

  // Unknown MySQL error – expose the sqlMessage in development, generic in prod
  if (err.code && err.code.startsWith("ER_")) {
    const isDev = process.env.NODE_ENV !== "production";
    return res.status(422).json({
      message: isDev
        ? `Database error: ${err.sqlMessage || err.message}`
        : "A database error occurred. Please check your input and try again.",
      code: err.code,
    });
  }

  // Catch-all 500
  res.status(500).json({ message: "Internal server error" });
}
