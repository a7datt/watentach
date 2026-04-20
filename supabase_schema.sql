-- ============================================================
-- Watentach POS - Supabase SQL Schema
-- ============================================================
-- تشغيل هذا الملف في Supabase SQL Editor

-- ==============================
-- 1. جدول المنتجات
-- ==============================
CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY DEFAULT ('prod_' || gen_random_uuid()::text),
  name        TEXT NOT NULL,
  barcode     TEXT NOT NULL,
  cost_usd    NUMERIC(10, 4) NOT NULL DEFAULT 0,
  price_usd   NUMERIC(10, 4) NOT NULL DEFAULT 0,
  quantity    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================
-- 2. جدول الفواتير (Transactions)
-- ==============================
CREATE TABLE IF NOT EXISTS transactions (
  id                    TEXT PRIMARY KEY DEFAULT ('txn_' || gen_random_uuid()::text),
  invoice_number        TEXT NOT NULL,
  timestamp             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_usd             NUMERIC(10, 4) NOT NULL DEFAULT 0,
  total_syp             NUMERIC(14, 2) NOT NULL DEFAULT 0,
  profit_usd            NUMERIC(10, 4) NOT NULL DEFAULT 0,
  profit_syp            NUMERIC(14, 2) NOT NULL DEFAULT 0,
  exchange_rate_at_sale NUMERIC(10, 2) NOT NULL DEFAULT 1600
);

-- ==============================
-- 3. جدول بنود الفاتورة
-- ==============================
CREATE TABLE IF NOT EXISTS transaction_items (
  id            BIGSERIAL PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id    TEXT NOT NULL,
  name          TEXT NOT NULL,
  qty           INTEGER NOT NULL DEFAULT 1,
  cost_usd      NUMERIC(10, 4) NOT NULL DEFAULT 0,
  price_usd     NUMERIC(10, 4) NOT NULL DEFAULT 0,
  price_syp     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  subtotal_syp  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  subtotal_usd  NUMERIC(10, 4) NOT NULL DEFAULT 0
);

-- ==============================
-- 4. جدول الإعدادات
-- ==============================
CREATE TABLE IF NOT EXISTS settings (
  id                      INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- صف واحد فقط
  exchange_rate           NUMERIC(10, 2) NOT NULL DEFAULT 1600,
  exchange_rate_updated   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_name            TEXT NOT NULL DEFAULT 'وتين تك'
);

-- إدخال الإعدادات الافتراضية إن لم تكن موجودة
INSERT INTO settings (id, exchange_rate, company_name, exchange_rate_updated)
VALUES (1, 1600, 'وتين تك', NOW())
ON CONFLICT (id) DO NOTHING;

-- ==============================
-- 5. بيانات أولية تجريبية (اختياري)
-- ==============================
INSERT INTO products (id, name, barcode, cost_usd, price_usd, quantity)
VALUES
  ('prod_1', 'كولا 330ml',    '5000112637939', 0.30, 0.50, 50),
  ('prod_2', 'شيبس ليز',      '4890008100309', 0.20, 0.40, 30),
  ('prod_3', 'مياه معدنية',   '6281006531229', 0.10, 0.20, 100)
ON CONFLICT (id) DO NOTHING;

-- ==============================
-- 6. RLS (Row Level Security) - اختياري
-- ==============================
-- إذا أردت تفعيل RLS افعل ذلك بعد إعداد Auth
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- للتطوير: السماح لجميع العمليات عبر anon key
-- (يُنصح بتقييدها في الإنتاج)
CREATE POLICY "allow_all_products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_items" ON transaction_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_settings" ON settings FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- التحديثات الجديدة - نظام الصندوقين + دفتر الدين
-- ============================================================

-- أضف عمودَي الصندوق لجدول transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cash_syp NUMERIC DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS cash_usd NUMERIC DEFAULT 0;

-- أضف عمود العملة لجدول transaction_items
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'SYP' CHECK (currency IN ('SYP', 'USD'));

-- جدول سحوبات الصندوق
CREATE TABLE IF NOT EXISTS cash_box_withdrawals (
  id TEXT PRIMARY KEY,
  currency TEXT NOT NULL CHECK (currency IN ('SYP', 'USD')),
  amount NUMERIC NOT NULL,
  note TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- جدول سجلات الديون
CREATE TABLE IF NOT EXISTS debt_records (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  note TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  items JSONB NOT NULL DEFAULT '[]',
  total_syp NUMERIC DEFAULT 0,
  total_usd NUMERIC DEFAULT 0,
  paid_syp NUMERIC DEFAULT 0,
  paid_usd NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid'))
);

-- RLS policies للجداول الجديدة
ALTER TABLE cash_box_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "allow_all_withdrawals" ON cash_box_withdrawals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "allow_all_debts" ON debt_records FOR ALL USING (true) WITH CHECK (true);
