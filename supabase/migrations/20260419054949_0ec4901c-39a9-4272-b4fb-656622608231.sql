-- Payment method enum
CREATE TYPE public.payment_method AS ENUM ('cash', 'online');

-- Products
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(12,2),
  stock INTEGER NOT NULL DEFAULT 0,
  expiry DATE NOT NULL,
  batch TEXT,
  manufacturer TEXT,
  sku TEXT,
  prescription BOOLEAN NOT NULL DEFAULT false,
  tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_user ON public.products(user_id);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own products" ON public.products
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own products" ON public.products
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own products" ON public.products
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own products" ON public.products
  FOR DELETE USING (auth.uid() = user_id);

-- Bills
CREATE TABLE public.bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  number TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_notes TEXT,
  cashier TEXT,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, number)
);
CREATE INDEX idx_bills_user_created ON public.bills(user_id, created_at DESC);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bills" ON public.bills
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own bills" ON public.bills
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own bills" ON public.bills
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own bills" ON public.bills
  FOR DELETE USING (auth.uid() = user_id);

-- Bill items
CREATE TABLE public.bill_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  product_id UUID,
  name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  cost_price NUMERIC(12,2),
  qty INTEGER NOT NULL,
  tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bill_items_bill ON public.bill_items(bill_id);
CREATE INDEX idx_bill_items_user ON public.bill_items(user_id);

ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bill_items" ON public.bill_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own bill_items" ON public.bill_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own bill_items" ON public.bill_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own bill_items" ON public.bill_items
  FOR DELETE USING (auth.uid() = user_id);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();