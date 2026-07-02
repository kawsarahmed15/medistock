DROP TABLE IF EXISTS purchase_items;
DROP TABLE IF EXISTS purchases;

CREATE TABLE purchases (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  number VARCHAR(50) NOT NULL,
  supplier_name VARCHAR(100),
  supplier_phone VARCHAR(20),
  supplier_invoice VARCHAR(100),
  notes TEXT,
  subtotal DECIMAL(12,2) NOT NULL,
  tax DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'unpaid',
  payment_method VARCHAR(20) DEFAULT 'cash',
  amount_paid DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  UNIQUE KEY idx_purchases_number_user (user_id, number),
  CONSTRAINT fk_purchases_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_items (
  id CHAR(36) PRIMARY KEY,
  purchase_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(50),
  qty INT NOT NULL,
  free_qty INT DEFAULT 0,
  cost_price DECIMAL(12,2) NOT NULL,
  mrp DECIMAL(12,2),
  tax_percent DECIMAL(5,2) DEFAULT 0,
  batch VARCHAR(120),
  expiry DATE,
  pack VARCHAR(50),
  CONSTRAINT fk_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT fk_purchase_items_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
