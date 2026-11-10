import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback, type FormEvent } from "react";
import { flushSync } from "react-dom";
import {
  Banknote,
  FileWarning,
  Minus,
  Plus,
  Smartphone,
  CreditCard,
  ShoppingCart,
  Trash2,
  UserRound,
  Pencil,
  Search,
  PackagePlus,
  ScanLine,
  Keyboard,
  FileText,
  Bookmark,
  Save,
  X,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Check,
  Receipt,
  Coins,
  Clock,
  Pill,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import {
  billsStore,
  productsStore,
  customersStore,
  type Product,
  type Customer as SavedCustomer,
} from "@/lib/storage";
import { extractPhoneDigits, formatPhoneWithCountryCode } from "@/lib/phone-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerDetailsDialog } from "@/components/customer-details-dialog";
import { DraftBillsDialog } from "@/components/draft-bills-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SkuScanner } from "@/components/sku-scanner";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { resolveBusinessCategory } from "@/features";
import {
  isTabOrCap,
  getPiecesPerStrip,
  splitQtyToStripAndPc,
  combineStripAndPcToQty,
  formatStripPcDisplay,
  getPerPcPrice,
} from "@/lib/pack-utils";

type CartSearch = { newSale?: number };

export const Route = createFileRoute("/_app/cart")({
  validateSearch: (search: Record<string, unknown>): CartSearch => ({
    newSale: search.newSale ? 1 : undefined,
  }),
  component: CartPage,
});

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);
}

function formatQty(val: number | string | undefined | null): string {
  if (val === null || val === undefined || val === "") return "0";
  const num = Number(val);
  if (isNaN(num)) return "0";
  const rounded = Math.round(num * 100) / 100;
  return rounded.toString();
}

// ─── Cart Add Dialog – Product Form State ─────────────────────────────────────

type FormState = {
  name: string;
  category: string;
  costPrice: string;
  price: string;
  mrp: string;
  stock: string;
  stripStock: string;
  pcStock: string;
  stockType: string;
  stockPacks: string;
  stockUnits: string;
  expiry: string;
  batch: string;
  manufacturer: string;
  sku: string;
  taxPercent: string;
  prescription: boolean;
  baseUnit: string;
  packUnit: string;
  conversionFactor: string;
  packPrice: string;
  packCostPrice: string;
};

const emptyForm: FormState = {
  name: "",
  category: "",
  costPrice: "",
  price: "",
  mrp: "",
  stock: "",
  stripStock: "",
  pcStock: "",
  stockType: "other",
  stockPacks: "",
  stockUnits: "",
  expiry: "",
  batch: "",
  manufacturer: "",
  sku: "",
  taxPercent: "12",
  prescription: false,
  baseUnit: "Unit",
  packUnit: "Pack",
  conversionFactor: "1",
  packPrice: "",
  packCostPrice: "",
};

// ─── Main Cart Page ───────────────────────────────────────────────────────────

function CartPage() {
  const cart = useCart();
  const { session } = useAuth();
  const isRetailer = resolveBusinessCategory(session?.role) === "retailer";
  const navigate = useNavigate();
  const search = Route.useSearch();
  const routeNavigate = Route.useNavigate();
  const [customerOpen, setCustomerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const browseButtonRef = useRef<HTMLButtonElement>(null);
  const [productList, setProductList] = useState<Product[]>([]);
  const [showCostPrice, setShowCostPrice] = useState(false);

  useEffect(() => {
    productsStore
      .list()
      .then(setProductList)
      .catch(() => {});
  }, [addOpen, cart.items.length]);

  useEffect(() => {
    if (search.newSale) {
      setCustomerOpen(true);
      void routeNavigate({ search: {}, replace: true });
    }
  }, [search.newSale, routeNavigate]);

  useEffect(() => {
    const handler = () => {
      setCustomerOpen(true);
    };
    window.addEventListener("trigger-new-bill", handler);
    return () => window.removeEventListener("trigger-new-bill", handler);
  }, []);

  const handleSaveDraft = () => {
    if (cart.items.length === 0) {
      toast.error("Cart is empty. Add items first before saving draft.");
      return;
    }
    const d = cart.saveAsDraft();
    toast.success(`Bill moved to Drafts: ${d.name}`, {
      description: "Draft is preserved safely. Cart is cleared and ready for a new sale.",
    });
  };

  // ── Cart item keyboard selection state ─────────────────────────────────────
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null); // product id to delete
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const itemsContainerRef = useRef<HTMLDivElement>(null);

  const rxItems = cart.items.filter((i) => i.product.prescription);
  const hasRx = rxItems.length > 0;
  const prescriptionRef = (cart.customer.prescriptionRef ?? "").trim();
  const prescriptionPhoto = (cart.customer.prescriptionPhoto ?? "").trim();
  const rxBlocked = hasRx && !prescriptionRef && !prescriptionPhoto;

  // Keep selectedIdx in bounds when items change (e.g. after deletion)
  useEffect(() => {
    if (cart.items.length === 0) {
      setSelectedIdx(-1);
    } else if (selectedIdx >= cart.items.length) {
      setSelectedIdx(cart.items.length - 1);
    }
  }, [cart.items.length]);

  // Scroll selected row into view
  useEffect(() => {
    if (selectedIdx >= 0 && itemRefs.current[selectedIdx]) {
      itemRefs.current[selectedIdx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIdx]);

  // ── Checkout Modal State (Payment & Invoice Preview Flow) ───────────────────
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"payment" | "preview">("payment");

  // ── Refs to keep stable handler closure with always-fresh values ────────────
  const selectedIdxRef = useRef(selectedIdx);
  const addOpenRef = useRef(addOpen);
  const customerOpenRef = useRef(customerOpen);
  const checkoutOpenRef = useRef(checkoutOpen);
  const deleteTargetRef = useRef(deleteTarget);
  const cartRef = useRef(cart);
  const checkoutRef = useRef<() => void>();
  const newBillRef = useRef<() => void>();
  const entryInputRef = useRef<HTMLInputElement>(null);
  const entryDropdownRef = useRef<HTMLDivElement>(null);

  const handleNewBill = () => {
    if (cart.items.length > 0) {
      if (
        !window.confirm(
          "You have an active bill. Are you sure you want to clear it and start a new one?",
        )
      ) {
        return;
      }
    }
    cart.clear();
    setCustomerOpen(true);
    setTimeout(() => {
      entryInputRef.current?.focus();
    }, 100);
  };

  // Keep refs in sync every render (no re-subscription needed)
  useEffect(() => {
    selectedIdxRef.current = selectedIdx;
    addOpenRef.current = addOpen;
    customerOpenRef.current = customerOpen;
    checkoutOpenRef.current = checkoutOpen;
    deleteTargetRef.current = deleteTarget;
    cartRef.current = cart;
    checkoutRef.current = handleOpenCheckout;
    newBillRef.current = handleNewBill;
  });

  const handleOpenCheckout = () => {
    if (cart.items.length === 0 || submitting) return;

    // Flush any pending price-input changes
    const active = document.activeElement as HTMLElement | null;
    if (active && active.tagName === "INPUT" && (active as HTMLInputElement).type === "number") {
      flushSync(() => {
        active.blur();
      });
    }

    if (rxBlocked) {
      toast.error("Prescription reference is required for Rx items. Add it below.");
      return;
    }

    setCheckoutStep("payment");
    setCheckoutOpen(true);
  };

  const executeSaveBill = async () => {
    if (cart.items.length === 0 || submitting) return;

    if (rxBlocked) {
      toast.error("Prescription reference is required for Rx items. Add it below.");
      return;
    }

    const isWalkIn =
      !cart.customer.name?.trim() ||
      cart.customer.name.trim().toLowerCase() === "walk-in customer" ||
      cart.customer.name.trim().toLowerCase() === "walk-in" ||
      cart.customer.name.trim().toLowerCase() === "walkin";

    if (!isWalkIn && cart.customer.name && !cart.customer.phone?.trim()) {
      toast.error("Phone number is mandatory when adding a registered customer.");
      return;
    }

    if (cart.paymentMethod === "credit" && (isWalkIn || !cart.customer.phone?.trim())) {
      toast.error("Credit sales cannot be generated for Walk-in Customers.", {
        description:
          "Customer name and phone number are required for credit. Walk-in customers can only pay with Cash or Online.",
      });
      setCheckoutStep("payment");
      return;
    }

    setSubmitting(true);
    try {
      const baseNotes = (cart.customer.notes || "").trim();
      const rxParts: string[] = [];
      if (hasRx && prescriptionRef) rxParts.push(`Rx ref: ${prescriptionRef}`);
      if (hasRx && prescriptionPhoto) rxParts.push("Rx photo: attached");
      const combinedNotes = [baseNotes, ...rxParts].filter(Boolean).join("\n");

      const bill = await billsStore.add({
        draftId: cart.activeDraftId || undefined,
        customerName: cart.customer.name || undefined,
        customerPhone: cart.customer.phone || undefined,
        customerAddress: cart.customer.address || undefined,
        customerDrugLicNo: cart.customer.drugLicNo || undefined,
        customerGstin: cart.customer.gstin || undefined,
        customerNotes: combinedNotes || undefined,
        cashier: session?.name,
        paymentMethod: cart.paymentMethod,
        advanceAmount: cart.advanceAmount,
        advancePaymentMethod: cart.advanceAmount > 0 ? cart.advancePaymentMethod : undefined,
        discount: cart.discount,
        items: cart.items.map((i) => ({
          productId: i.product.id,
          name: i.product.name,
          sku: i.product.sku,
          price: i.customPrice ?? i.product.price,
          costPrice: i.product.costPrice,
          qty: i.qty - (i.freeQty || 0),
          freeQty: i.freeQty || 0,
          taxPercent: i.product.taxPercent ?? 0,
          mrp: i.product.mrp,
          batch: i.product.batch,
          pack: i.product.pack,
          expiry: i.product.expiry,
        })),
        subtotal: cart.subtotal,
        tax: cart.tax,
        total: cart.total,
      });

      if (!session?.isEmployee) {
        toast.success(`Bill ${bill.number} generated`);
      } else {
        toast.success(`Bill ${bill.number} submitted for Admin confirmation (Pending)`);
      }

      setCheckoutOpen(false);
      cart.clear({ removeDraft: true });
      navigate({ to: "/bills/$id", params: { id: bill.id } });
    } catch (e: any) {
      const msg = (e as Error).message || "Failed to generate bill";
      toast.error(msg);
      if (msg.includes("already been completed or deleted")) {
        setCheckoutOpen(false);
        cart.clear({ removeDraft: false });
        navigate({ to: "/bills", search: { status: "completed" } });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Cart keyboard handler — registered once, reads live values via refs ──────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement)?.isContentEditable;

      // Alt+B → Browse & Add Item (always)
      if (e.altKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        e.stopPropagation();
        setAddOpen(true);
        return;
      }

      // F9 / Ctrl+S / End → Open Checkout Payment Modal
      if (
        (e.key === "F9" || (e.ctrlKey && e.key.toLowerCase() === "s") || e.key === "End") &&
        !isTyping
      ) {
        e.preventDefault();
        checkoutRef.current?.();
        return;
      }

      // F2 / Ctrl+T / Alt+N → New Bill
      if (
        (e.key === "F2" ||
          (e.ctrlKey && e.key.toLowerCase() === "t") ||
          (e.altKey && e.key.toLowerCase() === "n")) &&
        !isTyping
      ) {
        e.preventDefault();
        newBillRef.current?.();
        return;
      }

      // F3 → Modify Bill / Drafts
      if (e.key === "F3" && !isTyping) {
        e.preventDefault();
        setDraftsOpen(true);
        return;
      }

      // ── Item list navigation (only when not typing, no modal open) ──────
      if (
        isTyping ||
        addOpenRef.current ||
        customerOpenRef.current ||
        deleteTargetRef.current !== null
      )
        return;

      const items = cartRef.current.items;
      if (items.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((prev) => (prev < items.length - 1 ? prev + 1 : 0));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((prev) => (prev > 0 ? prev - 1 : items.length - 1));
        return;
      }

      const idx = selectedIdxRef.current;

      // Ctrl+Left / Ctrl+Right: adjust FREE qty of selected row
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && e.ctrlKey) {
        e.preventDefault();
        if (idx < 0) return;
        const item = items[idx];
        if (!item) return;
        const current = item.freeQty || 0;
        if (e.key === "ArrowLeft") {
          if (current > 0) cartRef.current.setFreeQty(item.product.id, current - 1);
        } else {
          if (current < item.qty) {
            cartRef.current.setFreeQty(item.product.id, current + 1);
          } else {
            toast.warning("Free qty cannot exceed total qty");
          }
        }
        return;
      }

      // Left/Right: adjust qty of selected row
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (idx < 0) return;
        e.preventDefault();
        const item = items[idx];
        if (!item) return;
        if (e.key === "ArrowLeft") {
          cartRef.current.setQty(item.product.id, item.qty - 1);
        } else {
          if (item.qty < item.product.stock) {
            cartRef.current.setQty(item.product.id, item.qty + 1);
          } else {
            toast.warning(`Only ${item.product.stock} in stock`);
          }
        }
        return;
      }

      // Delete / Backspace: open delete confirm for selected row
      if (e.key === "Delete" || e.key === "Backspace") {
        if (idx < 0) return;
        e.preventDefault();
        const item = items[idx];
        if (item) setDeleteTarget(item.product.id);
        return;
      }
    };

    const cartAddHandler = () => setAddOpen(true);
    const cartCheckoutHandler = () => void checkoutRef.current?.();
    window.addEventListener("keydown", handler);
    window.addEventListener("trigger-cart-add", cartAddHandler);
    window.addEventListener("trigger-cart-checkout", cartCheckoutHandler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("trigger-cart-add", cartAddHandler);
      window.removeEventListener("trigger-cart-checkout", cartCheckoutHandler);
    };
  }, []); // ← empty deps: listener added once, refs always hold latest values

  const hasCustomer =
    cart.customer.name.trim() || cart.customer.phone.trim() || cart.customer.notes.trim();

  // ── Inline Medicine Entry & Autocomplete State ─────────────────────────────
  const [entryQuery, setEntryQuery] = useState("");
  const [entryDropdownOpen, setEntryDropdownOpen] = useState(false);
  const [entryActiveIdx, setEntryActiveIdx] = useState(0);

  // ── 2D Cell Navigation Matrix Refs ─────────────────────────────────────────
  const cellRefs = useRef<{ [row: number]: { [col: number]: HTMLElement | null } }>({});

  const setCellRef = (row: number, col: number, el: HTMLElement | null) => {
    if (!cellRefs.current[row]) {
      cellRefs.current[row] = {};
    }
    cellRefs.current[row][col] = el;
  };

  const focusCell = (row: number, col: number) => {
    const el = cellRefs.current[row]?.[col];
    if (el) {
      el.focus();
      setSelectedIdx(row);
    }
  };

  const handleCellNav = (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
    if (e.key === "Enter" || e.key === "ArrowRight") {
      e.preventDefault();
      if (colIdx < 9) {
        focusCell(rowIdx, colIdx + 1);
      } else {
        // Reached end of row -> jump to search box for next item!
        entryInputRef.current?.focus();
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (colIdx > 0) {
        focusCell(rowIdx, colIdx - 1);
      } else {
        entryInputRef.current?.focus();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIdx < cart.items.length - 1) {
        focusCell(rowIdx + 1, colIdx);
      } else {
        entryInputRef.current?.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIdx > 0) {
        focusCell(rowIdx - 1, colIdx);
      }
    } else if (e.key === "Delete") {
      const item = cart.items[rowIdx];
      if (item) setDeleteTarget(item.product.id);
    }
  };

  // Autofocus the medicine search box on initial load
  useEffect(() => {
    const t = setTimeout(() => {
      entryInputRef.current?.focus();
    }, 120);
    return () => clearTimeout(t);
  }, []);

  const entryMatches = useMemo(() => {
    const q = entryQuery.trim().toLowerCase();
    if (!q) return [];
    return productList
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q) ||
          (p.category ?? "").toLowerCase().includes(q),
      )
      .slice(0, 10);
  }, [productList, entryQuery]);

  const handleAddProduct = (p: Product) => {
    const targetRow = cart.items.length;
    const activeBatches = p.batches ? p.batches.filter((b) => b.stock > 0) : [];
    if (activeBatches.length > 1) {
      cart.add(activeBatches[0], 1);
      toast.success(`${p.name} added (Batch ${activeBatches[0].batch})`);
    } else if (activeBatches.length === 1) {
      cart.add(activeBatches[0], 1);
      toast.success(`${p.name} added`);
    } else {
      cart.add(p, 1);
      toast.success(`${p.name} added`);
    }
    setEntryQuery("");
    setEntryDropdownOpen(false);
    setEntryActiveIdx(0);

    // Autofocus advances box-by-box into the added row
    setTimeout(() => {
      setSelectedIdx(targetRow);
      focusCell(targetRow, 1); // Focuses PACK box, user can hit Enter/Right Arrow to cycle to QTY, PCS, RATE, etc.
    }, 60);
  };

  const handleEntryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (entryMatches.length > 0) {
        setEntryActiveIdx((prev) => (prev < entryMatches.length - 1 ? prev + 1 : 0));
      } else if (cart.items.length > 0) {
        focusCell(0, 0);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (entryMatches.length > 0) {
        setEntryActiveIdx((prev) => (prev > 0 ? prev - 1 : entryMatches.length - 1));
      } else if (cart.items.length > 0) {
        focusCell(cart.items.length - 1, 0);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (entryMatches.length > 0 && entryMatches[entryActiveIdx]) {
        const p = entryMatches[entryActiveIdx];
        if (p.stock > 0) {
          handleAddProduct(p);
        } else {
          toast.warning(`${p.name} is out of stock`);
        }
      }
    } else if (e.key === "Escape") {
      setEntryDropdownOpen(false);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        entryDropdownRef.current &&
        !entryDropdownRef.current.contains(e.target as Node) &&
        entryInputRef.current &&
        !entryInputRef.current.contains(e.target as Node)
      ) {
        setEntryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll active suggestion into view
  useEffect(() => {
    if (entryDropdownRef.current) {
      const activeEl = entryDropdownRef.current.querySelector<HTMLElement>(
        "[data-active-match='true']",
      );
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [entryActiveIdx]);

  // Focus and cell navigation state matching reference
  const [customerFocused, setCustomerFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [doctorFocused, setDoctorFocused] = useState(false);
  const [entryFocused, setEntryFocused] = useState(false);
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
  const [discountPctFocused, setDiscountPctFocused] = useState(false);
  const [discountFlatFocused, setDiscountFlatFocused] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 720,
  });

  const grossTotal = isRetailer ? cart.subtotal + cart.tax : cart.subtotal;
  const roundOff = cart.total - (cart.subtotal + cart.tax - cart.discount);
  const billDiscountPct =
    cart.subtotal > 0 && cart.discount > 0 ? (cart.discount / cart.subtotal) * 100 : 0;
  const billDiscountPctStr =
    billDiscountPct > 0
      ? ` (${billDiscountPct % 1 === 0 ? billDiscountPct.toFixed(0) : billDiscountPct.toFixed(1)}%)`
      : "";

  const isCellFocused = (r: number, c: number) => focusedCell?.row === r && focusedCell?.col === c;

  useEffect(() => {
    if (entryDropdownOpen && entryInputRef.current) {
      const rect = entryInputRef.current.getBoundingClientRect();
      setDropdownPos({
        top: Math.round(rect.bottom + 2),
        left: Math.round(rect.left),
        width: Math.max(Math.round(rect.width + 450), 720),
      });
    }
  }, [entryDropdownOpen, entryQuery]);

  const selectedItem =
    selectedIdx >= 0 && selectedIdx < cart.items.length ? cart.items[selectedIdx] : null;
  const selectedPps = selectedItem
    ? getPiecesPerStrip(
        selectedItem.product.pack,
        selectedItem.product.stockType,
        selectedItem.product.conversionFactor,
      )
    : 1;

  return (
    <div className="-m-2 sm:-m-3 md:-m-3.5 min-h-[calc(100vh-68px)] flex-1 flex flex-col justify-between overflow-hidden bg-slate-50 text-slate-900 select-none">
      {/* ─── Draft / Edit Restored Banner ─────────────────────────────────── */}
      {cart.activeDraftRestored && (
        <div className="bg-amber-400 text-slate-950 px-4 py-2 border-b border-amber-500 shadow-xs flex items-center justify-between no-print animate-fadeIn shrink-0">
          <div className="flex items-center gap-3">
            <span className="bg-slate-950 text-amber-300 text-[11px] font-black px-2.5 py-0.5 rounded uppercase tracking-wider shadow-xs">
              ⚠️ DRAFT IN PROGRESS
            </span>
            <span className="text-xs font-bold">
              Editing Bill:{" "}
              <strong className="font-mono text-sm underline decoration-slate-900">
                {cart.activeDraftId ? "Draft Bill" : "Bill #1"}
              </strong>
            </span>
            <span className="text-[11px] text-amber-950/80 font-medium hidden sm:inline">
              • Your in-progress bill was preserved. You can edit items and generate the bill when
              ready.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setDraftsOpen(true)}
              className="bg-amber-200 hover:bg-amber-100 text-slate-950 text-xs font-bold px-3 py-1 rounded shadow-xs border border-amber-500/30 cursor-pointer flex items-center gap-1"
            >
              📜 View Drafts ({cart.drafts.length})
            </button>
            <button
              type="button"
              onClick={() => cart.dismissRestoredBanner()}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded shadow-xs cursor-pointer"
            >
              ✕ Discard / Exit
            </button>
          </div>
        </div>
      )}

      {/* ─── SECTION A: Bill Tabs Header (xv) ───────────────────────────────── */}
      <div className="no-print shrink-0">
        <div className="bg-slate-200 border-b border-slate-300 px-2 pt-1.5 flex items-center justify-between gap-2 select-none overflow-x-auto">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {/* Active Tab */}
            <div className="group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-semibold cursor-pointer border-t border-x transition-all shrink-0 bg-white text-blue-900 border-slate-300 shadow-xs border-t-2 border-t-blue-600 font-bold">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-mono bg-blue-100 text-blue-700 font-bold">
                  1
                </span>
                <span className="font-mono text-slate-900">
                  {cart.activeDraftId ? "DRAFT" : "#INV-NEW"}
                </span>
                {cart.activeDraftId && (
                  <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded shadow-2xs uppercase">
                    DRAFT
                  </span>
                )}
                <span className="text-slate-400">•</span>
                <span className="max-w-[120px] truncate text-slate-800">
                  {cart.customer.name.trim() || "Walk-in"}
                </span>
                {cart.total > 0 && (
                  <span className="font-mono text-[11px] text-emerald-700 bg-emerald-50 px-1 rounded">
                    ₹{cart.total.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            {/* Inactive Saved Draft Tabs */}
            {cart.drafts.map((d, dIdx) => {
              if (d.id === cart.activeDraftId) return null;
              return (
                <div
                  key={d.id}
                  onClick={() => {
                    cart.loadDraft(d.id);
                    toast.success(`Switched to ${d.name}`);
                  }}
                  className="group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-semibold cursor-pointer border-t border-x transition-all shrink-0 bg-slate-100/90 text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-800"
                  title={`Switch to draft: ${d.name}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-mono bg-slate-200 text-slate-600">
                      {dIdx + 2}
                    </span>
                    <span className="font-mono text-slate-900">{d.name}</span>
                    <span className="text-slate-400">•</span>
                    <span className="max-w-[120px] truncate text-slate-800">
                      {d.customer?.name?.trim() || "Walk-in"}
                    </span>
                    {d.total > 0 && (
                      <span className="font-mono text-[11px] text-emerald-700 bg-emerald-50 px-1 rounded">
                        ₹{d.total.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      cart.deleteDraft(d.id);
                      toast.info(`Deleted draft ${d.name}`);
                    }}
                    title="Close tab"
                    className="w-4 h-4 rounded hover:bg-red-100 hover:text-red-600 text-slate-400 text-[11px] flex items-center justify-center transition-colors"
                  >
                    ✕
                  </button>
                </div>
              );
            })}

            {/* New Bill Button */}
            <button
              type="button"
              onClick={handleNewBill}
              title="New Bill Tab (F2 / Alt+N)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-bold text-slate-700 hover:text-blue-700 hover:bg-white/80 transition-colors cursor-pointer"
            >
              <span className="text-sm">➕</span>
              <span>New Bill</span>
              <kbd className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded shadow-xs">
                F2
              </kbd>
            </button>

            {/* Modify Bill Button */}
            <button
              type="button"
              onClick={() => setDraftsOpen(true)}
              title="Modify / Edit Existing Bill (F3)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-bold text-amber-800 hover:text-amber-950 hover:bg-amber-100/80 transition-colors cursor-pointer"
            >
              <span className="text-sm">✏️</span>
              <span>Modify Bill</span>
              <kbd className="text-[10px] font-mono font-bold text-amber-900 bg-amber-200 border border-amber-300 px-1.5 py-0.5 rounded shadow-xs">
                F3
              </kbd>
            </button>

            {/* Browse Catalog Button */}
            <button
              ref={browseButtonRef}
              type="button"
              onClick={() => setAddOpen(true)}
              id="cart-browse-btn"
              title="Browse Catalog (Alt+B)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-bold text-slate-700 hover:text-blue-700 hover:bg-white/80 transition-colors cursor-pointer"
            >
              <span className="text-sm">📦</span>
              <span>Browse Catalog</span>
              <kbd className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded shadow-xs">
                Alt+B
              </kbd>
            </button>
          </div>

          {/* Right side of Tabs bar */}
          <div className="flex items-center gap-3 pr-2 shrink-0">
            {cart.drafts.length > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-600 font-mono text-[10px]">
                <span>⏳</span>
                <span>{cart.drafts.length} Saved</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── SECTION B: Customer / Doctor / Date Header Bar (ov) ───────────── */}
      <div className="no-print shrink-0">
        <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-4 text-xs select-none">
          <div className="flex items-center gap-4 flex-1">
            {/* Date */}
            <div className="flex flex-col w-28">
              <span className="text-[10px] uppercase font-bold text-slate-400">Date</span>
              <input
                type="text"
                readOnly
                value={new Date().toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
                className="font-mono font-medium rounded px-2 py-0.5 outline-none text-center transition-colors text-slate-800 bg-slate-50 border border-slate-200 cursor-default"
              />
            </div>

            {/* Patient / Party Name */}
            <div className="flex flex-col flex-1 max-w-[260px] relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Patient / Party Name
                </span>
                <button
                  type="button"
                  onClick={() => setCustomerOpen(true)}
                  className="text-[10px] text-blue-600 hover:underline font-semibold"
                >
                  {hasCustomer ? "Edit" : "Details"}
                </button>
              </div>
              <input
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Patient / Party Name"
                value={cart.customer.name}
                onChange={(e) => cart.setCustomer({ ...cart.customer, name: e.target.value })}
                onFocus={() => setCustomerFocused(true)}
                onBlur={() => setCustomerFocused(false)}
                className={cn(
                  "font-medium rounded px-2 py-0.5 outline-none transition-colors",
                  customerFocused
                    ? "!bg-blue-600 !border-blue-600 !text-white placeholder:!text-white/70"
                    : "text-slate-800 bg-slate-50 border border-slate-200",
                )}
              />
            </div>

            {/* Mobile No. */}
            <div className="flex flex-col w-36">
              <span className="text-[10px] uppercase font-bold text-slate-400">Mobile No.</span>
              <input
                type="tel"
                autoComplete="off"
                spellCheck={false}
                placeholder="Mobile No"
                value={cart.customer.phone}
                onChange={(e) => cart.setCustomer({ ...cart.customer, phone: e.target.value })}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                className={cn(
                  "font-mono rounded px-2 py-0.5 outline-none transition-colors",
                  phoneFocused
                    ? "!bg-blue-600 !border-blue-600 !text-white placeholder:!text-white/70"
                    : "text-slate-800 bg-slate-50 border border-slate-200",
                )}
              />
            </div>

            {/* Prescribing Doctor */}
            <div className="flex flex-col flex-1 max-w-[320px] relative">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Prescribing Doctor
              </span>
              <input
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Doctor Name (Optional)"
                value={cart.customer.prescriptionRef || ""}
                onChange={(e) =>
                  cart.setCustomer({ ...cart.customer, prescriptionRef: e.target.value })
                }
                onFocus={() => setDoctorFocused(true)}
                onBlur={() => setDoctorFocused(false)}
                className={cn(
                  "font-medium rounded px-2 py-0.5 outline-none transition-colors",
                  doctorFocused
                    ? "!bg-blue-600 !border-blue-600 !text-white placeholder:!text-white/70"
                    : "text-slate-800 bg-slate-50 border border-slate-200",
                )}
              />
            </div>
          </div>

          {/* Invoice No */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase font-bold text-slate-400">Invoice No</span>
              <span className="font-mono font-bold text-blue-700 text-sm">
                {cart.activeDraftId ? "DRAFT" : "#INV-NEW"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECTION C: Main Billing Area ───────────────────────────────────── */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2.5 gap-2.5 no-print">
        {/* Left Column: Medicine Grid + Product Details Panel */}
        <div className="flex-1 flex flex-col gap-2.5 overflow-hidden min-w-0">
          {/* Medicine Table Container (cv) */}
          <div className="flex-[3] clean-card rounded-lg flex flex-col overflow-hidden relative min-h-[420px]">
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse">
                <thead className="bg-slate-100/90 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider select-none">
                  <tr>
                    <th className="px-2 py-2 text-center w-8">#</th>
                    <th className="px-2 py-2 text-left w-[300px]">Product / Medicine Name</th>
                    <th className="px-2 py-2 text-center w-16">Pack</th>
                    <th className="px-2 py-2 text-center w-20">Batch</th>
                    <th className="px-2 py-2 text-center w-16">Exp</th>
                    <th className="px-2 py-2 text-center w-14">Qty</th>
                    <th className="px-2 py-2 text-center w-14">Pcs</th>
                    <th className="px-2 py-2 text-right w-20">MRP (₹)</th>
                    <th className="px-2 py-2 text-center w-14">Dis%</th>
                    <th className="px-2 py-2 text-center w-14">GST%</th>
                    <th className="px-2 py-2 text-right w-24">Net (₹)</th>
                    <th className="px-2 py-2 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.items.map((i, idx) => {
                    const isSelected = idx === selectedIdx;
                    const parentProduct = productList.find((p) => p.id === i.product.productId);
                    const activeBatches =
                      parentProduct?.batches?.filter((b) => b.stock > 0 || b.id === i.product.id) ||
                      [];
                    const pps = getPiecesPerStrip(
                      i.product.pack,
                      i.product.stockType,
                      i.product.conversionFactor,
                    );
                    const isDual =
                      isRetailer &&
                      (pps > 1 || isTabOrCap(i.product.stockType, i.product.pack, i.product.name));
                    const { strips, pcs } = isDual
                      ? splitQtyToStripAndPc(i.qty, pps)
                      : { strips: i.qty, pcs: 0 };

                    const mrp = i.product.mrp || i.product.price || 0;
                    const rate = i.customPrice ?? i.product.price;
                    const rowDis =
                      mrp > rate && mrp > 0 ? (((mrp - rate) / mrp) * 100).toFixed(0) : "0";

                    return (
                      <tr
                        key={i.product.id}
                        ref={(el) => {
                          itemRefs.current[idx] = el;
                        }}
                        onClick={() => setSelectedIdx(idx)}
                        className={cn(
                          "border-b border-slate-200 transition-colors text-xs cursor-pointer",
                          isSelected
                            ? "bg-amber-50/70 border-l-4 border-l-amber-500"
                            : "hover:bg-slate-50 border-l-4 border-l-transparent",
                        )}
                      >
                        {/* 1. # */}
                        <td className="px-2 py-1 text-center text-slate-400 font-mono text-[11px] w-8">
                          {idx + 1}
                        </td>

                        {/* 2. Product Name */}
                        <td
                          ref={(el) => setCellRef(idx, 0, el)}
                          tabIndex={0}
                          onFocus={() => {
                            setFocusedCell({ row: idx, col: 0 });
                            setSelectedIdx(idx);
                          }}
                          onBlur={() => setFocusedCell(null)}
                          onKeyDown={(e) => handleCellNav(e, idx, 0)}
                          className={cn(
                            "px-2 py-1 text-left w-[300px] relative transition-colors outline-none",
                            isCellFocused(idx, 0) ? "!bg-blue-600 !text-white" : "",
                          )}
                        >
                          <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                            <span
                              className={cn(
                                "truncate font-semibold",
                                isCellFocused(idx, 0) ? "text-white" : "text-slate-900",
                              )}
                            >
                              {i.product.name}
                            </span>
                            {i.product.prescription && (
                              <span
                                className={cn(
                                  "shrink-0 inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded uppercase leading-none whitespace-nowrap",
                                  isCellFocused(idx, 0)
                                    ? "bg-blue-800 text-white"
                                    : "bg-red-100 text-red-700 border border-red-200",
                                )}
                                title="Prescription required (Rx)"
                              >
                                Rx
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. Pack */}
                        <td
                          ref={(el) => setCellRef(idx, 1, el)}
                          tabIndex={0}
                          onFocus={() => {
                            setFocusedCell({ row: idx, col: 1 });
                            setSelectedIdx(idx);
                          }}
                          onBlur={() => setFocusedCell(null)}
                          onKeyDown={(e) => handleCellNav(e, idx, 1)}
                          className={cn(
                            "px-2 py-1 w-16 text-center font-mono text-[11px] outline-none select-none transition-colors",
                            isCellFocused(idx, 1)
                              ? "!bg-blue-600 !text-white font-bold"
                              : "text-slate-600",
                          )}
                        >
                          {i.product.pack || "—"}
                        </td>

                        {/* 4. Batch */}
                        <td
                          ref={(el) => setCellRef(idx, 2, el)}
                          tabIndex={0}
                          onFocus={() => {
                            setFocusedCell({ row: idx, col: 2 });
                            setSelectedIdx(idx);
                          }}
                          onBlur={() => setFocusedCell(null)}
                          onKeyDown={(e) => handleCellNav(e, idx, 2)}
                          className={cn(
                            "px-2 py-1 w-20 text-center font-semibold font-mono text-[11px] outline-none transition-colors",
                            isCellFocused(idx, 2) ? "!bg-blue-600 !text-white" : "text-slate-700",
                          )}
                        >
                          {activeBatches.length > 1 ? (
                            <select
                              className={cn(
                                "bg-transparent border-0 outline-none w-full text-center font-mono font-semibold text-[11px] cursor-pointer",
                                isCellFocused(idx, 2) ? "text-white" : "text-slate-700",
                              )}
                              value={i.product.id}
                              onChange={(e) => {
                                const newBatch = activeBatches.find((b) => b.id === e.target.value);
                                if (newBatch) {
                                  cart.switchBatch(i.product.id, newBatch);
                                  toast.success(`Switched to batch ${newBatch.batch}`);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {activeBatches.map((b) => (
                                <option key={b.id} value={b.id} className="text-slate-900 bg-white">
                                  {String(b.batch || "No Batch").toUpperCase()}
                                </option>
                              ))}
                            </select>
                          ) : (
                            String(i.product.batch || "—").toUpperCase()
                          )}
                        </td>

                        {/* 5. Exp */}
                        <td
                          ref={(el) => setCellRef(idx, 3, el)}
                          tabIndex={0}
                          onFocus={() => {
                            setFocusedCell({ row: idx, col: 3 });
                            setSelectedIdx(idx);
                          }}
                          onBlur={() => setFocusedCell(null)}
                          onKeyDown={(e) => handleCellNav(e, idx, 3)}
                          className={cn(
                            "px-2 py-1 w-16 text-center font-mono text-[11px] outline-none select-none transition-colors",
                            isCellFocused(idx, 3)
                              ? "!bg-blue-600 !text-white font-bold"
                              : "text-slate-600",
                          )}
                        >
                          {i.product.expiry
                            ? new Date(i.product.expiry).toLocaleDateString("en-IN", {
                                month: "2-digit",
                                year: "2-digit",
                              })
                            : "—"}
                        </td>

                        {/* 6. Qty */}
                        <td
                          ref={(el) => setCellRef(idx, 4, el)}
                          tabIndex={0}
                          onFocus={() => {
                            setFocusedCell({ row: idx, col: 4 });
                            setSelectedIdx(idx);
                          }}
                          onBlur={() => setFocusedCell(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "ArrowRight") {
                              e.preventDefault();
                              focusCell(idx, 5);
                            } else if (e.key === "ArrowLeft") {
                              e.preventDefault();
                              focusCell(idx, 3);
                            } else if (e.key === "ArrowDown") {
                              e.preventDefault();
                              if (idx < cart.items.length - 1) focusCell(idx + 1, 4);
                              else entryInputRef.current?.focus();
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              if (idx > 0) focusCell(idx - 1, 4);
                            }
                          }}
                          className={cn(
                            "px-2 py-1 w-14 text-center transition-colors outline-none",
                            isCellFocused(idx, 4) ? "!bg-blue-600 !text-white" : "",
                          )}
                        >
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            spellCheck={false}
                            value={isDual ? strips : i.qty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (isNaN(val) || val < 0) return;
                              if (isDual) {
                                const newQty = combineStripAndPcToQty(val, pcs, pps);
                                cart.setQty(i.product.id, newQty);
                              } else {
                                cart.setQty(i.product.id, val);
                              }
                            }}
                            className={cn(
                              "w-full text-center bg-transparent font-mono font-bold outline-none",
                              isCellFocused(idx, 4) ? "!text-white" : "text-slate-900",
                            )}
                          />
                        </td>

                        {/* 7. Pcs */}
                        <td
                          ref={(el) => setCellRef(idx, 5, el)}
                          tabIndex={0}
                          onFocus={() => {
                            setFocusedCell({ row: idx, col: 5 });
                            setSelectedIdx(idx);
                          }}
                          onBlur={() => setFocusedCell(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "ArrowRight") {
                              e.preventDefault();
                              focusCell(idx, 6);
                            } else if (e.key === "ArrowLeft") {
                              e.preventDefault();
                              focusCell(idx, 4);
                            } else if (e.key === "ArrowDown") {
                              e.preventDefault();
                              if (idx < cart.items.length - 1) focusCell(idx + 1, 5);
                              else entryInputRef.current?.focus();
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              if (idx > 0) focusCell(idx - 1, 5);
                            }
                          }}
                          className={cn(
                            "px-2 py-1 w-14 text-center transition-colors outline-none",
                            isCellFocused(idx, 5) ? "!bg-blue-600 !text-white" : "",
                          )}
                        >
                          {isDual ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              spellCheck={false}
                              value={pcs}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (isNaN(val) || val < 0) return;
                                const newQty = combineStripAndPcToQty(strips, val, pps);
                                cart.setQty(i.product.id, newQty);
                              }}
                              className={cn(
                                "w-full text-center bg-transparent font-mono outline-none",
                                isCellFocused(idx, 5)
                                  ? "!text-white font-semibold"
                                  : "text-slate-700",
                              )}
                            />
                          ) : (
                            <span
                              className={cn(
                                "font-mono text-[11px]",
                                isCellFocused(idx, 5) ? "text-white" : "text-slate-400",
                              )}
                            >
                              0
                            </span>
                          )}
                        </td>

                        {/* 8. MRP (₹) */}
                        <td
                          ref={(el) => setCellRef(idx, 6, el)}
                          tabIndex={0}
                          onFocus={() => {
                            setFocusedCell({ row: idx, col: 6 });
                            setSelectedIdx(idx);
                          }}
                          onBlur={() => setFocusedCell(null)}
                          onKeyDown={(e) => handleCellNav(e, idx, 6)}
                          className={cn(
                            "px-2 py-1 w-20 text-right transition-colors outline-none",
                            isCellFocused(idx, 6) ? "!bg-blue-600 !text-white" : "",
                          )}
                        >
                          <span
                            className={cn(
                              "font-mono font-semibold",
                              isCellFocused(idx, 6) ? "!text-white" : "text-slate-800",
                            )}
                          >
                            {mrp > 0 ? mrp.toFixed(2) : "0.00"}
                          </span>
                        </td>

                        {/* 9. Dis% */}
                        <td
                          ref={(el) => setCellRef(idx, 7, el)}
                          tabIndex={0}
                          onFocus={() => {
                            setFocusedCell({ row: idx, col: 7 });
                            setSelectedIdx(idx);
                          }}
                          onBlur={() => setFocusedCell(null)}
                          onKeyDown={(e) => handleCellNav(e, idx, 7)}
                          className={cn(
                            "px-2 py-1 w-14 text-center transition-colors outline-none",
                            isCellFocused(idx, 7) ? "!bg-blue-600 !text-white" : "",
                          )}
                        >
                          <span
                            className={cn(
                              "font-mono",
                              isCellFocused(idx, 7)
                                ? "!text-white font-semibold"
                                : "text-slate-700",
                            )}
                          >
                            {rowDis}%
                          </span>
                        </td>

                        {/* 10. GST% */}
                        <td
                          ref={(el) => setCellRef(idx, 8, el)}
                          tabIndex={0}
                          onFocus={() => {
                            setFocusedCell({ row: idx, col: 8 });
                            setSelectedIdx(idx);
                          }}
                          onBlur={() => setFocusedCell(null)}
                          onKeyDown={(e) => handleCellNav(e, idx, 8)}
                          className={cn(
                            "px-2 py-1 w-14 text-center font-mono text-[11px] outline-none select-none transition-colors",
                            isCellFocused(idx, 8)
                              ? "!bg-blue-600 !text-white font-bold"
                              : "text-slate-500",
                          )}
                        >
                          {i.product.taxPercent != null
                            ? `${i.product.taxPercent}%`
                            : isRetailer
                              ? "5%"
                              : "0%"}
                        </td>

                        {/* 11. Net (₹) */}
                        <td
                          ref={(el) => setCellRef(idx, 9, el)}
                          tabIndex={0}
                          onFocus={() => {
                            setFocusedCell({ row: idx, col: 9 });
                            setSelectedIdx(idx);
                          }}
                          onBlur={() => setFocusedCell(null)}
                          onKeyDown={(e) => handleCellNav(e, idx, 9)}
                          className={cn(
                            "px-2 py-1 w-24 text-right font-mono font-bold outline-none select-none transition-colors",
                            isCellFocused(idx, 9) ? "!bg-blue-600 !text-white" : "text-slate-900",
                          )}
                        >
                          ₹
                          {(
                            (i.customPrice ?? i.product.price) *
                            (i.qty - (i.freeQty || 0))
                          ).toFixed(2)}
                        </td>

                        {/* 12. Delete Action */}
                        <td
                          className="px-2 py-1 w-8 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(i.product.id)}
                            className="text-slate-300 hover:text-red-500 font-bold text-xs cursor-pointer"
                            title="Delete row"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* ── Active Inline Medicine Entry Row (cv) ── */}
                  <tr className="border-b border-slate-200 transition-colors text-xs bg-slate-50/50 hover:bg-slate-50">
                    {/* # */}
                    <td className="px-2 py-1 text-center text-slate-400 font-mono text-[11px] w-8">
                      {cart.items.length + 1}
                    </td>

                    {/* Product Name Input */}
                    <td
                      className={cn(
                        "px-2 py-1 text-left w-[300px] relative transition-colors",
                        entryFocused ? "!bg-blue-600 !text-white" : "",
                      )}
                    >
                      <input
                        id={`cell-${cart.items.length}-name`}
                        ref={entryInputRef}
                        type="text"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={entryQuery}
                        onFocus={() => {
                          setEntryFocused(true);
                          if (entryQuery.trim()) setEntryDropdownOpen(true);
                        }}
                        onBlur={() => setEntryFocused(false)}
                        onChange={(e) => {
                          setEntryQuery(e.target.value);
                          setEntryDropdownOpen(true);
                          setEntryActiveIdx(0);
                        }}
                        onKeyDown={handleEntryKeyDown}
                        placeholder={
                          entryFocused ? "TYPE PRODUCT NAME..." : "Type medicine name..."
                        }
                        className={cn(
                          "w-full bg-transparent font-semibold outline-none uppercase placeholder:normal-case text-left",
                          entryFocused
                            ? "!text-white placeholder:!text-white/80 placeholder:!font-bold placeholder:!uppercase"
                            : "text-slate-900 placeholder:text-slate-400",
                        )}
                      />
                    </td>

                    <td className="px-2 py-1 w-16 text-center text-slate-300 font-mono text-[11px] select-none">
                      —
                    </td>
                    <td className="px-2 py-1 w-20 text-center text-slate-300 font-mono text-[11px] select-none">
                      —
                    </td>
                    <td className="px-2 py-1 w-16 text-center text-slate-300 font-mono text-[11px] select-none">
                      —
                    </td>
                    <td className="px-2 py-1 w-14 text-center text-slate-300 font-mono text-[11px] select-none">
                      —
                    </td>
                    <td className="px-2 py-1 w-14 text-center text-slate-300 font-mono text-[11px] select-none">
                      —
                    </td>
                    <td className="px-2 py-1 w-20 text-right text-slate-300 font-mono text-[11px] select-none">
                      —
                    </td>
                    <td className="px-2 py-1 w-14 text-center text-slate-300 font-mono text-[11px] select-none">
                      —
                    </td>
                    <td className="px-2 py-1 w-14 text-center text-slate-300 font-mono text-[11px] select-none">
                      —
                    </td>
                    <td className="px-2 py-1 w-24 text-right text-slate-300 font-mono font-semibold text-[11px] select-none">
                      ₹0.00
                    </td>
                    <td className="px-2 py-1 w-8 text-center">
                      <button
                        type="button"
                        onClick={() => setAddOpen(true)}
                        className="text-slate-400 hover:text-blue-600 font-bold text-xs cursor-pointer"
                        title="Browse catalog (Alt+B)"
                      >
                        ➕
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── Autocomplete Match Dropdown (Su) ── */}
            {entryDropdownOpen && entryMatches.length > 0 && (
              <div
                ref={entryDropdownRef}
                style={{
                  top: `${dropdownPos.top}px`,
                  left: `${dropdownPos.left}px`,
                  width: `${dropdownPos.width}px`,
                }}
                className="fixed z-50 bg-white border border-slate-300 rounded-lg shadow-2xl overflow-hidden max-h-80 flex flex-col text-xs select-none animate-in fade-in zoom-in-95 duration-75"
              >
                <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600">🔍</span>
                    <span>Product Catalog Match ({entryMatches.length})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 font-normal text-[10px]">
                      ↑ / ↓ navigate • Enter select • F2 Add Product • Esc close
                    </span>
                    <button
                      type="button"
                      onClick={() => setEntryDropdownOpen(false)}
                      className="text-slate-400 hover:text-red-600 font-bold px-1.5 py-0.5 rounded hover:bg-slate-200 text-xs transition-colors cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                  {entryMatches.map((p, pIdx) => {
                    const isActive = pIdx === entryActiveIdx;
                    return (
                      <div
                        key={p.id}
                        data-active-match={isActive}
                        className={cn(
                          "px-3 py-2 flex items-center justify-between cursor-pointer transition-colors",
                          isActive ? "bg-blue-600 text-white" : "hover:bg-blue-50 text-slate-800",
                        )}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleAddProduct(p);
                        }}
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs">{p.name}</span>
                            {p.prescription && (
                              <span
                                className={cn(
                                  "text-[9px] px-1.5 py-0.2 rounded font-bold uppercase",
                                  isActive
                                    ? "bg-blue-800 text-white"
                                    : "bg-red-100 text-red-700 border border-red-200",
                                )}
                              >
                                Rx
                              </span>
                            )}
                          </div>
                          <div
                            className={cn(
                              "text-[11px]",
                              isActive ? "text-blue-100" : "text-slate-500",
                            )}
                          >
                            {p.manufacturer || p.category || "Pharma"} • Rack: {p.rack || "A1"} •
                            Pack: {p.pack || "10's"}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div className="flex flex-col">
                            <span
                              className={cn(
                                "text-[10px] uppercase font-bold",
                                isActive ? "text-blue-200" : "text-slate-400",
                              )}
                            >
                              Stock
                            </span>
                            <span
                              className={cn(
                                "font-mono font-bold text-xs",
                                isActive
                                  ? "text-white"
                                  : p.stock > 0
                                    ? "text-emerald-600"
                                    : "text-red-600",
                              )}
                            >
                              {formatQty(p.stock)}
                            </span>
                          </div>
                          {p.mrp && p.mrp > 0 && (
                            <div className="flex flex-col">
                              <span
                                className={cn(
                                  "text-[10px] uppercase font-bold",
                                  isActive ? "text-blue-200" : "text-slate-400",
                                )}
                              >
                                MRP
                              </span>
                              <span
                                className={cn(
                                  "font-mono text-xs",
                                  isActive ? "text-blue-100" : "text-slate-600",
                                )}
                              >
                                ₹{p.mrp.toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span
                              className={cn(
                                "text-[10px] uppercase font-bold",
                                isActive ? "text-blue-200" : "text-slate-400",
                              )}
                            >
                              Rate
                            </span>
                            <span
                              className={cn(
                                "font-mono font-bold text-xs",
                                isActive ? "text-white" : "text-blue-700",
                              )}
                            >
                              ₹{p.price.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Product Details Panel (dv) ── */}
          {selectedItem ? (
            <div className="h-16 bg-white border border-slate-200 rounded-lg px-4 py-2 flex items-center justify-between text-xs select-none shrink-0 shadow-2xs">
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Selected Product
                  </span>
                  <span className="font-bold text-slate-900 text-sm truncate max-w-[200px]">
                    {selectedItem.product.name}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Manufacturer
                  </span>
                  <span className="font-medium text-slate-700 truncate max-w-[150px]">
                    {selectedItem.product.manufacturer || selectedItem.product.category || "Pharma"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Location / Rack
                  </span>
                  <span className="font-mono font-bold text-blue-700">
                    {selectedItem.product.rack || selectedItem.product.category || "RACK-A1"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-6 text-right">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Pack / Unit
                  </span>
                  <span className="font-mono font-semibold text-slate-700">
                    {selectedItem.product.pack || "10's"} (Conv: {selectedPps})
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    Stock Availability
                  </span>
                  <span className="font-mono font-bold text-emerald-600">
                    {formatQty(selectedItem.product.stock)} Packs in stock
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-16 bg-white border border-slate-200 rounded-lg p-2.5 flex items-center justify-between text-xs text-slate-400 select-none shrink-0 shadow-2xs">
              <span>No product selected on active row.</span>
            </div>
          )}
        </div>

        {/* ── Right Column: Billing Summary Panel (pv) ── */}
        <div className="w-64 bg-white border border-slate-200 rounded-lg p-3 flex flex-col justify-between shadow-sm select-none shrink-0">
          <div className="flex flex-col gap-2.5">
            {/* Bill Discount Card */}
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <span>🏷️</span> Bill Discount
                  {billDiscountPctStr && (
                    <span className="text-emerald-700 font-mono font-bold text-[11px]">
                      {billDiscountPctStr}
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ₹{cart.subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "flex-1 flex items-center border rounded px-2 py-1 transition-colors",
                    discountPctFocused
                      ? "!bg-blue-600 !border-blue-600 !text-white"
                      : "bg-white border-slate-300",
                  )}
                >
                  <span
                    className={cn(
                      "text-[11px] font-mono mr-1 font-bold",
                      discountPctFocused ? "!text-white/80" : "text-slate-400",
                    )}
                  >
                    %
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={
                      cart.discountType === "percentage"
                        ? cart.discountValue || ""
                        : cart.subtotal > 0 && cart.discount > 0
                          ? ((cart.discount / cart.subtotal) * 100).toFixed(1)
                          : ""
                    }
                    onFocus={(e) => {
                      setDiscountPctFocused(true);
                      e.target.select();
                    }}
                    onBlur={() => setDiscountPctFocused(false)}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        cart.setDiscountType("percentage");
                        cart.setDiscountValue(val === "" ? 0 : parseFloat(val) || 0);
                      }
                    }}
                    className={cn(
                      "w-full text-right font-mono text-xs font-semibold outline-none bg-transparent",
                      discountPctFocused
                        ? "!text-white placeholder:!text-white/70"
                        : "text-slate-800",
                    )}
                  />
                </div>
                <div
                  className={cn(
                    "flex-1 flex items-center border rounded px-2 py-1 transition-colors",
                    discountFlatFocused
                      ? "!bg-blue-600 !border-blue-600 !text-white"
                      : "bg-white border-slate-300",
                  )}
                >
                  <span
                    className={cn(
                      "text-[11px] font-mono mr-1 font-bold",
                      discountFlatFocused ? "!text-white/80" : "text-slate-400",
                    )}
                  >
                    ₹
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={
                      cart.discountType === "flat"
                        ? cart.discountValue || ""
                        : cart.discount > 0
                          ? cart.discount.toFixed(2)
                          : ""
                    }
                    onFocus={(e) => {
                      setDiscountFlatFocused(true);
                      e.target.select();
                    }}
                    onBlur={() => setDiscountFlatFocused(false)}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        cart.setDiscountType("flat");
                        cart.setDiscountValue(val === "" ? 0 : parseFloat(val) || 0);
                      }
                    }}
                    className={cn(
                      "w-full text-right font-mono text-xs font-semibold outline-none bg-transparent",
                      discountFlatFocused
                        ? "!text-white placeholder:!text-white/70"
                        : "text-slate-800",
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Bill Summary Title */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                Bill Summary
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {cart.items.length} Items
              </span>
            </div>

            {/* Bill Summary Rows */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Gross Total</span>
                <span className="font-mono font-medium">₹{grossTotal.toFixed(2)}</span>
              </div>
              {cart.discount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Bill Discount{billDiscountPctStr}</span>
                  <span className="font-mono font-medium text-amber-600">
                    -₹{cart.discount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Taxable Value</span>
                <span className="font-mono font-medium">₹{cart.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>CGST</span>
                <span className="font-mono font-medium">₹{(cart.tax / 2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>SGST</span>
                <span className="font-mono font-medium">₹{(cart.tax / 2).toFixed(2)}</span>
              </div>
              {Math.abs(roundOff) >= 0.01 && (
                <div className="flex justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-100">
                  <span>Round Off</span>
                  <span className="font-mono">
                    {roundOff >= 0 ? "+" : ""}₹{roundOff.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Net Payable & Buttons */}
          <div className="pt-2.5 border-t border-slate-200 flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] uppercase font-bold text-slate-700">Net Payable</span>
              <span className="font-mono font-extrabold text-xl text-blue-700">
                ₹{cart.total.toFixed(2)}
              </span>
            </div>

            {hasRx && (
              <div className="bg-red-50 border border-red-200 rounded p-1.5 text-[10px] text-red-700 leading-tight">
                ⚠️ Contains <strong>Schedule H1 / Rx</strong> drugs.
              </div>
            )}

            {/* Save & Payment Button */}
            <button
              type="button"
              disabled={cart.items.length === 0 || submitting || rxBlocked}
              onClick={handleOpenCheckout}
              id="cart-checkout-btn"
              title="Save & Payment (Ctrl+S / End / F9)"
              className={cn(
                "w-full font-bold py-2 px-3 rounded shadow-sm transition-colors flex items-center justify-center gap-1.5 text-xs",
                cart.items.length === 0 || submitting || rxBlocked
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed opacity-60"
                  : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white cursor-pointer",
              )}
            >
              <span>Save & Payment</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-mono",
                  cart.items.length === 0 || submitting || rxBlocked
                    ? "bg-slate-400 text-slate-200"
                    : "bg-emerald-700 text-emerald-100",
                )}
              >
                Ctrl+S / End
              </span>
            </button>

            {/* Save as Draft Button */}
            {cart.items.length > 0 && (
              <button
                type="button"
                onClick={handleSaveDraft}
                className="w-full font-semibold py-1.5 px-3 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                title="Save current bill as draft"
              >
                <Save className="h-3 w-3 text-slate-500" />
                <span>Save as Draft</span>
              </button>
            )}
          </div>
        </div>
      </main>

      {/* ─── SECTION D: Compact Bottom Keyboard Shortcut Bar (ya) ─────────── */}
      <footer className="h-7 bg-white border-t border-slate-200 px-4 flex items-center justify-between text-[11px] text-slate-600 shrink-0 select-none">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-1 shrink-0">
            <kbd className="bg-slate-100 text-slate-800 px-1 py-0.2 rounded border border-slate-300 font-mono font-bold text-[9px]">
              ↑ ↓ ← →
            </kbd>
            <span className="truncate">Grid</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <kbd className="text-emerald-800 bg-emerald-100 border border-emerald-300 font-bold px-1 py-0.2 rounded font-mono text-[9px]">
              Ctrl+S / End
            </kbd>
            <span className="truncate">Payment & Save</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <kbd className="text-blue-800 bg-blue-100 border border-blue-300 px-1 py-0.2 rounded border font-mono font-bold text-[9px]">
              Ctrl+← / →
            </kbd>
            <span className="truncate">Switch Bill Tab</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <kbd className="bg-slate-100 text-slate-800 px-1 py-0.2 rounded border border-slate-300 font-mono font-bold text-[9px]">
              Ctrl+T
            </kbd>
            <span className="truncate">New Bill Tab</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <kbd className="bg-slate-100 text-slate-800 px-1 py-0.2 rounded border border-slate-300 font-mono font-bold text-[9px]">
              F3
            </kbd>
            <span className="truncate">Modify Bill / Edit</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <kbd className="bg-slate-100 text-slate-800 px-1 py-0.2 rounded border border-slate-300 font-mono font-bold text-[9px]">
              Alt+B
            </kbd>
            <span className="truncate">Catalog</span>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500 shrink-0">
          <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Local database</span>
            <span className="text-slate-300 font-normal">·</span>
            <span className="text-slate-600 font-normal">Ready</span>
            <span className="text-slate-300 font-normal">·</span>
            <span className="text-slate-500 font-normal">v1.0.3</span>
          </span>
        </div>
      </footer>

      {/* ─── Modals and Dialogs ────────────────────────────────────────────── */}
      <CustomerDetailsDialog open={customerOpen} onOpenChange={setCustomerOpen} />
      <CartAddDialog open={addOpen} onOpenChange={setAddOpen} />
      <DraftBillsDialog open={draftsOpen} onOpenChange={setDraftsOpen} />
      <CheckoutFlowDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        step={checkoutStep}
        setStep={setCheckoutStep}
        onConfirmBill={executeSaveBill}
        submitting={submitting}
        isRetailer={isRetailer}
        session={session}
      />

      {/* Delete confirmation dialog */}
      <CartDeleteConfirm
        productId={deleteTarget}
        items={cart.items}
        onConfirm={(id) => {
          cart.remove(id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── Delete Confirmation Dialog ───────────────────────────────────────────────

function CartDeleteConfirm({
  productId,
  items,
  onConfirm,
  onCancel,
}: {
  productId: string | null;
  items: Array<{ product: Product; qty: number }>;
  onConfirm: (id: string) => void;
  onCancel: () => void;
}) {
  const open = productId !== null;
  const item = items.find((i) => i.product.id === productId);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the confirm button so Enter key works immediately
  useEffect(() => {
    if (open) {
      setTimeout(() => confirmBtnRef.current?.focus(), 50);
    }
  }, [open]);

  // Handle Enter / Escape on the dialog
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (productId) onConfirm(productId);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, productId, onConfirm, onCancel]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Remove from cart?
          </DialogTitle>
        </DialogHeader>
        {item && (
          <div className="py-2">
            <p className="text-sm">
              Remove <span className="font-semibold">{item.product.name}</span>
              {item.product.pack && (
                <span className="ml-1 text-[11px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                  {item.product.pack}
                </span>
              )}{" "}
              (qty&nbsp;<span className="font-semibold">{item.qty}</span>) from the cart?
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              This action cannot be undone. Press{" "}
              <kbd className="rounded border bg-muted px-1 py-0.5 font-semibold">Enter</kbd> to
              confirm, <kbd className="rounded border bg-muted px-1 py-0.5 font-semibold">Esc</kbd>{" "}
              to cancel.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            ref={confirmBtnRef}
            variant="destructive"
            onClick={() => productId && onConfirm(productId)}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Remove item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CartAddDialog – Product Selector Modal ───────────────────────────────────

function CartAddDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const cart = useCart();
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadProducts = useCallback(() => {
    productsStore.list().then(setProducts);
  }, []);

  useEffect(() => {
    if (open) {
      loadProducts();
      setQuery("");
      setActiveIdx(0);
    }
  }, [open, loadProducts]);

  // Reset active index when query changes
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const filtered = useMemo(
    () =>
      products
        .filter((p) => {
          const q = query.toLowerCase();
          return (
            p.name.toLowerCase().includes(q) ||
            (p.sku ?? "").toLowerCase().includes(q) ||
            (p.category ?? "").toLowerCase().includes(q)
          );
        })
        .slice(0, 12),
    [products, query],
  );

  const onAdd = (p: Product) => {
    cart.add(p, 1);
    toast.success(`${p.name} added to cart`);
    onOpenChange(false);
  };

  const [batchesProduct, setBatchesProduct] = useState<Product | null>(null);
  const [selectedBatchIdx, setSelectedBatchIdx] = useState(0);

  const handleAddClick = (p: Product) => {
    const activeBatches = p.batches ? p.batches.filter((b) => b.stock > 0) : [];
    if (activeBatches.length > 1) {
      setBatchesProduct(p);
      setSelectedBatchIdx(0);
    } else if (activeBatches.length === 1) {
      onAdd(activeBatches[0]);
    } else {
      onAdd(p);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>("[data-product-item]");
    const el = items[activeIdx];
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx, filtered]);

  // Keyboard navigation inside the dialog
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (batchesProduct) {
      const activeBatches = batchesProduct.batches
        ? batchesProduct.batches.filter((b) => b.stock > 0)
        : [];
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedBatchIdx((i) => Math.min(i + 1, activeBatches.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedBatchIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const batch = activeBatches[selectedBatchIdx];
        if (batch) {
          onAdd(batch);
          setBatchesProduct(null);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setBatchesProduct(null);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = filtered[activeIdx];
      if (p && p.stock > 0) handleAddClick(p);
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  };

  // After add product dialog closes → refresh products list
  const handleAddProductClose = (open: boolean) => {
    setAddProductOpen(open);
    if (!open) {
      loadProducts();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-0 overflow-hidden gap-0" onKeyDown={handleKeyDown}>
          {/* Header bar */}
          <div className="flex items-center px-3 border-b">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              ref={searchRef}
              autoFocus
              placeholder="Search product to add…"
              className="border-0 focus-visible:ring-0 shadow-none text-base"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Keyboard hint bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Keyboard className="h-3 w-3" />
              <kbd className="rounded border bg-background px-1 py-0.5 font-semibold">↑↓</kbd>{" "}
              navigate
              <kbd className="rounded border bg-background px-1 py-0.5 font-semibold">↵</kbd> select
              <kbd className="rounded border bg-background px-1 py-0.5 font-semibold">Esc</kbd>{" "}
              close
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] text-primary gap-1"
              onClick={() => setAddProductOpen(true)}
              title="Add new product to inventory"
            >
              <PackagePlus className="h-3 w-3" />
              New product
            </Button>
          </div>

          {/* Product list */}
          <div ref={listRef} className="max-h-[340px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="p-6 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  {query ? `No products matching "${query}"` : "No products in inventory."}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setAddProductOpen(true)}
                >
                  <PackagePlus className="h-3.5 w-3.5" />
                  Add new product
                </Button>
              </div>
            ) : (
              filtered.map((p, idx) => {
                const isActive = idx === activeIdx;

                const now = Date.now();
                const expTime = new Date(p.expiry).getTime();
                const daysToExpiry = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));

                const isExpired = daysToExpiry < 0;
                const isNearExpiryRed = daysToExpiry >= 0 && daysToExpiry <= 30;
                const isNearExpiryOrange = daysToExpiry > 30 && daysToExpiry <= 90;

                const outOfStock = p.stock <= 0;
                const isLowStock = p.stock > 0 && p.stock <= 10;

                const isRed = isExpired || isNearExpiryRed || outOfStock;
                const isOrange = !isRed && (isNearExpiryOrange || isLowStock);

                let statusBg = "";
                let hoverBg = "hover:bg-accent hover:text-accent-foreground";

                if (isRed) {
                  statusBg = "bg-red-50/70 dark:bg-red-950/20";
                  hoverBg = "hover:bg-red-100/70 dark:hover:bg-red-950/35";
                } else if (isOrange) {
                  statusBg = "bg-amber-50/70 dark:bg-amber-950/20";
                  hoverBg = "hover:bg-amber-100/70 dark:hover:bg-amber-950/35";
                }

                return (
                  <button
                    key={p.id}
                    data-product-item
                    onClick={() => !outOfStock && handleAddClick(p)}
                    disabled={outOfStock}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-colors text-left border-l-2",
                      statusBg,
                      isActive
                        ? "bg-primary/10 text-primary ring-1 ring-primary/30 border-l-primary"
                        : cn(
                            hoverBg,
                            isRed
                              ? "border-l-red-500"
                              : isOrange
                                ? "border-l-amber-500"
                                : "border-l-transparent",
                          ),
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate flex items-center gap-2">
                        {p.name}
                        {p.prescription && (
                          <span className="text-[10px] bg-destructive/10 text-destructive px-1 rounded font-bold shrink-0">
                            Rx
                          </span>
                        )}
                        {p.pack && (
                          <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 shrink-0">
                            {p.pack}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>{formatMoney(p.price)}</span>
                        {p.mrp && p.mrp > 0 && (
                          <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded border border-border/50">
                            MRP: {formatMoney(p.mrp)}
                          </span>
                        )}
                        {(() => {
                          const normName = p.name ? p.name.trim().toLowerCase() : "";
                          const cp =
                            cart.customerPrices[normName] ||
                            (p.id ? cart.customerPrices[p.id] : undefined);
                          if (
                            !cp ||
                            !cp.price ||
                            cp.price <= 0 ||
                            Math.abs(cp.price - p.price) < 0.001
                          )
                            return null;
                          return (
                            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-700">
                              Prev cust: ₹{cp.price.toFixed(2)}
                            </span>
                          );
                        })()}
                        <span>·</span>
                        <span
                          className={cn(
                            "font-semibold",
                            outOfStock
                              ? "text-red-600 dark:text-red-400"
                              : isLowStock
                                ? "text-amber-600 dark:text-amber-400"
                                : "",
                          )}
                        >
                          {outOfStock
                            ? (p.lockedQty ?? 0) > 0
                              ? `Out of stock (${p.lockedQty} in draft)`
                              : "Out of stock"
                            : (p.lockedQty ?? 0) > 0
                              ? `${p.stock} in stock (${p.lockedQty} in draft)`
                              : `${p.stock} in stock`}
                        </span>
                        <span>·</span>
                        <span
                          className={cn(
                            isExpired || isNearExpiryRed
                              ? "text-red-600 dark:text-red-400 font-semibold"
                              : isNearExpiryOrange
                                ? "text-amber-600 dark:text-amber-400 font-semibold"
                                : "",
                          )}
                        >
                          Exp: {new Date(p.expiry).toLocaleDateString()}
                          {isExpired
                            ? " (Expired)"
                            : isNearExpiryRed
                              ? " (<30d)"
                              : isNearExpiryOrange
                                ? " (<90d)"
                                : ""}
                        </span>
                      </div>
                    </div>
                    {isActive && !outOfStock ? (
                      <span className="text-xs text-primary font-semibold ml-2 shrink-0">
                        ↵ Add
                      </span>
                    ) : (
                      <Plus className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              {filtered.length} product{filtered.length !== 1 ? "s" : ""} found
            </span>
            <span>{products.length} total in inventory</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Selection Dialog */}
      <Dialog
        open={!!batchesProduct}
        onOpenChange={(v) => {
          if (!v) setBatchesProduct(null);
        }}
      >
        <DialogContent className="max-w-md p-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Select Batch for {batchesProduct?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Multiple batches available in stock. Use arrow keys to select and Enter to add.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
            {(batchesProduct?.batches || [])
              .filter((b) => b && b.stock > 0)
              .map((b, idx) => {
                const isActive = idx === selectedBatchIdx;
                const now = Date.now();
                const expiryStr = b.expiry || "";
                const expTime = expiryStr ? new Date(expiryStr).getTime() : NaN;
                const daysToExpiry = isNaN(expTime)
                  ? 999
                  : Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));
                const isExpired = !isNaN(expTime) && daysToExpiry < 0;

                return (
                  <button
                    key={b.id}
                    type="button"
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg border text-xs flex justify-between items-center transition-all",
                      isActive
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-muted",
                    )}
                    onClick={() => {
                      onAdd(b);
                      setBatchesProduct(null);
                    }}
                    onMouseEnter={() => setSelectedBatchIdx(idx)}
                  >
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5 uppercase">
                        Batch: {b.batch || "UNBATCHED"}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Expiry:{" "}
                        {(() => {
                          if (!b.expiry) return "—";
                          const dateObj = new Date(b.expiry);
                          if (isNaN(dateObj.getTime())) return "—";
                          const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
                          const yy = String(dateObj.getFullYear()).substring(2);
                          return `${mm}/${yy}`;
                        })()}
                        {isExpired && (
                          <span className="text-red-500 font-semibold"> (Expired)</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-primary">{formatMoney(b.price)}</div>
                      {b.mrp && b.mrp > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          MRP: {formatMoney(b.mrp)}
                        </div>
                      )}
                      {(() => {
                        const normName = (batchesProduct?.name || b.name || "")
                          .trim()
                          .toLowerCase();
                        const cp =
                          cart.customerPrices[normName] ||
                          (b.id ? cart.customerPrices[b.id] : undefined);
                        if (
                          !cp ||
                          !cp.price ||
                          cp.price <= 0 ||
                          Math.abs(cp.price - b.price) < 0.001
                        )
                          return null;
                        return (
                          <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Prev cust: ₹{cp.price.toFixed(2)}
                          </div>
                        );
                      })()}
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Stock: {b.stock} units
                        {(b.lockedQty ?? 0) > 0 ? ` (${b.lockedQty} in draft)` : ""}
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
          <DialogFooter className="mt-4 sm:justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setBatchesProduct(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const activeBatches =
                  batchesProduct?.batches?.filter((b) => b && b.stock > 0) || [];
                const batch = activeBatches[selectedBatchIdx];
                if (batch) {
                  onAdd(batch);
                  setBatchesProduct(null);
                }
              }}
            >
              Add Selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nested Add Product Dialog */}
      <AddProductDialog
        open={addProductOpen}
        onOpenChange={handleAddProductClose}
        defaultName={query}
      />
    </>
  );
}

// ─── Add Product Dialog – Inline inventory form ────────────────────────────────

function AddProductDialog({
  open,
  onOpenChange,
  defaultName = "",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultName?: string;
}) {
  const { session } = useAuth();
  const isRetailer = resolveBusinessCategory(session?.role) === "retailer";
  const defaultTax = session?.defaultTax ?? 12;
  const [form, setForm] = useState<FormState>({ ...emptyForm, taxPercent: String(defaultTax) });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<Product[]>([]);
  const [recentCategories, setRecentCategories] = useState<string[]>([]);
  const [recentManufacturers, setRecentManufacturers] = useState<string[]>([]);
  const [recentHsns, setRecentHsns] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setForm({
        ...emptyForm,
        taxPercent: isRetailer ? "5" : String(defaultTax),
        conversionFactor: isRetailer ? "10" : "1",
        name: defaultName,
      });
      productsStore.list().then(setItems);
      try {
        setRecentCategories(JSON.parse(localStorage.getItem("recentCategories") || "[]"));
        setRecentManufacturers(JSON.parse(localStorage.getItem("recentManufacturers") || "[]"));
        setRecentHsns(JSON.parse(localStorage.getItem("recentHsns") || "[]"));
      } catch {}
    }
  }, [open, defaultTax, defaultName, isRetailer]);

  const saveRecent = (
    key: string,
    value: string,
    current: string[],
    setter: (v: string[]) => void,
    limit = 4,
  ) => {
    if (!value.trim()) return;
    const updated = [
      value.trim(),
      ...current.filter((v) => v.toLowerCase() !== value.trim().toLowerCase()),
    ].slice(0, limit);
    setter(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    let packValue: string | undefined = undefined;
    if (form.stockType === "tab" || form.stockType === "cap" || form.stockType === "other") {
      if (form.stockPacks) packValue = form.stockPacks;
    } else if (form.stockType === "syp") {
      if (form.stockPacks) packValue = `${form.stockPacks}ML`;
    } else if (form.stockType === "inj") {
      if (form.stockPacks) packValue = `${form.stockPacks}${form.stockUnits || "ML"}`;
    } else if (form.stockType === "cream") {
      if (form.stockPacks) packValue = `${form.stockPacks} GM`;
    } else if (form.stockType === "drop") {
      if (form.stockPacks) packValue = `${form.stockPacks} ML Drop`;
    }

    const convFactor = isRetailer ? Math.max(1, Number(form.conversionFactor) || 1) : 1;
    const pps = getPiecesPerStrip(packValue, form.stockType, convFactor);
    let calculatedStock = Number(form.stock) || 0;
    if (isRetailer) {
      if (form.stripStock !== "" || form.pcStock !== "") {
        calculatedStock = combineStripAndPcToQty(
          Number(form.stripStock || 0),
          Number(form.pcStock || 0),
          pps,
        );
      }
    }

    const sellingPrice = isRetailer
      ? form.mrp !== ""
        ? Number(form.mrp)
        : Number(form.price)
      : Number(form.price);

    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || "General",
      costPrice: form.costPrice === "" ? undefined : Number(form.costPrice),
      price: sellingPrice,
      mrp: form.mrp === "" ? undefined : Number(form.mrp),
      stock: calculatedStock,
      pack: packValue,
      expiry: (() => {
        if (!form.expiry) return "";
        const parts = form.expiry.split("/");
        if (parts.length === 2) {
          const month = parseInt(parts[0], 10);
          const year = 2000 + parseInt(parts[1], 10);
          const lastDay = new Date(year, month, 0).getDate();
          return `${year}-${month.toString().padStart(2, "0")}-${lastDay.toString().padStart(2, "0")}`;
        }
        return form.expiry;
      })(),
      batch: form.batch.trim().toUpperCase() || undefined,
      manufacturer: form.manufacturer.trim() || undefined,
      sku: form.sku.trim() || undefined,
      taxPercent: Number(form.taxPercent) || 0,
      prescription: form.prescription,
      baseUnit: form.baseUnit.trim() || "Unit",
      packUnit: form.packUnit.trim() || "Pack",
      conversionFactor: convFactor,
      packPrice: form.packPrice === "" ? undefined : Number(form.packPrice),
      packCostPrice: form.packCostPrice === "" ? undefined : Number(form.packCostPrice),
    };

    if (
      !payload.name ||
      !payload.expiry ||
      isNaN(payload.price) ||
      isNaN(payload.stock) ||
      payload.costPrice === undefined ||
      isNaN(payload.costPrice)
    ) {
      toast.error("Please fill name, buying price, selling price, stock and expiry.");
      return;
    }

    setSubmitting(true);
    try {
      await productsStore.add(payload);
      toast.success(`${payload.name} added to inventory`);
      saveRecent("recentCategories", payload.category, recentCategories, setRecentCategories, 4);
      if (payload.manufacturer)
        saveRecent(
          "recentManufacturers",
          payload.manufacturer,
          recentManufacturers,
          setRecentManufacturers,
          8,
        );
      if (payload.sku) saveRecent("recentHsns", payload.sku, recentHsns, setRecentHsns, 4);
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message || "Failed to add product");
    } finally {
      setSubmitting(false);
    }
  };

  const handleScan = (code: string) => {
    setScannerOpen(false);
    setForm((f) => ({ ...f, sku: code.trim() }));
  };

  const currentConv = isRetailer ? Math.max(1, Number(form.conversionFactor) || 1) : 1;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-primary" />
              Add new product
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldInline label="Name" className="col-span-full">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
                list="add-product-names"
                placeholder="Product name"
              />
              <datalist id="add-product-names">
                {Array.from(new Set(items.map((i) => i.name))).map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </FieldInline>

            <FieldInline label="Category">
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Antibiotic"
                list="add-category-recent"
              />
              <datalist id="add-category-recent">
                {recentCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </FieldInline>

            <FieldInline label="Manufacturer">
              <Input
                value={form.manufacturer}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                list="add-manufacturer-recent"
              />
              <datalist id="add-manufacturer-recent">
                {recentManufacturers.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </FieldInline>

            {isRetailer ? (
              <>
                <FieldInline label="MRP (per Strip)">
                  <div className="space-y-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={form.mrp}
                      onChange={(e) => {
                        const val = e.target.value;
                        setForm({ ...form, mrp: val, price: val });
                      }}
                      placeholder="Printed MRP"
                      required
                    />
                    {form.mrp ? (
                      <span className="text-[10px] text-muted-foreground font-mono block">
                        ≈ ₹{getPerPcPrice(Number(form.mrp), currentConv).toFixed(2)}/pc
                      </span>
                    ) : null}
                  </div>
                </FieldInline>

                <FieldInline label="Buying price (per Strip)">
                  <div className="space-y-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={form.costPrice}
                      onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                      placeholder="Purchase cost"
                      required
                    />
                    {form.costPrice ? (
                      <span className="text-[10px] text-muted-foreground font-mono block">
                        ≈ ₹{getPerPcPrice(Number(form.costPrice), currentConv).toFixed(2)}/pc
                      </span>
                    ) : null}
                  </div>
                </FieldInline>

                <FieldInline label="Sale Rate (MRP)">
                  <div className="space-y-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={form.price || form.mrp}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      placeholder="Sale rate (MRP)"
                      required
                    />
                    {form.price || form.mrp ? (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium block">
                        ≈ ₹{getPerPcPrice(Number(form.price || form.mrp), currentConv).toFixed(2)}
                        /pc
                      </span>
                    ) : null}
                  </div>
                </FieldInline>

                <FieldInline label="Conversion (Pcs / Strip)">
                  <div className="space-y-1">
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={form.conversionFactor}
                      onChange={(e) => setForm({ ...form, conversionFactor: e.target.value })}
                      placeholder="e.g. 10 (units per strip)"
                      required
                    />
                    <span className="text-[10px] text-muted-foreground block">
                      Loose pcs per strip (used for loose pc sales)
                    </span>
                  </div>
                </FieldInline>
              </>
            ) : (
              <>
                <FieldInline label="Buying price">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                    placeholder="Cost per unit"
                    required
                  />
                </FieldInline>

                <FieldInline label="Selling price">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    required
                  />
                </FieldInline>

                <FieldInline label="MRP">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.mrp}
                    onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                    placeholder="Printed price"
                  />
                </FieldInline>
              </>
            )}

            <FieldInline label="Stock Type">
              <select
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.stockType}
                onChange={(e) => {
                  const type = e.target.value;
                  setForm({
                    ...form,
                    stockType: type,
                    stockPacks: "",
                    stockUnits: type === "inj" ? "ML" : "",
                  });
                }}
              >
                <option value="other">General / Other</option>
                <option value="tab">Tablet (Tab)</option>
                <option value="cap">Capsule (Cap)</option>
                <option value="syp">Syrup (Syp)</option>
                <option value="inj">Injection (Inj)</option>
                <option value="cream">Cream</option>
                <option value="drop">Drop</option>
              </select>
            </FieldInline>

            {form.stockType === "other" && (
              <FieldInline label="Pack Options">
                <div className="flex items-center gap-2">
                  <Input
                    list="add-general-options"
                    placeholder="e.g. 10X10, ML, GM..."
                    value={form.stockPacks}
                    onChange={(e) => setForm({ ...form, stockPacks: e.target.value })}
                  />
                  <datalist id="add-general-options">
                    <option value="10X10" />
                    <option value="10X1X10" />
                    <option value="ML" />
                    <option value="MG" />
                    <option value="GM" />
                    <option value="CAP" />
                  </datalist>
                </div>
              </FieldInline>
            )}

            {(form.stockType === "tab" || form.stockType === "cap") && (
              <FieldInline label="Pack Format">
                <Input
                  list="add-tab-cap-pack-options"
                  placeholder="e.g. 10x10, 10X1X10, CAP"
                  value={form.stockPacks}
                  onChange={(e) => setForm({ ...form, stockPacks: e.target.value })}
                  required
                />
                <datalist id="add-tab-cap-pack-options">
                  <option value="10X10" />
                  <option value="10X1X10" />
                  <option value="CAP" />
                </datalist>
              </FieldInline>
            )}

            {form.stockType === "syp" && (
              <FieldInline label="Pack (ML)">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="ML Amount"
                    value={form.stockPacks}
                    onChange={(e) => setForm({ ...form, stockPacks: e.target.value })}
                    required
                  />
                  <span className="text-muted-foreground text-sm font-medium">ML</span>
                </div>
              </FieldInline>
            )}

            {form.stockType === "inj" && (
              <FieldInline label="Pack (Measure)">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={form.stockPacks}
                    onChange={(e) => setForm({ ...form, stockPacks: e.target.value })}
                    required
                  />
                  <select
                    className="flex h-9 w-24 items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={form.stockUnits || "ML"}
                    onChange={(e) => setForm({ ...form, stockUnits: e.target.value })}
                  >
                    <option value="ML">ML</option>
                    <option value="MG">MG</option>
                    <option value="GM">GM</option>
                  </select>
                </div>
              </FieldInline>
            )}

            {form.stockType === "cream" && (
              <FieldInline label="Pack (Measure)">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={form.stockPacks}
                    onChange={(e) => setForm({ ...form, stockPacks: e.target.value })}
                    required
                  />
                  <span className="text-muted-foreground text-sm font-medium">GM</span>
                </div>
              </FieldInline>
            )}

            {form.stockType === "drop" && (
              <FieldInline label="Pack (Measure)">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={form.stockPacks}
                    onChange={(e) => setForm({ ...form, stockPacks: e.target.value })}
                    required
                  />
                  <span className="text-muted-foreground text-sm font-medium">ML</span>
                </div>
              </FieldInline>
            )}

            {isRetailer ? (
              <FieldInline label="Initial Stock">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      type="number"
                      min="0"
                      value={form.stripStock}
                      onChange={(e) => setForm({ ...form, stripStock: e.target.value })}
                      placeholder="Strips"
                    />
                    <span className="text-[10px] text-muted-foreground">Strips / Packs</span>
                  </div>
                  <div>
                    <Input
                      type="number"
                      min="0"
                      value={form.pcStock}
                      onChange={(e) => setForm({ ...form, pcStock: e.target.value })}
                      placeholder="Loose Pcs"
                    />
                    <span className="text-[10px] text-muted-foreground">Loose Pcs</span>
                  </div>
                </div>
              </FieldInline>
            ) : (
              <FieldInline label="Stock Quantity">
                <Input
                  type="number"
                  placeholder="Total qty"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  required
                />
              </FieldInline>
            )}

            <FieldInline label="Expiry">
              <Input
                type="text"
                placeholder="MM/YY"
                maxLength={5}
                value={form.expiry}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^\d/]/g, "");
                  if (val.length === 2 && form.expiry.length !== 3 && !val.includes("/")) {
                    val += "/";
                  }
                  setForm({ ...form, expiry: val });
                }}
                required
              />
            </FieldInline>

            <FieldInline label="Tax %">
              <Input
                type="number"
                value={form.taxPercent}
                onChange={(e) => setForm({ ...form, taxPercent: e.target.value })}
              />
            </FieldInline>

            <FieldInline label="Batch">
              <Input
                value={form.batch}
                onChange={(e) => setForm({ ...form, batch: e.target.value.toUpperCase() })}
              />
            </FieldInline>

            <FieldInline label="HSN Code">
              <div className="flex gap-2">
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="Type or scan"
                  list="add-hsn-recent"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setScannerOpen(true)}
                  title="Scan barcode"
                >
                  <ScanLine className="h-4 w-4" />
                </Button>
              </div>
              <datalist id="add-hsn-recent">
                {recentHsns.map((h) => (
                  <option key={h} value={h} />
                ))}
              </datalist>
            </FieldInline>

            <div className="col-span-full flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Prescription required</div>
                <div className="text-xs text-muted-foreground">Mark this product as Rx-only.</div>
              </div>
              <Switch
                checked={form.prescription}
                onCheckedChange={(v) => setForm({ ...form, prescription: v })}
              />
            </div>

            <DialogFooter className="col-span-full">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="shadow-soft" disabled={submitting}>
                {submitting ? "Adding…" : "Add product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SkuScanner open={scannerOpen} onOpenChange={setScannerOpen} onDetected={handleScan} />
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldInline({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function PayChoice({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition-smooth",
        active
          ? "border-primary bg-primary/10 text-primary shadow-soft"
          : "border-border hover:border-primary/40 hover:bg-accent/40",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function Row({
  label,
  value,
  bold,
  className,
}: {
  label: string;
  value: string;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex justify-between ${bold ? "font-semibold text-base" : ""} ${className ?? ""}`}
    >
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function RxInput({
  refValue,
  photoValue,
  onChange,
}: {
  refValue: string;
  photoValue: string;
  onChange: (patch: { prescriptionRef?: string; prescriptionPhoto?: string }) => void;
}) {
  const [tab, setTab] = useState<"text" | "photo">(photoValue ? "photo" : "text");

  const onFile = (file: File | null) => {
    if (!file) {
      onChange({ prescriptionPhoto: "" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be under 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange({ prescriptionPhoto: String(reader.result ?? "") });
    reader.onerror = () => toast.error("Could not read the file.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg">
        <button
          type="button"
          onClick={() => setTab("text")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-smooth",
            tab === "text"
              ? "bg-background shadow-soft text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Reference text
        </button>
        <button
          type="button"
          onClick={() => setTab("photo")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-smooth",
            tab === "photo"
              ? "bg-background shadow-soft text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Upload photo
        </button>
      </div>

      {tab === "text" ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Prescription / Rx reference</Label>
          <Input
            placeholder="e.g. Dr. Mehta · RX-2025-0421"
            value={refValue}
            onChange={(e) => onChange({ prescriptionRef: e.target.value })}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-xs">Prescription photo</Label>
          {photoValue ? (
            <div className="space-y-2">
              <img
                src={photoValue}
                alt="Prescription"
                className="max-h-40 w-full object-contain rounded-md border bg-muted"
              />
              <div className="flex gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                  />
                  <span className="block text-center text-xs px-2 py-1.5 rounded-md border cursor-pointer hover:bg-accent">
                    Replace
                  </span>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ prescriptionPhoto: "" })}
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <label className="block">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              <span className="flex flex-col items-center justify-center gap-1 px-3 py-6 rounded-md border-2 border-dashed text-xs text-muted-foreground cursor-pointer hover:bg-accent/40">
                <span className="font-medium text-foreground">Tap to upload</span>
                <span>JPG / PNG · under 4 MB</span>
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Checkout Flow Dialog (Payment Selection & Invoice Preview) ────────────────

function CheckoutFlowDialog({
  open,
  onOpenChange,
  step,
  setStep,
  onConfirmBill,
  submitting,
  isRetailer,
  session,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  step: "payment" | "preview";
  setStep: (s: "payment" | "preview") => void;
  onConfirmBill: () => Promise<void>;
  submitting: boolean;
  isRetailer: boolean;
  session: any;
}) {
  const cart = useCart();
  const [cashReceived, setCashReceived] = useState<string>("");
  const [savedCustomers, setSavedCustomers] = useState<SavedCustomer[]>([]);
  const [custSearch, setCustSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustForm, setNewCustForm] = useState({
    name: "",
    phone: "",
    address: "",
    drugLicNo: "",
    gstin: "",
    notes: "",
  });

  const pharmacyName = session?.pharmacyName || "MediStock Pharmacy";
  const pharmacyAddress = session?.pharmacyAddress || "";
  const pharmacyPhone = session?.pharmacyPhone || "";
  const gstNumber = session?.gstNumber || "";
  const drugLicNo = session?.drugLicNo || "";

  useEffect(() => {
    if (open) {
      setCashReceived(String(cart.total));
      setShowPicker(false);
      setShowAddCustomer(false);
      setCustSearch("");
      customersStore
        .list()
        .then(setSavedCustomers)
        .catch(() => setSavedCustomers([]));
    }
  }, [open, cart.total]);

  const cashNum = parseFloat(cashReceived) || 0;
  const changeToReturn = cashNum - cart.total;

  const advanceNum = cart.advanceAmount || 0;
  const creditBalanceDue = Math.max(0, cart.total - advanceNum);

  const isWalkIn =
    !cart.customer.name?.trim() ||
    cart.customer.name.trim().toLowerCase() === "walk-in customer" ||
    cart.customer.name.trim().toLowerCase() === "walk-in" ||
    cart.customer.name.trim().toLowerCase() === "walkin";

  const hasRegisteredCustomer = !isWalkIn && Boolean(cart.customer.name?.trim());

  const matchedCustomers = useMemo(() => {
    const q = custSearch.trim().toLowerCase();
    if (!q) return savedCustomers.slice(0, 6);
    return savedCustomers
      .filter(
        (c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [savedCustomers, custSearch]);

  const selectCustomer = (c: SavedCustomer) => {
    cart.setCustomer({
      name: c.name,
      phone: c.phone || "",
      address: c.address || "",
      drugLicNo: c.drugLicNo || "",
      gstin: c.gstin || "",
      notes: c.notes || "",
    });
    setShowPicker(false);
    setCustSearch("");
  };

  const handleSetWalkIn = () => {
    cart.setCustomer({
      name: "Walk-in Customer",
      phone: "",
      address: "",
      drugLicNo: "",
      gstin: "",
      notes: "",
    });
    setShowPicker(false);
  };

  const newCustPhoneDigits = useMemo(() => {
    return extractPhoneDigits(newCustForm.phone);
  }, [newCustForm.phone]);

  const handleNewCustPhoneChange = (val: string) => {
    setNewCustForm((prev) => ({ ...prev, phone: formatPhoneWithCountryCode(val) }));
  };

  const newCustPhoneConflict = useMemo(() => {
    if (newCustPhoneDigits.length !== 10) return null;
    const currentName = newCustForm.name.trim().toLowerCase();
    return (
      savedCustomers.find((c) => {
        const cDigits = extractPhoneDigits(c.phone);
        const cName = (c.name || "").trim().toLowerCase();
        return cDigits === newCustPhoneDigits && cName && cName !== currentName;
      }) || null
    );
  }, [savedCustomers, newCustPhoneDigits, newCustForm.name]);

  const handleSaveNewCustomer = (e: FormEvent) => {
    e.preventDefault();
    if (!newCustForm.name.trim()) {
      toast.error("Customer name is required.");
      return;
    }
    if (!newCustForm.phone.trim()) {
      toast.error("Customer phone number is required.");
      return;
    }
    if (newCustPhoneConflict) {
      toast.error(
        `Phone number already exists for "${newCustPhoneConflict.name}". Please use a unique number.`,
      );
      return;
    }
    cart.setCustomer({
      name: newCustForm.name.trim(),
      phone: newCustForm.phone.trim(),
      address: newCustForm.address.trim(),
      drugLicNo: newCustForm.drugLicNo.trim(),
      gstin: newCustForm.gstin.trim(),
      notes: newCustForm.notes.trim(),
    });
    setShowAddCustomer(false);
    toast.success("Customer details updated");
  };

  const handleProceedToPreview = () => {
    if (
      cart.paymentMethod === "credit" &&
      (!hasRegisteredCustomer || !cart.customer.phone?.trim())
    ) {
      toast.error("Credit sales require registered customer details.", {
        description: "Please select or add customer name & phone number for credit.",
      });
      setShowPicker(true);
      return;
    }

    setStep("preview");
  };

  // Quick cash amounts
  const roundNext100 = Math.ceil(cart.total / 100) * 100;
  const roundNext500 = Math.ceil(cart.total / 500) * 500;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[92vh] overflow-y-auto transition-all",
          step === "preview" ? "sm:max-w-4xl" : "sm:max-w-2xl",
        )}
      >
        {step === "payment" ? (
          <div className="space-y-5">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2 border-b pb-3">
                <div>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <Coins className="h-5 w-5 text-primary" />
                    Select Payment Method &amp; Customer
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Choose payment mode, handle cash tender or credit terms before previewing the
                    invoice.
                  </DialogDescription>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Total Amount</span>
                  <span className="text-xl font-extrabold text-primary font-mono tabular-nums">
                    {formatMoney(cart.total)}
                  </span>
                </div>
              </div>
            </DialogHeader>

            {/* Customer Details Card */}
            <div className="rounded-lg border p-3.5 bg-muted/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Customer / Party
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={() => setShowPicker(!showPicker)}
                  >
                    <Search className="h-3 w-3 mr-1" />
                    {showPicker ? "Close Picker" : "Select / Search Party"}
                  </Button>
                  {hasRegisteredCustomer && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-muted-foreground"
                      onClick={handleSetWalkIn}
                      title="Switch to Walk-in Customer"
                    >
                      Set Walk-in
                    </Button>
                  )}
                </div>
              </div>

              {!showPicker && !showAddCustomer && (
                <div className="flex items-center justify-between text-xs bg-background p-2.5 rounded-md border">
                  <div>
                    <span className="font-semibold text-foreground text-sm block">
                      {cart.customer.name || "Walk-in Customer"}
                    </span>
                    {cart.customer.phone && (
                      <span className="text-muted-foreground block font-mono">
                        Phone: {cart.customer.phone}
                      </span>
                    )}
                    {cart.customer.address && (
                      <span className="text-muted-foreground block truncate max-w-md">
                        {cart.customer.address}
                      </span>
                    )}
                  </div>
                  <Badge variant={hasRegisteredCustomer ? "default" : "secondary"}>
                    {hasRegisteredCustomer ? "Registered Party" : "Walk-in"}
                  </Badge>
                </div>
              )}

              {/* Customer Picker Dropdown / Search */}
              {showPicker && !showAddCustomer && (
                <div className="space-y-2 bg-background p-3 rounded-md border animate-in fade-in-50">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={custSearch}
                        onChange={(e) => setCustSearch(e.target.value)}
                        placeholder="Search by party name or phone number..."
                        className="h-8 text-xs pl-8"
                        autoFocus
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs shrink-0"
                      onClick={() => {
                        setNewCustForm({
                          name: custSearch || "",
                          phone: "",
                          address: "",
                          drugLicNo: "",
                          gstin: "",
                          notes: "",
                        });
                        setShowAddCustomer(true);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add New Party
                    </Button>
                  </div>

                  <div className="max-h-40 overflow-y-auto divide-y rounded border text-xs">
                    <div
                      className="p-2 hover:bg-muted cursor-pointer flex items-center justify-between"
                      onClick={handleSetWalkIn}
                    >
                      <span className="font-medium text-foreground">Walk-in Customer</span>
                      <span className="text-[10px] text-muted-foreground">Default</span>
                    </div>
                    {matchedCustomers.map((c) => (
                      <div
                        key={c.id}
                        className="p-2 hover:bg-muted cursor-pointer flex items-center justify-between"
                        onClick={() => selectCustomer(c)}
                      >
                        <div>
                          <span className="font-medium text-foreground block">{c.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {c.phone || "No phone"}
                          </span>
                        </div>
                        {c.gstin && (
                          <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {c.gstin}
                          </span>
                        )}
                      </div>
                    ))}
                    {matchedCustomers.length === 0 && custSearch && (
                      <div className="p-3 text-center text-muted-foreground text-xs">
                        No customer found matching "{custSearch}".
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Add New Customer Form */}
              {showAddCustomer && (
                <form
                  onSubmit={handleSaveNewCustomer}
                  className="space-y-3 bg-background p-3 rounded-md border animate-in fade-in-50 text-xs"
                >
                  <div className="font-semibold text-foreground flex items-center justify-between">
                    <span>New Customer Details</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => setShowAddCustomer(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px]">Party Name *</Label>
                      <Input
                        value={newCustForm.name}
                        onChange={(e) => setNewCustForm({ ...newCustForm, name: e.target.value })}
                        required
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Phone Number *</Label>
                      <div className="flex rounded-md border border-input shadow-sm focus-within:ring-1 focus-within:ring-ring bg-background overflow-hidden h-7">
                        <span className="inline-flex items-center px-2 bg-muted text-[11px] font-bold text-muted-foreground select-none pointer-events-none border-r border-input">
                          +91
                        </span>
                        <Input
                          value={newCustPhoneDigits}
                          maxLength={10}
                          inputMode="numeric"
                          autoComplete="off"
                          onChange={(e) => handleNewCustPhoneChange(e.target.value)}
                          required
                          placeholder="98765 43210"
                          className="border-0 focus-visible:ring-0 rounded-l-none h-7 text-xs font-medium"
                        />
                      </div>
                      {newCustPhoneConflict && (
                        <div className="text-destructive text-[10px] font-medium mt-0.5">
                          Already registered to "{newCustPhoneConflict.name}"
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px]">GSTIN</Label>
                      <Input
                        value={newCustForm.gstin}
                        onChange={(e) =>
                          setNewCustForm({ ...newCustForm, gstin: e.target.value.toUpperCase() })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Drug Lic No.</Label>
                      <Input
                        value={newCustForm.drugLicNo}
                        onChange={(e) =>
                          setNewCustForm({
                            ...newCustForm,
                            drugLicNo: e.target.value.toUpperCase(),
                          })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px]">Address</Label>
                    <Input
                      value={newCustForm.address}
                      onChange={(e) => setNewCustForm({ ...newCustForm, address: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    className="w-full h-8 text-xs"
                    disabled={Boolean(newCustPhoneConflict)}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" /> Use this Customer
                  </Button>
                </form>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Choose Payment Mode
              </Label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    cart.setPaymentMethod("cash");
                    cart.setAdvanceAmount(0);
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-lg border-2 text-sm font-semibold transition-all",
                    cart.paymentMethod === "cash"
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border hover:bg-muted/50 text-foreground",
                  )}
                >
                  <Banknote className="h-6 w-6" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    cart.setPaymentMethod("online");
                    cart.setAdvanceAmount(0);
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-lg border-2 text-sm font-semibold transition-all",
                    cart.paymentMethod === "online"
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border hover:bg-muted/50 text-foreground",
                  )}
                >
                  <Smartphone className="h-6 w-6" />
                  <span>Online / UPI</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!hasRegisteredCustomer || !cart.customer.phone?.trim()) {
                      toast.info("Credit bills require registered party details.", {
                        description: "Please enter customer name and phone.",
                      });
                      setShowPicker(true);
                    }
                    cart.setPaymentMethod("credit");
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-lg border-2 text-sm font-semibold transition-all",
                    cart.paymentMethod === "credit"
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border hover:bg-muted/50 text-foreground",
                  )}
                >
                  <CreditCard className="h-6 w-6" />
                  <span>Credit (Udhar)</span>
                </button>
              </div>

              {/* Cash Tender & Change Handling */}
              {cart.paymentMethod === "cash" && (
                <div className="rounded-lg border p-4 bg-muted/10 space-y-3 animate-in fade-in-50">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <Label className="text-xs font-semibold">Cash Tendered / Received</Label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                          ₹
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          className="pl-8 text-base font-bold font-mono h-10"
                          placeholder="0.00"
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="flex-1 text-right">
                      <span className="text-xs text-muted-foreground block">
                        {changeToReturn >= 0 ? "Change to Return" : "Short Amount"}
                      </span>
                      <span
                        className={cn(
                          "text-xl font-extrabold font-mono tabular-nums block mt-1",
                          changeToReturn >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400",
                        )}
                      >
                        {changeToReturn >= 0
                          ? `₹${changeToReturn.toFixed(2)}`
                          : `-₹${Math.abs(changeToReturn).toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  {/* Quick Cash Buttons */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Quick Tender:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => setCashReceived(cart.total.toFixed(2))}
                      >
                        Exact (₹{cart.total.toFixed(2)})
                      </Button>
                      {roundNext100 > cart.total && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2 font-mono"
                          onClick={() => setCashReceived(String(roundNext100))}
                        >
                          ₹{roundNext100}
                        </Button>
                      )}
                      {roundNext500 > cart.total && roundNext500 !== roundNext100 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2 font-mono"
                          onClick={() => setCashReceived(String(roundNext500))}
                        >
                          ₹{roundNext500}
                        </Button>
                      )}
                      {[100, 200, 500, 2000]
                        .filter((n) => n >= cart.total)
                        .slice(0, 3)
                        .map((amt) => (
                          <Button
                            key={amt}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2 font-mono"
                            onClick={() => setCashReceived(String(amt))}
                          >
                            ₹{amt}
                          </Button>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Online Mode Info */}
              {cart.paymentMethod === "online" && (
                <div className="rounded-lg border p-4 bg-emerald-500/5 border-emerald-500/20 text-xs text-emerald-900 dark:text-emerald-200 space-y-1 animate-in fade-in-50">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Online / UPI Payment Mode
                  </div>
                  <p className="text-muted-foreground">
                    Collect ₹{cart.total.toFixed(2)} via UPI QR scanner, Card POS machine, or
                    Netbanking.
                  </p>
                </div>
              )}

              {/* Credit Mode Options */}
              {cart.paymentMethod === "credit" && (
                <div className="rounded-lg border p-4 bg-muted/10 space-y-3.5 animate-in fade-in-50">
                  {!hasRegisteredCustomer || !cart.customer.phone?.trim() ? (
                    <div className="text-xs bg-amber-500/15 border border-amber-500/30 p-2.5 rounded text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
                      <span>⚠️ Party name &amp; phone number are mandatory for credit sales.</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs px-2 border-amber-500/40"
                        onClick={() => setShowPicker(true)}
                      >
                        Pick Customer
                      </Button>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Advance Payment (Optional)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          ₹
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={cart.total}
                          value={cart.advanceAmount || ""}
                          onChange={(e) => cart.setAdvanceAmount(Number(e.target.value))}
                          className="pl-7 h-9 text-xs font-mono"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 text-right">
                      <Label className="text-xs font-semibold block text-muted-foreground">
                        Remaining Balance Due
                      </Label>
                      <span className="text-lg font-bold font-mono text-primary block mt-1">
                        ₹{creditBalanceDue.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {cart.advanceAmount > 0 && (
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        Advance Received Via
                      </Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={cart.advancePaymentMethod === "cash" ? "default" : "outline"}
                          size="sm"
                          className="flex-1 h-7 text-xs"
                          onClick={() => cart.setAdvancePaymentMethod("cash")}
                        >
                          Cash
                        </Button>
                        <Button
                          type="button"
                          variant={cart.advancePaymentMethod === "online" ? "default" : "outline"}
                          size="sm"
                          className="flex-1 h-7 text-xs"
                          onClick={() => cart.setAdvancePaymentMethod("online")}
                        >
                          Online
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <DialogFooter className="border-t pt-3 flex items-center justify-between sm:justify-between w-full">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleProceedToPreview} className="shadow-soft">
                Proceed to Preview <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* Step 2: Invoice Preview Screen */
          <div className="space-y-4">
            <DialogHeader>
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    Tax Invoice Preview
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Please review invoice line items, party information, and payment details before
                    confirmation.
                  </DialogDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs uppercase px-2.5 py-1">
                  Preview Mode
                </Badge>
              </div>
            </DialogHeader>

            {/* Invoice Sheet Preview */}
            <div className="rounded-lg border bg-card p-4 sm:p-6 text-card-foreground shadow-inner space-y-4 text-xs font-sans">
              {/* Store & Invoice Meta Header */}
              <div className="flex justify-between items-start border-b pb-3">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-primary uppercase tracking-wide">
                    {pharmacyName}
                  </h2>
                  {pharmacyAddress && (
                    <p className="text-muted-foreground whitespace-pre-wrap max-w-sm leading-tight text-[11px]">
                      {pharmacyAddress}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-3 text-[11px] font-mono text-muted-foreground pt-0.5">
                    {pharmacyPhone && <span>Phone: {pharmacyPhone}</span>}
                    {gstNumber && <span>GSTIN: {gstNumber.toUpperCase()}</span>}
                    {drugLicNo && <span>D.L.No.: {drugLicNo.toUpperCase()}</span>}
                  </div>
                </div>

                <div className="text-right space-y-0.5 font-mono">
                  <span className="text-xs font-bold uppercase text-primary tracking-wider block">
                    TAX INVOICE
                  </span>
                  <span className="text-muted-foreground text-[11px] block">
                    Date: {new Date().toLocaleDateString("en-IN")}
                  </span>
                  <span className="text-muted-foreground text-[11px] block">
                    Cashier: {session?.name || "Staff"}
                  </span>
                </div>
              </div>

              {/* Customer & Dispatch Box */}
              <div className="grid grid-cols-2 gap-3 p-2.5 rounded bg-muted/30 border text-[11px]">
                <div>
                  <span className="font-bold text-primary uppercase block mb-0.5 text-[10px]">
                    BILLED TO:
                  </span>
                  <span className="font-semibold text-foreground block text-xs">
                    {cart.customer.name || "Walk-in Customer"}
                  </span>
                  {cart.customer.phone && (
                    <span className="text-muted-foreground block">
                      Phone: {cart.customer.phone}
                    </span>
                  )}
                  {cart.customer.drugLicNo && (
                    <span className="text-muted-foreground block">
                      D.L.No.: {cart.customer.drugLicNo.toUpperCase()}
                    </span>
                  )}
                  {cart.customer.gstin && (
                    <span className="text-muted-foreground block">
                      GSTIN: {cart.customer.gstin}
                    </span>
                  )}
                  {cart.customer.address && (
                    <span className="text-muted-foreground block truncate">
                      {cart.customer.address}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-bold text-primary uppercase block mb-0.5 text-[10px]">
                    PAYMENT TERMS:
                  </span>
                  <span className="font-semibold text-foreground uppercase block text-xs">
                    {cart.paymentMethod}
                  </span>
                  {cart.paymentMethod === "cash" && cashNum > 0 && (
                    <span className="text-muted-foreground block">
                      Tendered: ₹{cashNum.toFixed(2)} (Change: ₹
                      {Math.max(0, changeToReturn).toFixed(2)})
                    </span>
                  )}
                  {cart.paymentMethod === "credit" && (
                    <span className="text-muted-foreground block">
                      Advance: ₹{advanceNum.toFixed(2)} | Balance Due: ₹
                      {creditBalanceDue.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px]">
                    <tr>
                      <th className="py-2 px-2 text-center w-8">#</th>
                      <th className="py-2 px-2">Medicine Name</th>
                      <th className="py-2 px-2 text-center">Pack</th>
                      <th className="py-2 px-2 text-left">Batch</th>
                      <th className="py-2 px-2 text-center">Exp</th>
                      <th className="py-2 px-2 text-right">Qty</th>
                      <th className="py-2 px-2 text-right">MRP</th>
                      <th className="py-2 px-2 text-center">GST%</th>
                      <th className="py-2 px-2 text-right">Rate</th>
                      <th className="py-2 px-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cart.items.map((it, idx) => {
                      const pps = getPiecesPerStrip(
                        it.product.pack,
                        it.product.stockType,
                        it.product.conversionFactor,
                      );
                      const isTabCap =
                        isRetailer &&
                        (pps > 1 ||
                          isTabOrCap(
                            it.product.stockType || it.product.pack,
                            it.product.pack,
                            it.product.name,
                          ));
                      const unitRate = it.customPrice ?? it.product.price;
                      const lineQty = it.qty - (it.freeQty || 0);
                      const lineAmt = unitRate * lineQty;

                      const expFormatted = it.product.expiry
                        ? (() => {
                            const d = new Date(it.product.expiry);
                            const m = String(d.getMonth() + 1).padStart(2, "0");
                            const y = String(d.getFullYear()).slice(-2);
                            return `${m}/${y}`;
                          })()
                        : "-";

                      return (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="py-2 px-2 text-center text-muted-foreground">{idx + 1}</td>
                          <td className="py-2 px-2 font-medium">{it.product.name}</td>
                          <td className="py-2 px-2 text-center font-mono text-muted-foreground">
                            {it.product.pack || "-"}
                          </td>
                          <td className="py-2 px-2 font-mono uppercase text-muted-foreground">
                            {it.product.batch || "-"}
                          </td>
                          <td className="py-2 px-2 text-center font-mono text-muted-foreground">
                            {expFormatted}
                          </td>
                          <td className="py-2 px-2 text-right font-medium">
                            {isTabCap ? (
                              <>
                                {formatStripPcDisplay(it.qty, pps)}
                                {it.freeQty ? ` + ${formatStripPcDisplay(it.freeQty, pps)}` : ""}
                              </>
                            ) : (
                              <>
                                {it.qty}
                                {it.freeQty ? `+${it.freeQty}` : ""}
                              </>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-muted-foreground">
                            {it.product.mrp ? `₹${it.product.mrp.toFixed(2)}` : "-"}
                          </td>
                          <td className="py-2 px-2 text-center text-muted-foreground">
                            {it.product.taxPercent || 0}%
                          </td>
                          <td className="py-2 px-2 text-right font-mono">₹{unitRate.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right font-mono font-semibold">
                            ₹{lineAmt.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals */}
              <div className="flex justify-end pt-1">
                <div className="w-64 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span>{formatMoney(cart.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>GST / Tax:</span>
                    <span>{formatMoney(cart.tax)}</span>
                  </div>
                  {cart.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Discount:</span>
                      <span>-{formatMoney(cart.discount)}</span>
                    </div>
                  )}
                  {(() => {
                    const roundOff = cart.total - (cart.subtotal + cart.tax - cart.discount);
                    return Math.abs(roundOff) >= 0.01 ? (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Round Off:</span>
                        <span>
                          {roundOff > 0 ? "+" : ""}
                          {formatMoney(roundOff)}
                        </span>
                      </div>
                    ) : null;
                  })()}
                  <div className="flex justify-between text-sm font-bold text-primary border-t pt-1.5">
                    <span>Grand Total:</span>
                    <span>{formatMoney(cart.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Dialog Actions */}
            <DialogFooter className="border-t pt-3 flex items-center justify-between sm:justify-between w-full">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("payment")}
                disabled={submitting}
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Payment
              </Button>
              <Button
                type="button"
                onClick={() => void onConfirmBill()}
                disabled={submitting}
                className="shadow-soft bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {submitting ? "Generating Bill…" : "✓ Confirm & Generate Bill"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
