-- ============================================================
-- L'Oro del Nilo — Supabase Schema
-- Luxury dried fruits e-commerce platform (IT/EU market)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_en     TEXT NOT NULL,
  name_it     TEXT NOT NULL,
  name_ar     TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  image       TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id      UUID REFERENCES categories(id) ON DELETE SET NULL,
  name_en          TEXT NOT NULL,
  name_it          TEXT NOT NULL,
  name_ar          TEXT NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  description_en   TEXT,
  description_it   TEXT,
  description_ar   TEXT,
  price            NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  sale_price       NUMERIC(10,2) CHECK (sale_price >= 0),
  stock            INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  weight_grams     INT,                        -- product weight in grams
  sku              TEXT UNIQUE,
  featured         BOOLEAN DEFAULT FALSE,
  best_seller      BOOLEAN DEFAULT FALSE,
  is_active        BOOLEAN DEFAULT TRUE,
  main_image       TEXT,                        -- Cloudinary URL
  gallery          TEXT[] DEFAULT '{}',         -- array of Cloudinary URLs
  seo_title        TEXT,
  seo_description  TEXT,
  meta_keywords    TEXT[],
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  phone         TEXT,
  date_of_birth DATE,
  is_active     BOOLEAN DEFAULT TRUE,
  notes         TEXT,                           -- admin notes
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ADDRESSES
-- ============================================================
CREATE TABLE addresses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label         TEXT DEFAULT 'Home',           -- e.g. Home, Work, Other
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  street        TEXT NOT NULL,
  city          TEXT NOT NULL,
  state         TEXT,
  postal_code   TEXT NOT NULL,
  country       TEXT NOT NULL DEFAULT 'IT',    -- ISO 3166-1 alpha-2
  phone         TEXT,
  is_default    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COUPONS
-- ============================================================
CREATE TABLE coupons (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code              TEXT UNIQUE NOT NULL,
  description       TEXT,
  discount_type     TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value    NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  minimum_order     NUMERIC(10,2) DEFAULT 0,
  usage_limit       INT,                        -- NULL = unlimited
  used_count        INT DEFAULT 0,
  is_active         BOOLEAN DEFAULT TRUE,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number      TEXT UNIQUE NOT NULL,       -- human-readable e.g. ORO-2024-0001
  customer_id       UUID REFERENCES customers(id) ON DELETE SET NULL,
  coupon_id         UUID REFERENCES coupons(id) ON DELETE SET NULL,

  -- Pricing
  subtotal          NUMERIC(10,2) NOT NULL,
  discount_amount   NUMERIC(10,2) DEFAULT 0,
  shipping_cost     NUMERIC(10,2) DEFAULT 0,
  tax_amount        NUMERIC(10,2) DEFAULT 0,
  total             NUMERIC(10,2) NOT NULL,

  -- Status
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled','refunded')),
  payment_status    TEXT NOT NULL DEFAULT 'unpaid'
                      CHECK (payment_status IN ('unpaid','paid','partially_refunded','refunded')),
  payment_method    TEXT,                       -- stripe, paypal, etc.
  payment_intent_id TEXT,                       -- Stripe payment intent

  -- Shipping address (snapshot at order time)
  shipping_first_name  TEXT,
  shipping_last_name   TEXT,
  shipping_street      TEXT,
  shipping_city        TEXT,
  shipping_state       TEXT,
  shipping_postal_code TEXT,
  shipping_country     TEXT,
  shipping_phone       TEXT,

  -- Tracking
  tracking_number   TEXT,
  shipped_at        TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,

  notes             TEXT,                       -- customer notes
  admin_notes       TEXT,                       -- internal notes
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,

  -- Snapshot of product data at time of purchase
  product_name  TEXT NOT NULL,
  product_sku   TEXT,
  unit_price    NUMERIC(10,2) NOT NULL,
  quantity      INT NOT NULL CHECK (quantity > 0),
  total_price   NUMERIC(10,2) NOT NULL,
  image_url     TEXT,

  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TESTIMONIALS
-- ============================================================
CREATE TABLE testimonials (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_name TEXT NOT NULL,
  customer_city TEXT,
  country       TEXT DEFAULT 'IT',
  rating        SMALLINT CHECK (rating BETWEEN 1 AND 5),
  content_en    TEXT,
  content_it    TEXT,
  content_ar    TEXT,
  is_approved   BOOLEAN DEFAULT FALSE,
  is_featured   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FAQ
-- ============================================================
CREATE TABLE faq (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_en   TEXT NOT NULL,
  question_it   TEXT NOT NULL,
  question_ar   TEXT NOT NULL,
  answer_en     TEXT NOT NULL,
  answer_it     TEXT NOT NULL,
  answer_ar     TEXT NOT NULL,
  category      TEXT DEFAULT 'general',         -- general, shipping, payment, etc.
  sort_order    INT DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NEWSLETTER SUBSCRIBERS
-- ============================================================
CREATE TABLE newsletter_subscribers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  first_name    TEXT,
  language      TEXT DEFAULT 'it' CHECK (language IN ('en','it','ar')),
  source        TEXT DEFAULT 'website',         -- website, popup, checkout
  is_active     BOOLEAN DEFAULT TRUE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

-- ============================================================
-- SETTINGS (key-value store for site configuration)
-- ============================================================
CREATE TABLE settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT UNIQUE NOT NULL,
  value       JSONB,                            -- flexible value type
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Default settings
INSERT INTO settings (key, value, description) VALUES
  ('site_name',           '"L''Oro del Nilo"',                  'Website display name'),
  ('contact_email',       '"info@lorodelnilo.it"',              'Main contact email'),
  ('contact_phone',       '"+39 000 000 0000"',                 'Contact phone number'),
  ('shipping_free_above', '50',                                  'Free shipping threshold in EUR'),
  ('shipping_base_cost',  '5.90',                               'Base shipping cost in EUR'),
  ('tax_rate',            '0.22',                               'VAT rate (22% Italy)'),
  ('currency',            '"EUR"',                              'Store currency'),
  ('maintenance_mode',    'false',                              'Enable maintenance mode'),
  ('social_instagram',    '""',                                 'Instagram profile URL'),
  ('social_facebook',     '""',                                 'Facebook page URL');

-- ============================================================
-- INDEXES (performance)
-- ============================================================
CREATE INDEX idx_products_category    ON products(category_id);
CREATE INDEX idx_products_slug        ON products(slug);
CREATE INDEX idx_products_active      ON products(is_active);
CREATE INDEX idx_products_featured    ON products(featured);
CREATE INDEX idx_orders_customer      ON orders(customer_id);
CREATE INDEX idx_orders_status        ON orders(status);
CREATE INDEX idx_orders_number        ON orders(order_number);
CREATE INDEX idx_order_items_order    ON order_items(order_id);
CREATE INDEX idx_addresses_customer   ON addresses(customer_id);
CREATE INDEX idx_newsletter_email     ON newsletter_subscribers(email);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_faq_updated_at
  BEFORE UPDATE ON faq
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — enable for production
-- ============================================================
ALTER TABLE products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons               ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials          ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings              ENABLE ROW LEVEL SECURITY;

-- Public read access for storefront tables
CREATE POLICY "Public read products"    ON products    FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public read categories"  ON categories  FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public read faq"         ON faq         FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public read testimonials" ON testimonials FOR SELECT USING (is_approved = TRUE);

-- Service role has full access (used by API routes via service key)
CREATE POLICY "Service full access products"    ON products    USING (auth.role() = 'service_role');
CREATE POLICY "Service full access categories"  ON categories  USING (auth.role() = 'service_role');
CREATE POLICY "Service full access orders"      ON orders      USING (auth.role() = 'service_role');
CREATE POLICY "Service full access order_items" ON order_items USING (auth.role() = 'service_role');
CREATE POLICY "Service full access customers"   ON customers   USING (auth.role() = 'service_role');
CREATE POLICY "Service full access addresses"   ON addresses   USING (auth.role() = 'service_role');
CREATE POLICY "Service full access coupons"     ON coupons     USING (auth.role() = 'service_role');
CREATE POLICY "Service full access testimonials" ON testimonials USING (auth.role() = 'service_role');
CREATE POLICY "Service full access faq"         ON faq         USING (auth.role() = 'service_role');
CREATE POLICY "Service full access newsletter"  ON newsletter_subscribers USING (auth.role() = 'service_role');
CREATE POLICY "Service full access settings"    ON settings    USING (auth.role() = 'service_role');
