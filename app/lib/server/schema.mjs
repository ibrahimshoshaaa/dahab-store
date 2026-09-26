// Single source of truth for the database schema.
// Used by scripts/migrate.mjs (real Turso DB) and by tests (local file DB),
// so tests always run against the exact same schema the app expects in
// production. If you add a column here, both places pick it up automatically.

export const createTablesSql = `
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_name TEXT NOT NULL, phone TEXT NOT NULL,
  governorate TEXT NOT NULL, area TEXT NOT NULL, address TEXT NOT NULL, notes TEXT,
  total REAL NOT NULL, status TEXT NOT NULL DEFAULT 'جديد', tracking_code TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL, price REAL NOT NULL, quantity INTEGER NOT NULL,
  selected_color TEXT, selected_size TEXT, FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  category TEXT NOT NULL, price REAL NOT NULL, old_price REAL, image TEXT NOT NULL,
  images TEXT NOT NULL DEFAULT '[]', badge TEXT, colors TEXT NOT NULL DEFAULT '[]',
  sizes TEXT NOT NULL DEFAULT '[]', description TEXT NOT NULL DEFAULT '', featured INTEGER NOT NULL DEFAULT 0,
  best_seller INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
  size_chart TEXT NOT NULL DEFAULT '{}', material_details TEXT NOT NULL DEFAULT '',
  care_instructions TEXT NOT NULL DEFAULT '', stock INTEGER NOT NULL DEFAULT 20,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5, variant_stock TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL,
  message TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, type TEXT NOT NULL DEFAULT 'percent',
  value REAL NOT NULL, min_order REAL NOT NULL DEFAULT 0, max_uses INTEGER NOT NULL DEFAULT 0,
  used_count INTEGER NOT NULL DEFAULT 0, expires_at TEXT, starts_at TEXT, max_discount REAL,
  min_items INTEGER NOT NULL DEFAULT 0, product_id INTEGER, category TEXT,
  free_shipping INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS product_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, customer_name TEXT NOT NULL,
  rating INTEGER NOT NULL, comment TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  jti TEXT PRIMARY KEY, expires_at TEXT NOT NULL, revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, product_id INTEGER,
  path TEXT, session_id TEXT, metadata TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tracking_code ON orders(tracking_code);
CREATE INDEX IF NOT EXISTS idx_products_active_id ON products(active, id DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_phone_id ON orders(phone, id DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_product_status_id ON product_reviews(product_id, status, id DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_status_id ON product_reviews(status, id DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_created_event ON analytics_events(created_at, event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_product_created ON analytics_events(product_id, created_at);
`

export const columnMigrations = {
  products: [
    ["images", "ALTER TABLE products ADD COLUMN images TEXT NOT NULL DEFAULT '[]'"],
    ["size_chart", "ALTER TABLE products ADD COLUMN size_chart TEXT NOT NULL DEFAULT '{}'"],
    ["material_details", "ALTER TABLE products ADD COLUMN material_details TEXT NOT NULL DEFAULT ''"],
    ["care_instructions", "ALTER TABLE products ADD COLUMN care_instructions TEXT NOT NULL DEFAULT ''"],
    ["stock", "ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 20"],
    ["low_stock_threshold", "ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 5"],
    ["variant_stock", "ALTER TABLE products ADD COLUMN variant_stock TEXT NOT NULL DEFAULT '{}'"],
  ],
  orders: [
    ["idempotency_key", "ALTER TABLE orders ADD COLUMN idempotency_key TEXT"],
    ["coupon_code", "ALTER TABLE orders ADD COLUMN coupon_code TEXT"],
    ["discount", "ALTER TABLE orders ADD COLUMN discount REAL NOT NULL DEFAULT 0"],
  ],
  coupons: [
    ["starts_at", "ALTER TABLE coupons ADD COLUMN starts_at TEXT"],
    ["max_discount", "ALTER TABLE coupons ADD COLUMN max_discount REAL"],
    ["min_items", "ALTER TABLE coupons ADD COLUMN min_items INTEGER NOT NULL DEFAULT 0"],
    ["product_id", "ALTER TABLE coupons ADD COLUMN product_id INTEGER"],
    ["category", "ALTER TABLE coupons ADD COLUMN category TEXT"],
    ["free_shipping", "ALTER TABLE coupons ADD COLUMN free_shipping INTEGER NOT NULL DEFAULT 0"],
  ],
}

export async function applyColumnMigrations(db) {
  for (const [table, columns] of Object.entries(columnMigrations)) {
    const info = await db.execute(`PRAGMA table_info(${table})`)
    const existing = new Set(info.rows.map((row) => String(row.name)))
    for (const [name, sql] of columns) if (!existing.has(name)) await db.execute(sql)
  }
  await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL")
}

export async function createSchema(db) {
  await db.executeMultiple(createTablesSql)
  await applyColumnMigrations(db)
}
