import { apiRequest } from "./api-client";

export type PaymentMethod = "cash" | "online" | "credit";

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  costPrice?: number;
  stock: number;
  expiry: string; // ISO
  mrp?: number;
  pack?: string;
  batch?: string;
  manufacturer?: string;
  sku?: string;
  prescription?: boolean;
  taxPercent?: number;
  baseUnit?: string;
  packUnit?: string;
  conversionFactor?: number;
  packPrice?: number;
  packCostPrice?: number;
  createdAt: string;
};

export type BillItem = {
  productId: string;
  name: string;
  price: number;
  costPrice?: number;
  qty: number;
  taxPercent: number;
  mrp?: number;
  batch?: string;
  pack?: string;
  expiry?: string;
  freeQty?: number;
};

export type Bill = {
  id: string;
  number: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerNotes?: string;
  items: BillItem[];
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  advanceAmount: number;
  paymentMethod: PaymentMethod;
  createdAt: string;
  cashier?: string;
};

type ProductRow = {
  id: string;
  name: string;
  category: string;
  price: number | string;
  cost_price: number | string | null;
  stock: number;
  expiry: string;
  mrp: number | string | null;
  pack: string | null;
  batch: string | null;
  manufacturer: string | null;
  sku: string | null;
  prescription: boolean | number;
  tax_percent: number | string;
  created_at: string;
};

const num = (v: number | string | null | undefined) =>
  v == null ? undefined : typeof v === "string" ? Number(v) : v;

function rowToProduct(r: ProductRow): Product {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    price: Number(r.price) || 0,
    costPrice: num(r.cost_price),
    stock: r.stock,
    expiry: r.expiry,
    mrp: num(r.mrp),
    pack: r.pack ?? undefined,
    batch: r.batch ?? undefined,
    manufacturer: r.manufacturer ?? undefined,
    sku: r.sku ?? undefined,
    prescription: Boolean(r.prescription),
    taxPercent: Number(r.tax_percent) || 0,
    createdAt: r.created_at,
  };
}

export const productsStore = {
  async list(): Promise<Product[]> {
    const data = await apiRequest<ProductRow[]>("/products", { auth: true });
    return data.map(rowToProduct);
  },
  async add(p: Omit<Product, "id" | "createdAt">): Promise<Product> {
    const data = await apiRequest<ProductRow>("/products", { method: "POST", body: p, auth: true });
    return rowToProduct(data);
  },
  async update(id: string, patch: Partial<Product>): Promise<void> {
    await apiRequest(`/products/${id}`, { method: "PATCH", body: patch, auth: true });
  },
  async remove(id: string): Promise<void> {
    await apiRequest(`/products/${id}`, { method: "DELETE", auth: true });
  },
  async decrementStock(id: string, qty: number): Promise<void> {
    await apiRequest(`/products/${id}/decrement`, { method: "POST", body: { qty }, auth: true });
  },
};

type BillRow = {
  id: string;
  number: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address?: string | null;
  customer_notes: string | null;
  cashier: string | null;
  payment_method: PaymentMethod;
  advance_amount: number | string;
  subtotal: number | string;
  tax: number | string;
  total: number | string;
  created_at: string;
};
type BillItemRow = {
  bill_id: string;
  product_id: string | null;
  name: string;
  price: number | string;
  cost_price: number | string | null;
  qty: number;
  tax_percent: number | string;
  mrp: number | string | null;
  batch: string | null;
  pack: string | null;
  expiry: string | null;
  free_qty: number;
};

function rowToBill(b: BillRow, items: BillItemRow[]): Bill {
  return {
    id: b.id,
    number: b.number,
    customerName: b.customer_name ?? undefined,
    customerPhone: b.customer_phone ?? undefined,
    customerAddress: b.customer_address ?? undefined,
    customerNotes: b.customer_notes ?? undefined,
    cashier: b.cashier ?? undefined,
    paymentMethod: b.payment_method,
    advanceAmount: Number(b.advance_amount) || 0,
    subtotal: Number(b.subtotal) || 0,
    tax: Number(b.tax) || 0,
    discount: Number(b.discount) || 0,
    total: Number(b.total) || 0,
    createdAt: b.created_at,
    items: items.map((it) => ({
      productId: it.product_id ?? "",
      name: it.name,
      price: Number(it.price) || 0,
      costPrice: num(it.cost_price),
      qty: it.qty,
      taxPercent: Number(it.tax_percent) || 0,
      mrp: num(it.mrp),
      batch: it.batch ?? undefined,
      pack: it.pack ?? undefined,
      expiry: it.expiry ? it.expiry.substring(0, 10) : undefined,
      freeQty: Number(it.free_qty) || 0,
    })),
  };
}

type BillResponse = BillRow & { items: BillItemRow[] };

export const billsStore = {
  async list(): Promise<Bill[]> {
    const data = await apiRequest<BillResponse[]>("/bills", { auth: true });
    return data.map((b) => rowToBill(b, b.items || []));
  },
  async get(id: string): Promise<Bill | null> {
    const data = await apiRequest<BillResponse>(`/bills/${id}`, { auth: true });
    return data ? rowToBill(data, data.items || []) : null;
  },
  async add(b: Omit<Bill, "id" | "number" | "createdAt">): Promise<Bill> {
    const data = await apiRequest<BillResponse>("/bills", { method: "POST", body: b, auth: true });
    return rowToBill(data, data.items || []);
  },
};

export type Customer = {
  phone: string;
  name: string;
  address?: string;
  notes?: string;
  visits: number;
  totalSpent: number;
  totalCredit: number;
  totalPaid: number;
  balance: number;
  lastVisit: string; // ISO
};

export const customersStore = {
  async list(from?: string, to?: string): Promise<Customer[]> {
    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return await apiRequest<Customer[]>(`/customers${qs}`, { auth: true });
  },
  async addPayment(data: { phone: string; name: string; amount: number; method: PaymentMethod; notes?: string }): Promise<{ success: boolean; id: string }> {
    return await apiRequest<{ success: boolean; id: string }>("/customers/pay", { method: "POST", body: data, auth: true });
  },
  async getCreditHistory(phone: string): Promise<any[]> {
    return await apiRequest<any[]>(`/customers/${encodeURIComponent(phone)}/credit-history`, { auth: true });
  },
  async getAllPayments(from?: string, to?: string): Promise<{ id: string, amount: number, method: string, created_at: string }[]> {
    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return await apiRequest<any[]>(`/customers/payments/all${qs}`, { auth: true });
  },
  async update(phone: string, data: { name?: string; phone?: string; address?: string; notes?: string }): Promise<{ success: boolean }> {
    return await apiRequest<{ success: boolean }>(`/customers/${encodeURIComponent(phone)}`, { method: "PUT", body: data, auth: true });
  }
};

const THEME_KEY = "pharma.theme";
export const themeStore = {
  get: (): "light" | "dark" => {
    if (typeof window === "undefined") return "light";
    return (window.localStorage.getItem(THEME_KEY) as "light" | "dark") ?? "light";
  },
  set: (t: "light" | "dark") => {
    if (typeof window !== "undefined") window.localStorage.setItem(THEME_KEY, t);
  },
};

export function setStorageUser(_userId: string | null) {}
