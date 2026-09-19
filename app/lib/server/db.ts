import crypto from "node:crypto"
import { createClient } from "@libsql/client"

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

export function generateTrackingCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
  const bytes = crypto.randomBytes(8)
  let code = ""
  for (let i = 0; i < 8; i++) code += alphabet[bytes[i] % alphabet.length]
  return code
}

export async function initDb() {
  // Schema bootstrap for first deployment. Heavy migrations should eventually run as a separate deploy step.
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      governorate TEXT NOT NULL,
      area TEXT NOT NULL,
      address TEXT NOT NULL,
      notes TEXT,
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'جديد',
      tracking_code TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      selected_color TEXT,
      selected_size TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      old_price REAL,
      image TEXT NOT NULL,
      images TEXT NOT NULL DEFAULT '[]',
      badge TEXT,
      colors TEXT NOT NULL DEFAULT '[]',
      sizes TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      featured INTEGER NOT NULL DEFAULT 0,
      best_seller INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      size_chart TEXT NOT NULL DEFAULT '{}',
      material_details TEXT NOT NULL DEFAULT '',
      care_instructions TEXT NOT NULL DEFAULT '',
      stock INTEGER NOT NULL DEFAULT 20,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      variant_stock TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'percent',
      value REAL NOT NULL,
      min_order REAL NOT NULL DEFAULT 0,
      max_uses INTEGER NOT NULL DEFAULT 0,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      starts_at TEXT,
      max_discount REAL,
      min_items INTEGER NOT NULL DEFAULT 0,
      product_id INTEGER,
      category TEXT,
      free_shipping INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tracking_code
    ON orders(tracking_code);

    CREATE INDEX IF NOT EXISTS idx_products_active_id
    ON products(active, id DESC);


    CREATE INDEX IF NOT EXISTS idx_order_items_order_id
    ON order_items(order_id);

    CREATE INDEX IF NOT EXISTS idx_orders_phone_id
    ON orders(phone, id DESC);

    CREATE TABLE IF NOT EXISTS product_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      jti TEXT PRIMARY KEY,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      window_start INTEGER NOT NULL,
      count INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      product_id INTEGER,
      path TEXT,
      session_id TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_product_status_id
    ON product_reviews(product_id, status, id DESC);

    CREATE INDEX IF NOT EXISTS idx_reviews_status_id
    ON product_reviews(status, id DESC);

    CREATE INDEX IF NOT EXISTS idx_analytics_created_event
    ON analytics_events(created_at, event_type);

    CREATE INDEX IF NOT EXISTS idx_analytics_product_created
    ON analytics_events(product_id, created_at);
  `)

  // migrate: add new columns to a products table created before this update
  const tableInfo = await db.execute("PRAGMA table_info(products)")
  const existingColumns = new Set(tableInfo.rows.map((row) => row.name))
  const migrations = [
    ["images", "ALTER TABLE products ADD COLUMN images TEXT NOT NULL DEFAULT '[]'"],
    ["size_chart", "ALTER TABLE products ADD COLUMN size_chart TEXT NOT NULL DEFAULT '{}'"],
    ["material_details", "ALTER TABLE products ADD COLUMN material_details TEXT NOT NULL DEFAULT ''"],
    ["care_instructions", "ALTER TABLE products ADD COLUMN care_instructions TEXT NOT NULL DEFAULT ''"],
    ["stock", "ALTER TABLE products ADD COLUMN stock INTEGER NOT NULL DEFAULT 20"],
    ["low_stock_threshold", "ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 5"],
    ["variant_stock", "ALTER TABLE products ADD COLUMN variant_stock TEXT NOT NULL DEFAULT '{}'"],
  ]
  for (const [column, sql] of migrations) {
    if (!existingColumns.has(column)) {
      await db.execute(sql)
    }
  }

  // order pricing history migrations
  const orderInfo = await db.execute("PRAGMA table_info(orders)")
  const orderColumns = new Set(orderInfo.rows.map((row) => row.name))
  const orderMigrations = [
    ["coupon_code", "ALTER TABLE orders ADD COLUMN coupon_code TEXT"],
    ["discount", "ALTER TABLE orders ADD COLUMN discount REAL NOT NULL DEFAULT 0"],
  ]
  for (const [column, sql] of orderMigrations) {
    if (!orderColumns.has(column)) await db.execute(sql)
  }

  const couponInfo = await db.execute("PRAGMA table_info(coupons)")
  const couponColumns = new Set(couponInfo.rows.map((row) => row.name))
  const couponMigrations = [
    ["starts_at", "ALTER TABLE coupons ADD COLUMN starts_at TEXT"],
    ["max_discount", "ALTER TABLE coupons ADD COLUMN max_discount REAL"],
    ["min_items", "ALTER TABLE coupons ADD COLUMN min_items INTEGER NOT NULL DEFAULT 0"],
    ["product_id", "ALTER TABLE coupons ADD COLUMN product_id INTEGER"],
    ["category", "ALTER TABLE coupons ADD COLUMN category TEXT"],
    ["free_shipping", "ALTER TABLE coupons ADD COLUMN free_shipping INTEGER NOT NULL DEFAULT 0"],
  ]
  for (const [column, sql] of couponMigrations) if (!couponColumns.has(column)) await db.execute(sql)

  // seed products
  const productCount = await db.execute("SELECT COUNT(*) AS count FROM products")
  if (productCount.rows[0].count === 0) {
    const seedProducts = [
      {
        slug: "abaya-lulu",
        name: "عباية لؤلؤة",
        category: "عبايات",
        price: 1499,
        old_price: 1799,
        image: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=900",
        badge: "الأكثر مبيعًا",
        colors: '["أسود","بيج"]',
        sizes: '["S","M","L","XL"]',
        description: "عباية أنيقة بتصميم راقٍ وخامة مريحة تناسب إطلالتك اليومية والمناسبات.",
        featured: 1,
        best_seller: 1,
      },
      {
        slug: "abaya-dahab",
        name: "عباية دهب",
        category: "عبايات",
        price: 1699,
        old_price: null,
        image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=900",
        badge: "جديد",
        colors: '["أسود","بني"]',
        sizes: '["M","L","XL","XXL"]',
        description: "تصميم عصري بلمسة فاخرة من دهب.",
        featured: 1,
        best_seller: 0,
      },
      {
        slug: "abaya-nokhba",
        name: "عباية نخبة",
        category: "عبايات",
        price: 1299,
        old_price: 1499,
        image: "https://images.unsplash.com/photo-1585488439659-9d8c3b4f6e8b?w=900",
        badge: "خصم",
        colors: '["أسود"]',
        sizes: '["S","M","L","XL"]',
        description: "عباية عملية وأنيقة بتفاصيل بسيطة وفخمة.",
        featured: 0,
        best_seller: 1,
      },
      {
        slug: "dahab-bag",
        name: "شنطة دهب",
        category: "حقائب",
        price: 799,
        old_price: null,
        image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=900",
        badge: "جديد",
        colors: '["أسود","بيج"]',
        sizes: '[]',
        description: "شنطة أنيقة تكمل إطلالتك من دهب.",
        featured: 1,
        best_seller: 0,
      },
      {
        slug: "dahab-scarf",
        name: "طرحة دهب",
        category: "طرح",
        price: 299,
        old_price: null,
        image: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=900",
        badge: null,
        colors: '["بيج","أسود","أوف وايت"]',
        sizes: '[]',
        description: "طرحة ناعمة وأنيقة بألوان تناسب مختلف الإطلالات.",
        featured: 0,
        best_seller: 0,
      },
      {
        slug: "classic-abaya",
        name: "عباية كلاسيك",
        category: "عبايات",
        price: 1399,
        old_price: null,
        image: "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?w=900",
        badge: null,
        colors: '["أسود","رمادي"]',
        sizes: '["M","L","XL","XXL"]',
        description: "ستايل كلاسيكي مناسب لكل يوم.",
        featured: 0,
        best_seller: 1,
      },

      {
        slug: "abaya-elite",
        name: "عباية إيليت",
        category: "عبايات",
        price: 1899,
        old_price: null,
        image: "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?w=900",
        badge: "حصري",
        colors: '["أسود"]',
        sizes: '["S","M","L","XL"]',
        description: "تصميم فاخر لمحبي الإطلالات الراقية.",
        featured: 1,
        best_seller: 0,
      },
    ]

    for (const p of seedProducts) {
      await db.execute({
        sql: `INSERT INTO products (slug,name,category,price,old_price,image,badge,colors,sizes,description,featured,best_seller)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [p.slug,p.name,p.category,p.price,p.old_price,p.image,p.badge,p.colors,p.sizes,p.description,p.featured,p.best_seller],
      })
    }
  }

  // seed settings
  const settingsCount = await db.execute("SELECT COUNT(*) AS count FROM settings")
  if (settingsCount.rows[0].count === 0) {
    const defaultSettings = {
      hero_image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=2000&q=90",
      hero_image_1: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=2000&q=90",
      hero_image_2: "",
      hero_image_3: "",
      hero_image_4: "",
      hero_image_5: "",
      hero_image_6: "",
      hero_image_7: "",
      hero_image_8: "",
      hero_interval_seconds: "3",
      hero_label: "DAHAB COLLECTION",
      hero_title_line1: "أناقتك...",
      hero_title_line2: "بطابع دهب",
      hero_subtitle: "عبايات مصرية بتصميمات راقية تجمع بين الاحتشام والأناقة وتناسب كل لحظة.",
      hero_button_text: "اكتشفي المجموعة",
      collection_abaya_image: "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=1200&q=90",
      collection_accessories_image: "https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1200&q=90",
      accessories_item1_title: "حقائب",
      accessories_item1_image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=700&q=85",
      accessories_item2_title: "إكسسوارات",
      accessories_item2_image: "https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=700&q=85",
      accessories_item3_title: "طرح",
      accessories_item3_image: "https://images.unsplash.com/photo-1601924928378-6bda4b8c3f1d?auto=format&fit=crop&w=700&q=85",
      accessories_item4_title: "لمسات دهب",
      accessories_item4_image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=700&q=85",
      footer_description: "عبايات مصرية وإكسسوارات مختارة بعناية، لأن أناقتك تستحق الأفضل.",
      announcement_bar: "✦ شحن لجميع المحافظات | الدفع عند الاستلام متاح",
    }
    for (const [key, value] of Object.entries(defaultSettings)) {
      await db.execute({ sql: "INSERT INTO settings (key,value) VALUES (?,?)", args: [key, value] })
    }
  }

  // Remove the retired Story section from existing installations.
  await db.execute({ sql: "DELETE FROM settings WHERE key IN (?,?,?,?)", args: ["story_title_line1", "story_title_line2", "story_body", "story_image"] })

  // Migrate older installations to the multi-image Hero slider settings.
  const legacyHero = await db.execute({ sql: "SELECT value FROM settings WHERE key=?", args: ["hero_image"] })
  const heroDefaults: Record<string, string> = {
    hero_image_1: String((legacyHero.rows[0] as any)?.value || "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=2000&q=90"),
    hero_image_2: "", hero_image_3: "", hero_image_4: "",
    hero_image_5: "", hero_image_6: "", hero_image_7: "", hero_image_8: "",
    hero_interval_seconds: "3",
  }
  for (const [key, value] of Object.entries(heroDefaults)) {
    await db.execute({ sql: "INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)", args: [key, value] })
  }
}


let dbInitPromise: Promise<void> | null = null

export function ensureDb() {
  if (!dbInitPromise) {
    dbInitPromise = initDb().catch((error) => {
      dbInitPromise = null
      throw error
    })
  }
  return dbInitPromise
}
