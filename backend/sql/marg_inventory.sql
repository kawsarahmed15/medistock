CREATE TABLE IF NOT EXISTS medicines (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  medicine_name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255) NULL,
  company_id VARCHAR(36) NULL,
  category_id VARCHAR(36) NULL,
  hsn_code VARCHAR(50) NULL,
  gst DECIMAL(5,2) NOT NULL DEFAULT 12,
  medicine_type VARCHAR(100) NULL,
  schedule VARCHAR(100) NULL,
  barcode VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_med_name_user (user_id, medicine_name),
  INDEX idx_medicines_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS medicine_batches (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  medicine_id CHAR(36) NOT NULL,
  batch_number VARCHAR(120) NOT NULL,
  expiry_date DATE NOT NULL,
  purchase_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
  mrp DECIMAL(12,2) NOT NULL DEFAULT 0,
  sale_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(5,2) NOT NULL DEFAULT 0,
  rack VARCHAR(120) NULL,
  supplier_id VARCHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_batch_med_user (user_id, medicine_id, batch_number),
  INDEX idx_batches_user (user_id),
  CONSTRAINT fk_batches_med FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stocks (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  batch_id CHAR(36) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  INDEX idx_stocks_user (user_id),
  UNIQUE KEY uniq_stock_batch (batch_id),
  CONSTRAINT fk_stocks_batch FOREIGN KEY (batch_id) REFERENCES medicine_batches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchases (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  supplier_id VARCHAR(36) NOT NULL,
  invoice_no VARCHAR(100) NOT NULL,
  purchase_date DATE NOT NULL,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_purchases_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_items (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  purchase_id CHAR(36) NOT NULL,
  batch_id CHAR(36) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  free_quantity INT NOT NULL DEFAULT 0,
  purchase_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
  mrp DECIMAL(12,2) NOT NULL DEFAULT 0,
  sale_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(5,2) NOT NULL DEFAULT 0,
  gst DECIMAL(5,2) NOT NULL DEFAULT 12,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_purchase_items_user (user_id),
  CONSTRAINT fk_pi_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  CONSTRAINT fk_pi_batch FOREIGN KEY (batch_id) REFERENCES medicine_batches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  customer_id VARCHAR(36) NULL,
  invoice_no VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sales_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sale_items (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  sale_id CHAR(36) NOT NULL,
  batch_id CHAR(36) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  sale_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sale_items_user (user_id),
  CONSTRAINT fk_si_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_si_batch FOREIGN KEY (batch_id) REFERENCES medicine_batches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
