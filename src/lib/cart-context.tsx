import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { draftBillsStore, type PaymentMethod, type Product } from "./storage";
import { useAuth } from "./auth-context";
import { resolveBusinessCategory } from "@/features";

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

export type DraftBill = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  customer: Customer;
  items: CartItem[];
  paymentMethod: PaymentMethod;
  advanceAmount: number;
  advancePaymentMethod: "cash" | "online";
  discountValue: number;
  discountType: "percentage" | "flat";
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
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

const ACTIVE_CART_STORAGE_KEY = "medistock_active_cart";
const DRAFTS_STORAGE_KEY = "medistock_draft_bills";

type CartCtx = {
  items: CartItem[];
  add: (product: Product, qty?: number) => { isFirst: boolean };
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  setFreeQty: (productId: string, freeQty: number) => void;
  setCustomPrice: (productId: string, price: number) => void;
  switchBatch: (oldProductId: string, newProduct: Product) => void;
  clear: (options?: { removeDraft?: boolean }) => void;
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
  // Drafts Management
  drafts: DraftBill[];
  activeDraftId: string | null;
  activeDraftRestored: boolean;
  dismissRestoredBanner: () => void;
  saveAsDraft: (name?: string) => DraftBill;
  loadDraft: (draftId: string) => void;
  deleteDraft: (draftId: string) => void;
  clearDrafts: () => void;
  refreshDrafts: () => Promise<void>;
};

const Ctx = createContext<CartCtx | null>(null);

function loadSavedDrafts(): DraftBill[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeDrafts(local: DraftBill[], remote: DraftBill[]): { merged: DraftBill[]; unsyncedLocal: DraftBill[] } {
  const map = new Map<string, DraftBill>();
  const unsynced: DraftBill[] = [];

  for (const d of remote) {
    if (d && d.id) {
      map.set(d.id, d);
    }
  }

  for (const d of local) {
    if (d && d.id) {
      const existing = map.get(d.id);
      if (!existing) {
        map.set(d.id, d);
        unsynced.push(d);
      } else {
        const localTime = new Date(d.updatedAt || d.createdAt || 0).getTime();
        const remoteTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        if (localTime > remoteTime) {
          map.set(d.id, d);
          unsynced.push(d);
        }
      }
    }
  }

  const merged = Array.from(map.values()).sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  return { merged, unsyncedLocal: unsynced };
}

function getNextDraftSerial(draftList: DraftBill[]): number {
  let maxSerial = 0;
  for (const d of draftList) {
    const match = d.name?.match(/Draft #(\d+)/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSerial) {
        maxSerial = num;
      }
    }
  }
  return maxSerial + 1;
}

function saveDraftsToStorage(drafts: DraftBill[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  } catch (err) {
    console.warn("Failed to persist drafts to localStorage:", err);
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const isRetailer = resolveBusinessCategory(session?.role) === "retailer";

  // Try restoring initial active cart state from localStorage
  const initialDataRef = useRef<{
    items: CartItem[];
    customer: Customer;
    customerSubmitted: boolean;
    paymentMethod: PaymentMethod;
    advanceAmount: number;
    advancePaymentMethod: "cash" | "online";
    discountValue: number;
    discountType: "percentage" | "flat";
    activeDraftId: string | null;
    wasRestored: boolean;
  }>(() => {
    if (typeof window === "undefined") {
      return {
        items: [],
        customer: emptyCustomer,
        customerSubmitted: false,
        paymentMethod: "cash",
        advanceAmount: 0,
        advancePaymentMethod: "cash",
        discountValue: 0,
        discountType: "percentage",
        activeDraftId: null,
        wasRestored: false,
      };
    }
    try {
      const raw = window.localStorage.getItem(ACTIVE_CART_STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p.items) && p.items.length > 0) {
          return {
            items: p.items,
            customer: p.customer ? { ...emptyCustomer, ...p.customer } : emptyCustomer,
            customerSubmitted: Boolean(p.customerSubmitted),
            paymentMethod: p.paymentMethod || "cash",
            advanceAmount: Number(p.advanceAmount) || 0,
            advancePaymentMethod: p.advancePaymentMethod === "online" ? "online" : "cash",
            discountValue: Number(p.discountValue) || 0,
            discountType: p.discountType === "flat" ? "flat" : "percentage",
            activeDraftId: p.activeDraftId || null,
            wasRestored: true,
          };
        }
      }
    } catch (e) {
      console.warn("Error parsing cached cart:", e);
    }
    return {
      items: [],
      customer: emptyCustomer,
      customerSubmitted: false,
      paymentMethod: "cash",
      advanceAmount: 0,
      advancePaymentMethod: "cash",
      discountValue: 0,
      discountType: "percentage",
      activeDraftId: null,
      wasRestored: false,
    };
  });

  const [items, setItems] = useState<CartItem[]>(initialDataRef.current().items);
  const [customer, setCustomer] = useState<Customer>(initialDataRef.current().customer);
  const [customerSubmitted, setCustomerSubmitted] = useState(initialDataRef.current().customerSubmitted);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialDataRef.current().paymentMethod);
  const [advanceAmount, setAdvanceAmount] = useState(initialDataRef.current().advanceAmount);
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<"cash" | "online">(initialDataRef.current().advancePaymentMethod);
  const [discountValue, setDiscountValue] = useState(initialDataRef.current().discountValue);
  const [discountType, setDiscountType] = useState<"percentage" | "flat">(initialDataRef.current().discountType);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(initialDataRef.current().activeDraftId);
  const [activeDraftRestored, setActiveDraftRestored] = useState<boolean>(initialDataRef.current().wasRestored);
  const [drafts, setDrafts] = useState<DraftBill[]>(loadSavedDrafts);

  const broadcastDraftsUpdated = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("medistock-drafts-updated"));
      if ("BroadcastChannel" in window) {
        try {
          const ch = new BroadcastChannel("medistock_draft_bills_sync");
          ch.postMessage("drafts-updated");
          ch.close();
        } catch {}
      }
    }
  }, []);

  const syncDraftsFromRemote = useCallback(async () => {
    if (!session) return;
    try {
      const remote = await draftBillsStore.list();
      const local = loadSavedDrafts();
      const { merged, unsyncedLocal } = mergeDrafts(local, remote);

      setDrafts(merged);
      saveDraftsToStorage(merged);

      if (unsyncedLocal.length > 0) {
        for (const d of unsyncedLocal) {
          draftBillsStore.save(d).catch((err) => {
            console.warn("Background draft sync upload error:", err);
          });
        }
      }
    } catch (err) {
      console.warn("Failed to sync drafts from server:", err);
    }
  }, [session]);

  const refreshDrafts = useCallback(async () => {
    await syncDraftsFromRemote();
  }, [syncDraftsFromRemote]);

  // Sync drafts across all devices linked to this account
  useEffect(() => {
    if (!session) return;
    syncDraftsFromRemote();

    const handleFocus = () => {
      syncDraftsFromRemote();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncDraftsFromRemote();
      }
    };

    const handleCustomUpdate = () => {
      syncDraftsFromRemote();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("medistock-drafts-updated", handleCustomUpdate);

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        channel = new BroadcastChannel("medistock_draft_bills_sync");
        channel.onmessage = (event) => {
          if (event.data === "drafts-updated") {
            syncDraftsFromRemote();
          }
        };
      } catch {}
    }

    // Background interval to keep drafts in sync in case a draft is saved on another device
    const interval = setInterval(() => {
      syncDraftsFromRemote();
    }, 15000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("medistock-drafts-updated", handleCustomUpdate);
      if (channel) channel.close();
      clearInterval(interval);
    };
  }, [session, syncDraftsFromRemote]);

  // Sync active cart to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (items.length > 0) {
      const payload = {
        items,
        customer,
        customerSubmitted,
        paymentMethod,
        advanceAmount,
        advancePaymentMethod,
        discountValue,
        discountType,
        activeDraftId,
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(ACTIVE_CART_STORAGE_KEY, JSON.stringify(payload));
    } else {
      window.localStorage.removeItem(ACTIVE_CART_STORAGE_KEY);
    }
  }, [
    items,
    customer,
    customerSubmitted,
    paymentMethod,
    advanceAmount,
    advancePaymentMethod,
    discountValue,
    discountType,
    activeDraftId,
  ]);

  // Keep fresh ref of state for event listeners (beforeunload, logout)
  const stateRef = useRef({
    items,
    customer,
    customerSubmitted,
    paymentMethod,
    advanceAmount,
    advancePaymentMethod,
    discountValue,
    discountType,
    activeDraftId,
    drafts,
  });

  useEffect(() => {
    stateRef.current = {
      items,
      customer,
      customerSubmitted,
      paymentMethod,
      advanceAmount,
      advancePaymentMethod,
      discountValue,
      discountType,
      activeDraftId,
      drafts,
    };
  });

  // Warn on accidental refresh/close when bill is being created, and ensure draft is saved
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const current = stateRef.current;
      if (current.items.length > 0) {
        // Save current cart active state
        const payload = {
          items: current.items,
          customer: current.customer,
          customerSubmitted: current.customerSubmitted,
          paymentMethod: current.paymentMethod,
          advanceAmount: current.advanceAmount,
          advancePaymentMethod: current.advancePaymentMethod,
          discountValue: current.discountValue,
          discountType: current.discountType,
          activeDraftId: current.activeDraftId,
          updatedAt: new Date().toISOString(),
        };
        try {
          window.localStorage.setItem(ACTIVE_CART_STORAGE_KEY, JSON.stringify(payload));
        } catch {
          // ignore
        }

        e.preventDefault();
        e.returnValue = "You have an unsaved bill in progress. It will be saved as a draft.";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Listen to logout / save-draft event
  useEffect(() => {
    const handleSaveOnLogout = () => {
      const current = stateRef.current;
      if (current.items.length > 0) {
        const existingDrafts = loadSavedDrafts();
        const existingDraft = current.activeDraftId
          ? existingDrafts.find((d) => d.id === current.activeDraftId)
          : null;

        // Save into drafts list
        const sub = Number(current.items.reduce((s, i) => s + (i.qty - (i.freeQty || 0)) * (i.customPrice ?? i.product.price), 0).toFixed(2));
        const tx = Number(current.items.reduce((s, i) => s + ((i.qty - (i.freeQty || 0)) * (i.customPrice ?? i.product.price) * (i.product.taxPercent ?? 0)) / 100, 0).toFixed(2));
        const disc = Number((current.discountType === "percentage" ? ((sub + tx) * current.discountValue) / 100 : current.discountValue).toFixed(2));
        const tot = Number(Math.max(0, sub + tx - disc).toFixed(2));

        const now = new Date();
        const formattedDate = now.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        const isWalkIn = !current.customer.name || current.customer.name.toLowerCase() === "walk-in customer";

        let draftTitle = "";
        if (existingDraft?.name) {
          draftTitle = existingDraft.name;
        } else if (!isWalkIn && current.customer.name) {
          draftTitle = `Draft - ${current.customer.name} (Saved on Logout)`;
        } else {
          const nextSerial = getNextDraftSerial(existingDrafts);
          draftTitle = `Draft #${nextSerial} (${formattedDate} - Logout)`;
        }

        const draftObj: DraftBill = {
          id: current.activeDraftId || `draft_${Date.now()}`,
          name: draftTitle,
          createdAt: existingDraft?.createdAt || now.toISOString(),
          updatedAt: now.toISOString(),
          customer: current.customer,
          items: current.items,
          paymentMethod: current.paymentMethod,
          advanceAmount: current.advanceAmount,
          advancePaymentMethod: current.advancePaymentMethod,
          discountValue: current.discountValue,
          discountType: current.discountType,
          subtotal: sub,
          tax: tx,
          discount: disc,
          total: tot,
        };

        const updatedDrafts = [draftObj, ...existingDrafts.filter((d) => d.id !== draftObj.id)];
        saveDraftsToStorage(updatedDrafts);
      }
    };

    window.addEventListener("medistock-save-cart-draft", handleSaveOnLogout);
    return () => window.removeEventListener("medistock-save-cart-draft", handleSaveOnLogout);
  }, []);

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
        const newQty = Math.max(0.0001, Math.min(i.product.stock, Number(Number(qty).toFixed(4))));
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

  const switchBatch: CartCtx["switchBatch"] = (oldId, newProduct) => {
    setItems((prev) => {
      const oldItem = prev.find((item) => item.product.id === oldId);
      if (!oldItem) return prev;

      const existingNewItem = prev.find((item) => item.product.id === newProduct.id);
      if (existingNewItem) {
        return prev
          .map((item) => {
            if (item.product.id === newProduct.id) {
              return {
                ...item,
                qty: Math.min(newProduct.stock, item.qty + oldItem.qty),
                freeQty: (item.freeQty || 0) + (oldItem.freeQty || 0),
              };
            }
            return item;
          })
          .filter((item) => item.product.id !== oldId);
      }

      return prev.map((item) =>
        item.product.id === oldId
          ? {
              ...item,
              product: newProduct,
              qty: Math.min(newProduct.stock, item.qty),
              freeQty: Math.min(newProduct.stock, item.freeQty || 0),
            }
          : item
      );
    });
  };

  const clear = (options?: { removeDraft?: boolean }) => {
    if (options?.removeDraft && activeDraftId) {
      deleteDraft(activeDraftId);
    }
    setItems([]);
    setCustomer(emptyCustomer);
    setCustomerSubmitted(false);
    setPaymentMethod("cash");
    setAdvanceAmount(0);
    setAdvancePaymentMethod("cash");
    setDiscountValue(0);
    setDiscountType("percentage");
    setActiveDraftId(null);
    setActiveDraftRestored(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_CART_STORAGE_KEY);
    }
  };

  let subtotal = 0;
  let tax = 0;
  let grossSum = 0;
  let discount = 0;
  let total = 0;

  if (isRetailer) {
    items.forEach((i) => {
      const lineGross = Number(((i.qty - (i.freeQty || 0)) * (i.customPrice ?? i.product.price)).toFixed(2));
      const taxRate = i.product.taxPercent != null ? i.product.taxPercent : 5;
      const taxable = taxRate > 0 ? Number((lineGross / (1 + taxRate / 100)).toFixed(2)) : lineGross;
      const taxAmount = Number((lineGross - taxable).toFixed(2));

      grossSum += lineGross;
      subtotal += taxable;
      tax += taxAmount;
    });
    subtotal = Number(subtotal.toFixed(2));
    tax = Number(tax.toFixed(2));
    const rawDiscount = discountType === "percentage" ? (grossSum * discountValue) / 100 : discountValue;
    discount = Number(rawDiscount.toFixed(2));
    total = Number(Math.max(0, grossSum - discount).toFixed(2));
  } else {
    const rawSubtotal = items.reduce((s, i) => s + (i.qty - (i.freeQty || 0)) * (i.customPrice ?? i.product.price), 0);
    subtotal = Number(rawSubtotal.toFixed(2));
    const rawTax = items.reduce(
      (s, i) =>
        s + ((i.qty - (i.freeQty || 0)) * (i.customPrice ?? i.product.price) * (i.product.taxPercent ?? 0)) / 100,
      0,
    );
    tax = Number(rawTax.toFixed(2));
    const rawDiscount = discountType === "percentage" ? ((subtotal + tax) * discountValue) / 100 : discountValue;
    discount = Number(rawDiscount.toFixed(2));
    total = Number(Math.max(0, subtotal + tax - discount).toFixed(2));
  }

  const count = items.reduce((s, i) => s + i.qty, 0);

  // ── Draft Methods ──────────────────────────────────────────────────────────
  const saveAsDraft = (customTitle?: string): DraftBill => {
    const existingDraft = activeDraftId ? drafts.find((d) => d.id === activeDraftId) : null;
    const draftId = activeDraftId || `draft_${Date.now()}`;
    const now = new Date();
    const formattedTime = now.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    const isWalkIn = !customer.name || customer.name.toLowerCase() === "walk-in customer";
    let title = customTitle;
    if (!title) {
      if (existingDraft?.name) {
        // Name remains constant for the same draft (e.g. Draft #1 stays Draft #1)
        title = existingDraft.name;
      } else if (!isWalkIn && customer.name) {
        title = `Draft - ${customer.name} (₹${total})`;
      } else {
        const nextSerial = getNextDraftSerial(drafts);
        title = `Draft #${nextSerial} (${formattedTime})`;
      }
    }

    const createdAt = existingDraft?.createdAt || now.toISOString();

    const newDraft: DraftBill = {
      id: draftId,
      name: title,
      createdAt,
      updatedAt: now.toISOString(),
      customer: { ...customer },
      items: [...items],
      paymentMethod,
      advanceAmount,
      advancePaymentMethod,
      discountValue,
      discountType,
      subtotal,
      tax,
      discount,
      total,
    };

    setDrafts((prev) => {
      const filtered = prev.filter((d) => d.id !== draftId);
      const updated = [newDraft, ...filtered];
      saveDraftsToStorage(updated);
      return updated;
    });

    if (session) {
      draftBillsStore.save(newDraft).catch((err) => {
        console.error("Failed to sync new draft to server:", err);
      });
      broadcastDraftsUpdated();
    }

    // Reset active cart so it doesn't show this draft bill anymore and is ready for a fresh bill
    setItems([]);
    setCustomer(emptyCustomer);
    setCustomerSubmitted(false);
    setPaymentMethod("cash");
    setAdvanceAmount(0);
    setAdvancePaymentMethod("cash");
    setDiscountValue(0);
    setDiscountType("percentage");
    setActiveDraftId(null);
    setActiveDraftRestored(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_CART_STORAGE_KEY);
    }

    return newDraft;
  };

  const loadDraft = (draftId: string) => {
    const target = drafts.find((d) => d.id === draftId);
    if (!target) return;

    setItems(target.items);
    setCustomer(target.customer || emptyCustomer);
    setCustomerSubmitted(Boolean(target.customer?.name));
    setPaymentMethod(target.paymentMethod || "cash");
    setAdvanceAmount(target.advanceAmount || 0);
    setAdvancePaymentMethod(target.advancePaymentMethod || "cash");
    setDiscountValue(target.discountValue || 0);
    setDiscountType(target.discountType || "percentage");
    setActiveDraftId(target.id);
    setActiveDraftRestored(true);

    // Persist as active cart
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        ACTIVE_CART_STORAGE_KEY,
        JSON.stringify({
          items: target.items,
          customer: target.customer,
          customerSubmitted: Boolean(target.customer?.name),
          paymentMethod: target.paymentMethod,
          advanceAmount: target.advanceAmount,
          advancePaymentMethod: target.advancePaymentMethod,
          discountValue: target.discountValue,
          discountType: target.discountType,
          activeDraftId: target.id,
          updatedAt: new Date().toISOString(),
        })
      );
    }
  };

  const deleteDraft = (draftId: string) => {
    setDrafts((prev) => {
      const updated = prev.filter((d) => d.id !== draftId);
      saveDraftsToStorage(updated);
      return updated;
    });
    if (activeDraftId === draftId) {
      setActiveDraftId(null);
    }
    if (session) {
      draftBillsStore.delete(draftId).catch((err) => {
        console.error("Failed to delete draft on server:", err);
      });
      broadcastDraftsUpdated();
    }
  };

  const clearDrafts = () => {
    setDrafts([]);
    saveDraftsToStorage([]);
    setActiveDraftId(null);
    if (session) {
      draftBillsStore.clear().catch((err) => {
        console.error("Failed to clear drafts on server:", err);
      });
      broadcastDraftsUpdated();
    }
  };

  const dismissRestoredBanner = () => {
    setActiveDraftRestored(false);
  };

  return (
    <Ctx.Provider
      value={{
        items,
        add,
        remove,
        setQty,
        setFreeQty,
        setCustomPrice,
        switchBatch,
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
        drafts,
        activeDraftId,
        activeDraftRestored,
        dismissRestoredBanner,
        saveAsDraft,
        loadDraft,
        deleteDraft,
        clearDrafts,
        refreshDrafts,
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

