CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_tokens_user (user_id),
  INDEX idx_email_tokens_hash (token_hash),
  CONSTRAINT fk_email_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pwd_tokens_user (user_id),
  INDEX idx_pwd_tokens_hash (token_hash),
  CONSTRAINT fk_pwd_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(120) NOT NULL DEFAULT 'General',
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(12,2) NULL,
  stock INT NOT NULL DEFAULT 0,
  expiry DATE NOT NULL,
  mrp DECIMAL(12,2) NULL,
  pack VARCHAR(50) NULL,
  batch VARCHAR(120) NULL,
  manufacturer VARCHAR(180) NULL,
  sku VARCHAR(120) NULL,
  prescription TINYINT(1) NOT NULL DEFAULT 0,
  tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_user (user_id),
  CONSTRAINT fk_products_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bills (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  number VARCHAR(50) NOT NULL,
  customer_name VARCHAR(190) NULL,
  customer_phone VARCHAR(50) NULL,
  customer_notes TEXT NULL,
  cashier VARCHAR(120) NULL,
  payment_method ENUM('cash', 'online') NOT NULL DEFAULT 'cash',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_bill_number_per_user (user_id, number),
  INDEX idx_bills_user_created (user_id, created_at),
  CONSTRAINT fk_bills_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bill_items (
  id CHAR(36) PRIMARY KEY,
  bill_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  product_id CHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  cost_price DECIMAL(12,2) NULL,
  qty INT NOT NULL,
  tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  mrp DECIMAL(12,2) NULL,
  pack VARCHAR(50) NULL,
  expiry DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bill_items_bill (bill_id),
  INDEX idx_bill_items_user (user_id),
  CONSTRAINT fk_bill_items_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  CONSTRAINT fk_bill_items_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
