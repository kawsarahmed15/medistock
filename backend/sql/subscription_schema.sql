-- Subscription system tables for MediStock

DROP TABLE IF EXISTS subscription_payments;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS subscription_plans;

CREATE TABLE IF NOT EXISTS subscription_plans (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  price DECIMAL(12,2) NOT NULL,
  duration_days INT NOT NULL DEFAULT 30,
  trial_days INT NOT NULL DEFAULT 14,
  features JSON NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  plan_id CHAR(36) NOT NULL,
  status ENUM('trial','active','expired','cancelled') NOT NULL DEFAULT 'trial',
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  trial_ends_at DATETIME NULL,
  cashfree_subscription_id VARCHAR(255) NULL,
  cashfree_order_id VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sub_user (user_id),
  INDEX idx_sub_status (status),
  CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscription_payments (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  subscription_id CHAR(36) NOT NULL,
  cashfree_order_id VARCHAR(255) NULL,
  cashfree_payment_id VARCHAR(255) NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(50) NULL,
  cf_payment_details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sp_user (user_id),
  INDEX idx_sp_sub (subscription_id),
  INDEX idx_sp_cf_order (cashfree_order_id),
  CONSTRAINT fk_sp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_sp_sub FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default subscription plans
INSERT INTO subscription_plans (id, name, description, price, duration_days, trial_days, features, is_active, sort_order)
VALUES
  (UUID(), 'Monthly', 'Full access to MediStock for 30 days', 499.00, 30, 14, '["Unlimited products","Unlimited bills","Customer management","Purchase tracking","Revenue reports","Email support"]', 1, 1),
  (UUID(), 'Quarterly', 'Full access to MediStock for 90 days', 1299.00, 90, 14, '["Unlimited products","Unlimited bills","Customer management","Purchase tracking","Revenue reports","Priority support","20% savings"]', 1, 2),
  (UUID(), 'Yearly', 'Full access to MediStock for 365 days', 4499.00, 365, 14, '["Unlimited products","Unlimited bills","Customer management","Purchase tracking","Revenue reports","Priority support","Data export","25% savings"]', 1, 3)
ON DUPLICATE KEY UPDATE id=id;
