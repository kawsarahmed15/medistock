import { createContext, useContext, useState, type ReactNode } from "react";
import type { PaymentMethod, Product } from "./storage";
import { calculateSmallestUnits } from "./inventory-utils";

export type CartItem = { product: Product; qty: number; freeQty?: number; unitSold?: string; convertedQty?: number };

export type Customer = {
  name: string;
  phone: string;
  address?: string;
  drugLicNo?: string;
  notes: string;
  prescriptionRef?: string;
  /** Data URL (image/*) of an uploaded prescription photo. */
  prescriptionPhoto?: string;
};

const emptyCustomer: Customer = {
  name: "",
  phone: "",
  address: "",
  notes: "",
  prescriptionRef: "",
  prescriptionPhoto: "",
};

type CartCtx = {
  items: CartItem[];
  add: (product: Product, qty?: number, unitSold?: string) => { isFirst: boolean };
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number, unitSold?: string) => void;
  setFreeQty: (productId: string, freeQty: number) => void;
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
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<"percentage" | "flat">("percentage");

  const add: CartCtx["add"] = (product, qty = 1, unitSold = "Tablet") => {
    const isFirst = items.length === 0;
    const unit = product.medicineType === "Tablet" || product.medicineType === "Capsule" ? unitSold : "Unit";
    const convertedQty = calculateSmallestUnits(qty, unit, product.medicineType || "Tablet", Number(product.tabletsPerStrip || 10), Number(product.stripsPerBox || 10));
    
    setItems((prev) => {
      // Find if we already have this product with the SAME unitSold.
      // If we do, increment. If not, add as new line item.
      const existingIdx = prev.findIndex((i) => i.product.id === product.id && (i.unitSold || "Tablet") === unit);
      if (existingIdx >= 0) {
        const i = prev[existingIdx];
        const newQty = i.qty + qty;
        const newConverted = calculateSmallestUnits(newQty, unit, product.medicineType || "Tablet", Number(product.tabletsPerStrip || 10), Number(product.stripsPerBox || 10));
        
        // We only allow if total converted doesn't exceed stock (very rough check, as there could be multiple lines of same product, but good enough for now)
        const totalOtherConverted = prev.filter((_, idx) => idx !== existingIdx && _.product.id === product.id).reduce((sum, item) => sum + (item.convertedQty || 0), 0);
        
        if (newConverted + totalOtherConverted > product.stock) {
            // Cannot add
            return prev;
        }

        const newItems = [...prev];
        newItems[existingIdx] = { ...i, qty: newQty, convertedQty: newConverted };
        return newItems;
      }
      
      const totalOtherConverted = prev.filter(i => i.product.id === product.id).reduce((sum, item) => sum + (item.convertedQty || 0), 0);
      if (convertedQty + totalOtherConverted > product.stock) {
          return prev;
      }

      return [...prev, { product, qty, unitSold: unit, convertedQty }];
    });
    return { isFirst };
  };

  const remove: CartCtx["remove"] = (id) =>
    setItems((prev) => prev.filter((i) => i.product.id !== id));

  const setQty: CartCtx["setQty"] = (id, qty, unitSold) =>
    setItems((prev) =>
      prev.map((i) => {
        if (i.product.id !== id || (unitSold && i.unitSold !== unitSold)) return i;
        
        // Calculate the requested converted qty
        const requestedConverted = calculateSmallestUnits(qty, i.unitSold || "Tablet", i.product.medicineType || "Tablet", Number(i.product.tabletsPerStrip || 10), Number(i.product.stripsPerBox || 10));
        
        // Count other converted items
        const totalOtherConverted = prev.filter(item => item.product.id === id && item !== i).reduce((sum, item) => sum + (item.convertedQty || 0), 0);
        
        // Check if we exceed stock
        if (requestedConverted + totalOtherConverted > i.product.stock) {
          // Keep old qty
          return i;
        }
        
        const newQty = Math.max(1, qty);
        const newConverted = calculateSmallestUnits(newQty, i.unitSold || "Tablet", i.product.medicineType || "Tablet", Number(i.product.tabletsPerStrip || 10), Number(i.product.stripsPerBox || 10));

        return { ...i, qty: newQty, convertedQty: newConverted, freeQty: Math.min(i.freeQty || 0, newQty) };
      }),
    );

  const setFreeQty: CartCtx["setFreeQty"] = (id, freeQty) =>
    setItems((prev) =>
      prev.map((i) =>
        i.product.id === id ? { ...i, freeQty: Math.max(0, Math.min(i.qty, freeQty)) } : i,
      ),
    );

  const clear = () => {
    setItems([]);
    setCustomer(emptyCustomer);
    setCustomerSubmitted(false);
    setPaymentMethod("cash");
    setAdvanceAmount(0);
    setDiscountValue(0);
    setDiscountType("percentage");
  };

  const subtotal = items.reduce((s, i) => s + ((i.convertedQty || i.qty) - (i.freeQty || 0)) * i.product.price, 0);
  const tax = items.reduce(
    (s, i) =>
      s + (((i.convertedQty || i.qty) - (i.freeQty || 0)) * i.product.price * (i.product.taxPercent ?? 0)) / 100,
    0,
  );

  const discount =
    discountType === "percentage" ? ((subtotal + tax) * discountValue) / 100 : discountValue;

  const total = Math.max(0, subtotal + tax - discount);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <Ctx.Provider
      value={{
        items,
        add,
        remove,
        setQty,
        setFreeQty,
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
