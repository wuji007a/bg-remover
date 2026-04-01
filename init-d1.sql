-- bg-remover D1 数据库初始化脚本
-- 创建日期：2026年3月27日
-- 说明：6张表的初始化 SQL

-- ============================================
-- 1. 用户表（users）
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  total_spent REAL DEFAULT 0,
  status INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- 2. 用户配额表（user_quota）
-- ============================================
CREATE TABLE IF NOT EXISTS user_quota (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  quota_type INTEGER NOT NULL,  -- 1=免费 2=购买
  total INTEGER NOT NULL,
  used INTEGER DEFAULT 0,
  expire_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_quota_user_type ON user_quota(user_id, quota_type, expire_at);
CREATE INDEX IF NOT EXISTS idx_user_quota_expire ON user_quota(expire_at);

-- ============================================
-- 3. 产品表（products）
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  quota_count INTEGER NOT NULL,
  price REAL NOT NULL,
  cost REAL NOT NULL,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化产品数据（ClipDrop超低成本定价）
INSERT OR IGNORE INTO products (id, name, quota_count, price, cost, sort_order) VALUES
(1, '单次购买', 1, 0.50, 0.05, 1),
(2, '10次优惠包', 10, 4.00, 0.50, 2),
(3, '50次超值包', 50, 15.00, 2.50, 3);

CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_sort ON products(sort_order);

-- ============================================
-- 4. 订单表（orders）
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  quota_awarded INTEGER NOT NULL,
  status INTEGER DEFAULT 0,  -- 0=待支付 1=已支付
  payment_method TEXT,
  payment_provider TEXT,  -- paypal, wechat, alipay
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- ============================================
-- 5. 使用记录表（usage_logs）
-- ============================================
CREATE TABLE IF NOT EXISTS usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  quota_id INTEGER,
  image_url TEXT,
  result_url TEXT,
  cost REAL DEFAULT 0.05,
  api_provider TEXT DEFAULT 'clipdrop',  -- clipdrop, remove.bg
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_created ON usage_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_api_provider ON usage_logs(api_provider);

-- ============================================
-- 6. 用量限流表（rate_limits）
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  ip_address TEXT,
  request_count INTEGER DEFAULT 0,
  window_start DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_ip ON rate_limits(user_id, ip_address, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- ============================================
-- 完成
-- ============================================
-- 表创建完成！
-- 可以通过以下命令查看所有表：
-- .tables
-- 
-- 查看表结构：
-- .schema table_name
-- 
-- 查询数据：
-- SELECT * FROM products;
