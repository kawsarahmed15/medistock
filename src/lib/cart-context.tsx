import { createContext, useContext, useState, type ReactNode } from "react";
import type { PaymentMethod, Product } from "./storage";

export type CartItem = { product: Product; qty: number; isFree?: boolean };

export type Customer = {
  name: string;
  phone: string;
  notes: string;
  prescriptionRef?: string;
  /** Data URL (image/*) of an uploaded prescription photo. */
  prescriptionPhoto?: string;
};

const emptyCustomer: Customer = {
  name: "",
  phone: "",
  notes: "",
  prescriptionRef: "",
  prescriptionPhoto: "",
};

type CartCtx = {
  items: CartItem[];
  add: (product: Product, qty?: number) => { isFirst: boolean };
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  toggleFree: (productId: string) => void;
  clear: () => void;
  subtotal: number;
  tax: number;
  total: number;
  count: number;
  customer: Customer;
  setCustomer: (c: Customer) => void;
  customerSubmitted: boolean;
  setCustomerSubmitted: (v: boolean) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (m: PaymentMethod) => void;
};

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  const [customerSubmitted, setCustomerSubmitted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");

  const add: CartCtx["add"] = (product, qty = 1) => {
    const isFirst = items.length === 0;
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, qty: Math.min(product.stock, i.qty + qty) }
            : i,
        );
      }
      return [...prev, { product, qty: Math.min(product.stock, qty) }];
    });
    return { isFirst };
  };

  const remove: CartCtx["remove"] = (id) =>
    setItems((prev) => prev.filter((i) => i.product.id !== id));

  const setQty: CartCtx["setQty"] = (id, qty) =>
    setItems((prev) =>
      prev.map((i) =>
        i.product.id === id ? { ...i, qty: Math.max(1, Math.min(i.product.stock, qty)) } : i,
      ),
    );

  const toggleFree: CartCtx["toggleFree"] = (id) =>
    setItems((prev) =>
      prev.map((i) =>
        i.product.id === id ? { ...i, isFree: !i.isFree } : i,
      ),
    );

  const clear = () => {
    setItems([]);
    setCustomer(emptyCustomer);
    setCustomerSubmitted(false);
    setPaymentMethod("cash");
  };

  const subtotal = items.reduce((s, i) => s + (i.isFree ? 0 : i.product.price * i.qty), 0);
  const tax = items.reduce(
    (s, i) => s + (i.isFree ? 0 : (i.product.price * i.qty * (i.product.taxPercent ?? 0)) / 100),
    0,
  );
  const total = subtotal + tax;
  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <Ctx.Provider
      value={{
        items,
        add,
        remove,
        setQty,
        toggleFree,
        clear,
        subtotal,
        tax,
        total,
        count,
        customer,
        setCustomer,
        customerSubmitted,
        setCustomerSubmitted,
        paymentMethod,
        setPaymentMethod,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
