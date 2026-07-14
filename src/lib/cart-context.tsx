import { createContext, useContext, useState, type ReactNode } from "react";
import type { PaymentMethod, Product } from "./storage";

export type CartItem = { product: Product; qty: number; freeQty?: number; customPrice?: number };

export type Customer = {
  name: string;
  phone: string;
  address?: string;
  drugLicNo?: string;
  gstin?: string;
  notes: string;
  prescriptionRef?: string;
  /** Data URL (image/*) of an uploaded prescription photo. */
  prescriptionPhoto?: string;
};

const emptyCustomer: Customer = {
  name: "",
  phone: "",
  address: "",
  drugLicNo: "",
  gstin: "",
  notes: "",
  prescriptionRef: "",
  prescriptionPhoto: "",
};

type CartCtx = {
  items: CartItem[];
  add: (product: Product, qty?: number) => { isFirst: boolean };
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  setFreeQty: (productId: string, freeQty: number) => void;
  setCustomPrice: (productId: string, price: number) => void;
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
  advanceAmount: number;
  setAdvanceAmount: (a: number) => void;
  advancePaymentMethod: "cash" | "online";
  setAdvancePaymentMethod: (m: "cash" | "online") => void;
  discountValue: number;
  setDiscountValue: (d: number) => void;
  discountType: "percentage" | "flat";
  setDiscountType: (t: "percentage" | "flat") => void;
  discount: number;
};

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer>(emptyCustomer);
  const [customerSubmitted, setCustomerSubmitted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<"cash" | "online">("cash");
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<"percentage" | "flat">("percentage");

  const add: CartCtx["add"] = (product, qty = 1) => {
    const isFirst = items.length === 0;
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, qty: Math.min(product.stock, i.qty + qty) } : i,
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
      prev.map((i) => {
        if (i.product.id !== id) return i;
        const newQty = Math.max(1, Math.min(i.product.stock, qty));
        return { ...i, qty: newQty, freeQty: Math.min(i.freeQty || 0, newQty) };
      }),
    );

  const setFreeQty: CartCtx["setFreeQty"] = (id, freeQty) =>
    setItems((prev) =>
      prev.map((i) =>
        i.product.id === id ? { ...i, freeQty: Math.max(0, Math.min(i.qty, freeQty)) } : i,
      ),
    );

  const setCustomPrice: CartCtx["setCustomPrice"] = (id, price) =>
    setItems((prev) =>
      prev.map((i) =>
        i.product.id === id ? { ...i, customPrice: price } : i,
      ),
    );

  const clear = () => {
    setItems([]);
    setCustomer(emptyCustomer);
    setCustomerSubmitted(false);
    setPaymentMethod("cash");
    setAdvanceAmount(0);
    setAdvancePaymentMethod("cash");
    setDiscountValue(0);
    setDiscountType("percentage");
  };

  const subtotal = items.reduce((s, i) => s + (i.qty - (i.freeQty || 0)) * (i.customPrice ?? i.product.price), 0);
  const tax = items.reduce(
    (s, i) =>
      s + ((i.qty - (i.freeQty || 0)) * (i.customPrice ?? i.product.price) * (i.product.taxPercent ?? 0)) / 100,
    0,
  );

  const discount =
    discountType === "percentage" ? ((subtotal + tax) * discountValue) / 100 : discountValue;

  const total = Math.round(Math.max(0, subtotal + tax - discount));
  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <Ctx.Provider
      value={{
        items,
        add,
        remove,
        setQty,
        setFreeQty,
        setCustomPrice,
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
        advanceAmount,
        setAdvanceAmount,
        advancePaymentMethod,
        setAdvancePaymentMethod,
        discountValue,
        setDiscountValue,
        discountType,
        setDiscountType,
        discount,
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
