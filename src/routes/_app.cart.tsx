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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { billsStore, productsStore, customersStore, type Product, type Customer as SavedCustomer } from "@/lib/storage";
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

  useEffect(() => {
    productsStore.list().then(setProductList).catch(() => {});
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

  // Keep refs in sync every render (no re-subscription needed)
  useEffect(() => { selectedIdxRef.current = selectedIdx; });
  useEffect(() => { addOpenRef.current = addOpen; });
  useEffect(() => { customerOpenRef.current = customerOpen; });
  useEffect(() => { checkoutOpenRef.current = checkoutOpen; });
  useEffect(() => { deleteTargetRef.current = deleteTarget; });
  useEffect(() => { cartRef.current = cart; });

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
        description: "Customer name and phone number are required for credit. Walk-in customers can only pay with Cash or Online.",
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
    } catch (e) {
      toast.error((e as Error).message || "Failed to generate bill");
    } finally {
      setSubmitting(false);
    }
  };

  // Keep checkoutRef in sync so the stable keyboard handler can call it
  checkoutRef.current = handleOpenCheckout;

  // ── Cart keyboard handler — registered once, reads live values via refs ──────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        (e.target as HTMLElement)?.isContentEditable;

      // Alt+B → Browse & Add Item (always)
      if (e.altKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        e.stopPropagation();
        setAddOpen(true);
        return;
      }

      // F9 → Open Checkout Payment Modal
      if (e.key === "F9" && !isTyping) {
        e.preventDefault();
        checkoutRef.current?.();
        return;
      }

      // ── Item list navigation (only when not typing, no modal open) ──────
      if (
        isTyping ||
        addOpenRef.current ||
        customerOpenRef.current ||
        deleteTargetRef.current !== null
      ) return;

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


  return (
    <div className="space-y-6">
      {cart.activeDraftRestored && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs animate-fade-in shadow-xs">
          <div className="flex items-center gap-2.5">
            <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Draft in Progress:</strong> Your in-progress bill was preserved. You can edit items and generate the bill when ready.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] bg-background/80 border-amber-500/30 hover:bg-background"
              onClick={() => setDraftsOpen(true)}
            >
              View Drafts ({cart.drafts.length})
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-amber-700 hover:text-foreground"
              onClick={() => cart.dismissRestoredBanner()}
              title="Dismiss banner"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" /> Cart
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review items, choose payment, and finalize the sale.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setDraftsOpen(true)}
            className="relative gap-1.5"
            title="Saved Draft Bills"
          >
            <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span>Drafts</span>
            {cart.drafts.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-bold">
                {cart.drafts.length}
              </Badge>
            )}
          </Button>

          {cart.items.length > 0 && (
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              className="gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
              title="Save current bill as draft without decreasing stock"
            >
              <Save className="h-4 w-4" />
              <span>Save as Draft</span>
            </Button>
          )}

          <Button
            ref={browseButtonRef}
            variant="outline"
            onClick={() => setAddOpen(true)}
            title="Browse & Add Item (Alt+B)"
            id="cart-browse-btn"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Browse &amp; Add Item
            <kbd className="ml-2 hidden sm:inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              Alt+B
            </kbd>
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">
              Items {cart.count > 0 ? `(${cart.count})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {cart.items.length === 0 ? (
              <div className="text-center py-12 space-y-3 px-6">
                <p className="text-sm text-muted-foreground">Your cart is empty.</p>
                <Button size="sm" onClick={() => setAddOpen(true)} id="cart-browse-empty-btn">
                  <Plus className="h-4 w-4 mr-2" /> Browse &amp; Add Item
                </Button>
                <p className="text-xs text-muted-foreground">
                  Press <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-semibold">Alt+B</kbd> to open the product selector
                </p>
              </div>
            ) : (
              <div>
                {/* Keyboard hint bar */}
                <div className="flex items-center gap-3 px-4 py-1.5 bg-muted/40 border-b text-[11px] text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border bg-background px-1 py-0.5 font-semibold">↑↓</kbd>
                    select row
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border bg-background px-1 py-0.5 font-semibold">←→</kbd>
                    qty
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border bg-background px-1 py-0.5 font-semibold">Ctrl</kbd>
                    <kbd className="rounded border bg-background px-1 py-0.5 font-semibold">←→</kbd>
                    free qty
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border bg-background px-1 py-0.5 font-semibold">Del</kbd>
                    remove
                  </span>
                  {selectedIdx >= 0 && (
                    <span className="ml-auto text-primary font-medium">
                      Row {selectedIdx + 1} selected
                      {cart.items[selectedIdx] && (
                        <span className="ml-2 text-muted-foreground font-normal">
                          · qty <span className="font-semibold text-foreground">{cart.items[selectedIdx].qty}</span>
                          {(cart.items[selectedIdx].freeQty ?? 0) > 0 && (
                            <span className="ml-1 text-primary font-semibold">
                              ({cart.items[selectedIdx].freeQty} free)
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {/* Items list */}
                <div ref={itemsContainerRef} className="divide-y px-2">
                  {cart.items.map((i, idx) => {
                    const isSelected = idx === selectedIdx;
                    return (
                      <div
                        key={i.product.id}
                        ref={(el) => { itemRefs.current[idx] = el; }}
                        onClick={() => setSelectedIdx(idx)}
                        tabIndex={0}
                        aria-selected={isSelected}
                        className={cn(
                          "flex items-center gap-3 py-3 px-2 rounded-lg animate-fade-in cursor-pointer transition-colors outline-none",
                          isSelected
                            ? "bg-primary/20 ring-1.5 ring-primary/50"
                            : "hover:bg-muted/40",
                        )}
                      >
                        {/* Row selection indicator */}
                        <div className={cn(
                          "w-1 self-stretch rounded-full shrink-0 transition-colors",
                          isSelected ? "bg-primary" : "bg-transparent",
                        )} />

                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate flex items-center gap-1.5">
                            {i.product.name}
                            {i.product.prescription && (
                              <span
                                className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive shrink-0"
                                title="Prescription required"
                              >
                                Rx
                              </span>
                            )}
                            {i.product.pack && (
                              <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                                {i.product.pack}
                              </span>
                            )}
                          </div>
                          {(() => {
                            const parentProduct = productList.find((p) => p.id === i.product.productId);
                            const activeBatches = parentProduct?.batches?.filter((b) => b.stock > 0 || b.id === i.product.id) || [];
                            if (activeBatches.length > 1) {
                              return (
                                <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                                  <span className="text-muted-foreground font-medium">Batch:</span>
                                  <select
                                    className="bg-transparent border border-border rounded px-1.5 py-0.5 text-xs text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                                    value={i.product.id}
                                    onChange={(e) => {
                                      const newBatch = activeBatches.find(b => b.id === e.target.value);
                                      if (newBatch) {
                                        cart.switchBatch(i.product.id, newBatch);
                                        toast.success(`Switched to batch ${newBatch.batch}`);
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {activeBatches.map(b => (
                                      <option key={b.id} value={b.id}>
                                        {String(b.batch || "No Batch").toUpperCase()} (Stock: {b.stock} · Exp: {b.expiry ? new Date(b.expiry).toLocaleDateString().slice(3) : "N/A"})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              );
                            }
                            return (
                              <div className="text-[11px] text-muted-foreground mt-1 font-medium">
                                Batch: <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">{String(i.product.batch || "—").toUpperCase()}</span>
                                {i.product.expiry && (
                                  <>
                                    {" · Exp: "}
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                      {new Date(i.product.expiry).toLocaleDateString()}
                                    </span>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                            {i.freeQty && i.freeQty === i.qty ? (
                              <span className="font-semibold text-primary">Free</span>
                            ) : (
                              <>
                                <span className="flex items-center gap-1">
                                  <span>Price: ₹</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    key={`${i.product.id}-price-input`}
                                    className="w-16 h-6 px-1.5 border rounded bg-background text-foreground outline-none font-medium focus:ring-1 focus:ring-primary text-xs"
                                    value={i.customPrice !== undefined ? i.customPrice : i.product.price}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      if (!isNaN(val) && val > 0) {
                                        cart.setCustomPrice(i.product.id, val);
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const val = parseFloat(e.target.value);
                                      const cost = i.product.costPrice ?? 0;
                                      if (isNaN(val) || val <= cost) {
                                        toast.error(`Price must be higher than buying price (${formatMoney(cost)}). Please fix the price.`);
                                        cart.setCustomPrice(i.product.id, i.product.price);
                                      } else {
                                        cart.setCustomPrice(i.product.id, val);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </span>
                                <span>· {i.product.taxPercent ?? 0}% tax</span>
                                {isRetailer && isTabOrCap(i.product.stockType, i.product.pack, i.product.name) ? (
                                  <span className="text-[11px] text-muted-foreground font-medium">
                                    (₹{getPerPcPrice(i.customPrice ?? i.product.price, getPiecesPerStrip(i.product.pack, i.product.stockType))}/pc)
                                  </span>
                                ) : null}
                                {i.product.costPrice ? (
                                  <span className="text-[10px] bg-muted px-1 py-0.5 rounded text-muted-foreground">
                                    Buying: {formatMoney(i.product.costPrice)}
                                  </span>
                                ) : null}
                              </>
                            )}
                          </div>
                          {isRetailer && isTabOrCap(i.product.stockType, i.product.pack, i.product.name) && (
                            <div className="text-[11px] font-semibold text-primary mt-0.5">
                              {formatStripPcDisplay(i.qty, getPiecesPerStrip(i.product.pack, i.product.stockType), i.product.stockType, i.product.pack, i.product.name)}
                            </div>
                          )}
                        </div>

                        {/* Quantity Controls: Strip & Pc for Retailer Tab/Cap, Single Qty otherwise */}
                        {isRetailer && isTabOrCap(i.product.stockType, i.product.pack, i.product.name) ? (() => {
                          const pps = getPiecesPerStrip(i.product.pack, i.product.stockType);
                          const { strips, pcs } = splitQtyToStripAndPc(i.qty, pps);

                          return (
                            <div className="flex items-center gap-2">
                              {/* Strip +/- */}
                              <div className="flex items-center border border-border/80 rounded-md bg-background h-8 px-1">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">
                                  Strip
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (strips > 0 || pcs > 0) {
                                      const newStrips = Math.max(0, strips - 1);
                                      const newQty = combineStripAndPcToQty(newStrips, (newStrips === 0 && pcs === 0) ? 1 : pcs, pps);
                                      cart.setQty(i.product.id, Math.max(1 / pps, newQty));
                                    }
                                  }}
                                  disabled={i.qty <= (1 / pps)}
                                  title="Decrease strip"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className={cn(
                                  "w-6 text-center text-xs tabular-nums font-semibold transition-colors",
                                  isSelected ? "text-primary" : "",
                                )}>
                                  {strips}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newQty = combineStripAndPcToQty(strips + 1, pcs, pps);
                                    if (newQty <= i.product.stock) {
                                      cart.setQty(i.product.id, newQty);
                                    } else {
                                      toast.warning(`Only ${i.product.stock} in stock`);
                                    }
                                  }}
                                  disabled={i.qty + 1 > i.product.stock}
                                  title="Increase strip"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>

                              {/* Pc +/- */}
                              <div className="flex items-center border border-border/80 rounded-md bg-background h-8 px-1">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">
                                  Pc
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (pcs > 0) {
                                      const newQty = combineStripAndPcToQty(strips, pcs - 1, pps);
                                      cart.setQty(i.product.id, Math.max(1 / pps, newQty));
                                    } else if (strips > 0) {
                                      const newQty = combineStripAndPcToQty(strips - 1, pps - 1, pps);
                                      cart.setQty(i.product.id, Math.max(1 / pps, newQty));
                                    }
                                  }}
                                  disabled={i.qty <= (1 / pps)}
                                  title="Decrease piece"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className={cn(
                                  "w-6 text-center text-xs tabular-nums font-semibold transition-colors",
                                  isSelected ? "text-primary" : "",
                                )}>
                                  {pcs}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    let newStrips = strips;
                                    let newPcs = pcs + 1;
                                    if (newPcs >= pps) {
                                      newStrips += Math.floor(newPcs / pps);
                                      newPcs = newPcs % pps;
                                    }
                                    const newQty = combineStripAndPcToQty(newStrips, newPcs, pps);
                                    if (newQty <= i.product.stock) {
                                      cart.setQty(i.product.id, newQty);
                                    } else {
                                      toast.warning(`Only ${i.product.stock} in stock`);
                                    }
                                  }}
                                  disabled={i.qty + (1 / pps) > i.product.stock}
                                  title="Increase piece"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })() : (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center border rounded-md px-1.5 bg-background h-8">
                              <span className="text-[10px] uppercase font-medium text-muted-foreground mr-1">
                                Free
                              </span>
                              <select
                                className="text-xs bg-transparent outline-none cursor-pointer"
                                value={i.freeQty || 0}
                                onChange={(e) => cart.setFreeQty(i.product.id, Number(e.target.value))}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {Array.from({ length: Math.floor(i.qty) + 1 }, (_, k) => (
                                  <option key={k} value={k}>{k}</option>
                                ))}
                              </select>
                            </div>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => { e.stopPropagation(); cart.setQty(i.product.id, i.qty - 1); }}
                              title="Decrease qty (← when row selected)"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className={cn(
                              "w-8 text-center text-sm tabular-nums font-semibold transition-colors",
                              isSelected ? "text-primary" : "",
                            )}>
                              {i.qty}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => { e.stopPropagation(); cart.setQty(i.product.id, i.qty + 1); }}
                              disabled={i.qty >= i.product.stock}
                              title="Increase qty (→ when row selected)"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        )}

                        <div className="w-24 text-right tabular-nums font-medium">
                          {i.freeQty === i.qty
                            ? "₹0.00"
                            : formatMoney((i.customPrice ?? i.product.price) * (i.qty - (i.freeQty || 0)))}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-8 w-8 transition-colors",
                            isSelected ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:text-destructive",
                          )}
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(i.product.id); }}
                          title="Remove item (Del when row selected)"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );

                  })}
                </div>

                <div className="pt-3 pb-2 px-4">
                  <Button
                    variant="outline"
                    className="w-full border-dashed"
                    size="sm"
                    onClick={() => setAddOpen(true)}
                    id="cart-browse-add-btn"
                    title="Browse & Add Item (Alt+B)"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Browse &amp; Add Item
                    <kbd className="ml-2 hidden sm:inline-flex items-center rounded border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      Alt+B
                    </kbd>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-soft">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <UserRound className="h-4 w-4 text-primary" /> Customer
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCustomerOpen(true)}
                disabled={cart.items.length === 0}
              >
                <Pencil className="h-3.5 w-3.5" /> {hasCustomer ? "Edit" : "Add"}
              </Button>
            </CardHeader>
            <CardContent className="text-sm">
              {hasCustomer ? (
                <div className="space-y-1">
                  {cart.customer.name && <div className="font-medium">{cart.customer.name}</div>}
                  {cart.customer.phone && (
                    <div className="text-muted-foreground">{cart.customer.phone}</div>
                  )}
                  {cart.customer.address && (
                    <div className="text-muted-foreground whitespace-pre-wrap mt-0.5 leading-snug">
                      {cart.customer.address}
                    </div>
                  )}
                  {cart.customer.drugLicNo && (
                    <div className="text-muted-foreground text-xs mt-0.5">
                      D.L. No: {cart.customer.drugLicNo}
                    </div>
                  )}
                  {cart.customer.gstin && (
                    <div className="text-muted-foreground text-xs mt-0.5">
                      GSTIN: {cart.customer.gstin}
                    </div>
                  )}
                  {cart.customer.notes && (
                    <div className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">
                      {cart.customer.notes}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Walk-in customer.</p>
              )}
            </CardContent>
          </Card>

          {/* Payment method */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                <PayChoice
                  label="Cash"
                  Icon={Banknote}
                  active={cart.paymentMethod === "cash"}
                  onClick={() => {
                    cart.setPaymentMethod("cash");
                    cart.setAdvanceAmount(0);
                  }}
                />
                <PayChoice
                  label="Online"
                  Icon={Smartphone}
                  active={cart.paymentMethod === "online"}
                  onClick={() => {
                    cart.setPaymentMethod("online");
                    cart.setAdvanceAmount(0);
                  }}
                />
                <PayChoice
                  label="Credit"
                  Icon={CreditCard}
                  active={cart.paymentMethod === "credit"}
                  onClick={() => {
                    const isWalkIn =
                      !cart.customer.name?.trim() ||
                      cart.customer.name.trim().toLowerCase() === "walk-in customer" ||
                      cart.customer.name.trim().toLowerCase() === "walk-in" ||
                      cart.customer.name.trim().toLowerCase() === "walkin";

                    if (isWalkIn || !cart.customer.phone?.trim()) {
                      toast.info("Credit bills require registered customer details.", {
                        description: "Please enter customer name & phone number. Walk-in customers cannot generate bills in credit.",
                      });
                      setCustomerOpen(true);
                    }
                    cart.setPaymentMethod("credit");
                  }}
                />
              </div>

              {cart.paymentMethod === "credit" && (
                (!cart.customer.name?.trim() ||
                  cart.customer.name.trim().toLowerCase() === "walk-in customer" ||
                  cart.customer.name.trim().toLowerCase() === "walk-in" ||
                  cart.customer.name.trim().toLowerCase() === "walkin" ||
                  !cart.customer.phone?.trim()) && (
                  <div className="mt-3 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 p-2.5 rounded-lg flex items-start justify-between gap-2 animate-fade-in">
                    <div className="space-y-0.5">
                      <span className="font-semibold">Customer details required:</span>
                      <p className="text-[11px] text-muted-foreground">
                        Credit bills cannot be generated for Walk-in Customers. Please provide customer name and phone.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 text-[11px] px-2 shrink-0 border-amber-500/40 hover:bg-amber-500/20"
                      onClick={() => setCustomerOpen(true)}
                    >
                      Enter Details
                    </Button>
                  </div>
                )
              )}

              {cart.paymentMethod === "credit" && (
                <div className="mt-4 space-y-1.5 animate-fade-in">
                  <Label className="text-xs">Advance Payment (Optional)</Label>
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
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                  {cart.advanceAmount > 0 && (
                    <div className="mt-2 space-y-1 animate-fade-in">
                      <Label className="text-[11px] text-muted-foreground">Advance Pay Method</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={cart.advancePaymentMethod === "cash" ? "default" : "outline"}
                          size="sm"
                          className="flex-1 text-xs py-1 h-8"
                          onClick={() => cart.setAdvancePaymentMethod("cash")}
                        >
                          Cash
                        </Button>
                        <Button
                          type="button"
                          variant={cart.advancePaymentMethod === "online" ? "default" : "outline"}
                          size="sm"
                          className="flex-1 text-xs py-1 h-8"
                          onClick={() => cart.setAdvancePaymentMethod("online")}
                        >
                          Online
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Discount</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cart.setDiscountType("percentage")}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-md border transition-smooth text-center",
                    cart.discountType === "percentage"
                      ? "bg-primary/10 border-primary text-primary shadow-soft"
                      : "border-border hover:bg-accent/40",
                  )}
                >
                  % Percentage
                </button>
                <button
                  type="button"
                  onClick={() => cart.setDiscountType("flat")}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-md border transition-smooth text-center",
                    cart.discountType === "flat"
                      ? "bg-primary/10 border-primary text-primary shadow-soft"
                      : "border-border hover:bg-accent/40",
                  )}
                >
                  ₹ Flat Amount
                </button>
              </div>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {cart.discountType === "percentage" ? "%" : "₹"}
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={cart.discountType === "percentage" ? 100 : cart.subtotal + cart.tax}
                  value={cart.discountValue || ""}
                  onChange={(e) => cart.setDiscountValue(Number(e.target.value))}
                  className="pl-8"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {cart.discountType === "percentage"
                  ? "Enter discount percentage to reduce the total bill."
                  : "Enter flat discount amount to reduce the total bill."}
              </p>
            </CardContent>
          </Card>

          {hasRx && (
            <Card className="shadow-soft border-destructive/40">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <FileWarning className="h-4 w-4" /> Prescription required
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  This sale contains {rxItems.length} Rx item
                  {rxItems.length === 1 ? "" : "s"}:{" "}
                  <span className="font-medium text-foreground">
                    {rxItems.map((i) => i.product.name).join(", ")}
                  </span>
                  . Provide the prescription as a photo <em>or</em> reference text to continue.
                </p>
                <RxInput
                  refValue={cart.customer.prescriptionRef ?? ""}
                  photoValue={cart.customer.prescriptionPhoto ?? ""}
                  onChange={(patch) => cart.setCustomer({ ...cart.customer, ...patch })}
                />
              </CardContent>
            </Card>
          )}

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatMoney(cart.subtotal)} />
              <Row label="Tax" value={formatMoney(cart.tax)} />
              {cart.discount > 0 && (
                <Row
                  label="Discount"
                  value={`-${formatMoney(cart.discount)}`}
                  className="text-emerald-500"
                />
              )}
              {(() => {
                const roundOff = cart.total - (cart.subtotal + cart.tax - cart.discount);
                return Math.abs(roundOff) >= 0.01 ? (
                  <Row
                    label="Round Off"
                    value={`${roundOff > 0 ? "+" : ""}${formatMoney(roundOff)}`}
                    className="text-muted-foreground"
                  />
                ) : null;
              })()}
              <div className="border-t pt-2">
                <Row label="Total" value={formatMoney(cart.total)} bold />
              </div>
              <Button
                className="w-full shadow-soft mt-3"
                size="lg"
                onClick={handleOpenCheckout}
                disabled={cart.items.length === 0 || submitting || rxBlocked}
                id="cart-checkout-btn"
                title="Generate Bill (F9)"
              >
                {submitting
                  ? "Generating…"
                  : rxBlocked
                    ? "Add Rx photo or reference"
                    : "Generate bill"}
              </Button>

              {cart.items.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-2 gap-1.5 border-dashed border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                  onClick={handleSaveDraft}
                  title="Save current bill as draft"
                >
                  <Save className="h-4 w-4" />
                  Save as Draft (No stock change)
                </Button>
              )}

              <p className="text-xs text-center text-muted-foreground">
                Press <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-semibold">F9</kbd> to generate bill
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

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
              Remove{" "}
              <span className="font-semibold">{item.product.name}</span>
              {item.product.pack && (
                <span className="ml-1 text-[11px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                  {item.product.pack}
                </span>
              )}{" "}
              (qty&nbsp;<span className="font-semibold">{item.qty}</span>) from the cart?
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              This action cannot be undone. Press{" "}
              <kbd className="rounded border bg-muted px-1 py-0.5 font-semibold">Enter</kbd> to confirm,{" "}
              <kbd className="rounded border bg-muted px-1 py-0.5 font-semibold">Esc</kbd> to cancel.
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
      const activeBatches = batchesProduct.batches ? batchesProduct.batches.filter((b) => b.stock > 0) : [];
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
              <kbd className="rounded border bg-background px-1 py-0.5 font-semibold">↑↓</kbd> navigate
              <kbd className="rounded border bg-background px-1 py-0.5 font-semibold">↵</kbd> select
              <kbd className="rounded border bg-background px-1 py-0.5 font-semibold">Esc</kbd> close
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
                            isRed ? "border-l-red-500" : isOrange ? "border-l-amber-500" : "border-l-transparent"
                          )
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
                        <span>·</span>
                        <span className={cn(
                          "font-semibold",
                          outOfStock
                            ? "text-red-600 dark:text-red-400"
                            : isLowStock
                              ? "text-amber-600 dark:text-amber-400"
                              : ""
                        )}>
                          {outOfStock ? "Out of stock" : `${p.stock} in stock`}
                        </span>
                        <span>·</span>
                        <span className={cn(
                          isExpired || isNearExpiryRed
                            ? "text-red-600 dark:text-red-400 font-semibold"
                            : isNearExpiryOrange
                              ? "text-amber-600 dark:text-amber-400 font-semibold"
                              : ""
                        )}>
                          Exp: {new Date(p.expiry).toLocaleDateString()}
                          {isExpired ? " (Expired)" : isNearExpiryRed ? " (<30d)" : isNearExpiryOrange ? " (<90d)" : ""}
                        </span>
                      </div>
                    </div>
                    {isActive && !outOfStock ? (
                      <span className="text-xs text-primary font-semibold ml-2 shrink-0">↵ Add</span>
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
            <span>{filtered.length} product{filtered.length !== 1 ? "s" : ""} found</span>
            <span>{products.length} total in inventory</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Selection Dialog */}
      <Dialog open={!!batchesProduct} onOpenChange={(v) => { if (!v) setBatchesProduct(null); }}>
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
            {(batchesProduct?.batches || []).filter(b => b && b.stock > 0).map((b, idx) => {
              const isActive = idx === selectedBatchIdx;
              const now = Date.now();
              const expiryStr = b.expiry || "";
              const expTime = expiryStr ? new Date(expiryStr).getTime() : NaN;
              const daysToExpiry = isNaN(expTime) ? 999 : Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));
              const isExpired = !isNaN(expTime) && daysToExpiry < 0;

              return (
                <button
                  key={b.id}
                  type="button"
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg border text-xs flex justify-between items-center transition-all",
                    isActive
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-muted"
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
                      Expiry: {(() => {
                        if (!b.expiry) return "—";
                        const dateObj = new Date(b.expiry);
                        if (isNaN(dateObj.getTime())) return "—";
                        const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
                        const yy = String(dateObj.getFullYear()).substring(2);
                        return `${mm}/${yy}`;
                      })()} 
                      {isExpired && <span className="text-red-500 font-semibold"> (Expired)</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-primary">
                      {formatMoney(b.price)}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Stock: {b.stock} units
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
                const activeBatches = batchesProduct?.batches?.filter(b => b && b.stock > 0) || [];
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
      setForm({ ...emptyForm, taxPercent: String(defaultTax), name: defaultName });
      productsStore.list().then(setItems);
      try {
        setRecentCategories(JSON.parse(localStorage.getItem("recentCategories") || "[]"));
        setRecentManufacturers(JSON.parse(localStorage.getItem("recentManufacturers") || "[]"));
        setRecentHsns(JSON.parse(localStorage.getItem("recentHsns") || "[]"));
      } catch {}
    }
  }, [open, defaultTax, defaultName]);

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

    const pps = getPiecesPerStrip(packValue, form.stockType);
    let calculatedStock = Number(form.stock) || 0;
    if (isRetailer && (form.stockType === "tab" || form.stockType === "cap")) {
      if (form.stripStock !== "" || form.pcStock !== "") {
        calculatedStock = combineStripAndPcToQty(Number(form.stripStock || 0), Number(form.pcStock || 0), pps);
      }
    }

    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || "General",
      costPrice: form.costPrice === "" ? undefined : Number(form.costPrice),
      price: Number(form.price),
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
      conversionFactor: Number(form.conversionFactor) || 1,
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
        saveRecent("recentManufacturers", payload.manufacturer, recentManufacturers, setRecentManufacturers, 8);
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
                {recentCategories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </FieldInline>

            <FieldInline label="Manufacturer">
              <Input
                value={form.manufacturer}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                list="add-manufacturer-recent"
              />
              <datalist id="add-manufacturer-recent">
                {recentManufacturers.map((m) => <option key={m} value={m} />)}
              </datalist>
            </FieldInline>

            <FieldInline label={isRetailer && (form.stockType === "tab" || form.stockType === "cap") ? "Buying price (per Strip)" : "Buying price"}>
              <div className="space-y-1">
                <Input
                  type="number"
                  step="0.01"
                  value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                  placeholder="Cost per unit"
                  required
                />
                {isRetailer && (form.stockType === "tab" || form.stockType === "cap") && form.costPrice ? (
                  <span className="text-[10px] text-muted-foreground font-mono block">
                    ≈ ₹{getPerPcPrice(Number(form.costPrice), getPiecesPerStrip(form.stockPacks, form.stockType)).toFixed(2)}/pc
                  </span>
                ) : null}
              </div>
            </FieldInline>

            <FieldInline label={isRetailer && (form.stockType === "tab" || form.stockType === "cap") ? "Selling price (per Strip)" : "Selling price"}>
              <div className="space-y-1">
                <Input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                />
                {isRetailer && (form.stockType === "tab" || form.stockType === "cap") && form.price ? (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium block">
                    ≈ ₹{getPerPcPrice(Number(form.price), getPiecesPerStrip(form.stockPacks, form.stockType)).toFixed(2)}/pc
                  </span>
                ) : null}
              </div>
            </FieldInline>

            <FieldInline label={isRetailer && (form.stockType === "tab" || form.stockType === "cap") ? "MRP (per Strip)" : "MRP"}>
              <div className="space-y-1">
                <Input
                  type="number"
                  step="0.01"
                  value={form.mrp}
                  onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                  placeholder="Printed price"
                />
                {isRetailer && (form.stockType === "tab" || form.stockType === "cap") && form.mrp ? (
                  <span className="text-[10px] text-muted-foreground font-mono block">
                    ≈ ₹{getPerPcPrice(Number(form.mrp), getPiecesPerStrip(form.stockPacks, form.stockType)).toFixed(2)}/pc
                  </span>
                ) : null}
              </div>
            </FieldInline>

            <FieldInline label="Stock Type">
              <select
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.stockType}
                onChange={(e) => {
                  const type = e.target.value;
                  setForm({ ...form, stockType: type, stockPacks: "", stockUnits: type === "inj" ? "ML" : "" });
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

            {isRetailer && (form.stockType === "tab" || form.stockType === "cap") ? (
              <FieldInline label={`Initial Stock (${form.stockType === "tab" ? "Tablets" : "Capsules"})`}>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      type="number"
                      min="0"
                      value={form.stripStock}
                      onChange={(e) => setForm({ ...form, stripStock: e.target.value })}
                      placeholder="Strips"
                    />
                    <span className="text-[10px] text-muted-foreground">Strips</span>
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
                {recentHsns.map((h) => <option key={h} value={h} />)}
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
    <div className={`flex justify-between ${bold ? "font-semibold text-base" : ""} ${className ?? ""}`}>
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
      customersStore.list().then(setSavedCustomers).catch(() => setSavedCustomers([]));
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
      .filter((c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.toLowerCase().includes(q)))
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
    if (cart.paymentMethod === "credit" && (!hasRegisteredCustomer || !cart.customer.phone?.trim())) {
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
      <DialogContent className={cn(
        "max-h-[92vh] overflow-y-auto transition-all",
        step === "preview" ? "sm:max-w-4xl" : "sm:max-w-2xl"
      )}>
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
                    Choose payment mode, handle cash tender or credit terms before previewing the invoice.
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
                          <span className="text-[10px] text-muted-foreground">{c.phone || "No phone"}</span>
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
                <form onSubmit={handleSaveNewCustomer} className="space-y-3 bg-background p-3 rounded-md border animate-in fade-in-50 text-xs">
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
                      <Input
                        value={newCustForm.phone}
                        onChange={(e) => setNewCustForm({ ...newCustForm, phone: e.target.value })}
                        required
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px]">GSTIN</Label>
                      <Input
                        value={newCustForm.gstin}
                        onChange={(e) => setNewCustForm({ ...newCustForm, gstin: e.target.value.toUpperCase() })}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Drug Lic No.</Label>
                      <Input
                        value={newCustForm.drugLicNo}
                        onChange={(e) => setNewCustForm({ ...newCustForm, drugLicNo: e.target.value.toUpperCase() })}
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
                  <Button type="submit" size="sm" className="w-full h-8 text-xs">
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
                      : "border-border hover:bg-muted/50 text-foreground"
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
                      : "border-border hover:bg-muted/50 text-foreground"
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
                      : "border-border hover:bg-muted/50 text-foreground"
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
                      <span className={cn(
                        "text-xl font-extrabold font-mono tabular-nums block mt-1",
                        changeToReturn >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                      )}>
                        {changeToReturn >= 0 ? `₹${changeToReturn.toFixed(2)}` : `-₹${Math.abs(changeToReturn).toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  {/* Quick Cash Buttons */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] text-muted-foreground font-medium">Quick Tender:</span>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => setCashReceived(String(cart.total))}
                      >
                        Exact (₹{cart.total.toFixed(0)})
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
                      {[100, 200, 500, 2000].filter(n => n >= cart.total).slice(0, 3).map((amt) => (
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
                    Collect ₹{cart.total.toFixed(2)} via UPI QR scanner, Card POS machine, or Netbanking.
                  </p>
                </div>
              )}

              {/* Credit Mode Options */}
              {cart.paymentMethod === "credit" && (
                <div className="rounded-lg border p-4 bg-muted/10 space-y-3.5 animate-in fade-in-50">
                  {(!hasRegisteredCustomer || !cart.customer.phone?.trim()) ? (
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
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
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
                      <Label className="text-xs font-semibold block text-muted-foreground">Remaining Balance Due</Label>
                      <span className="text-lg font-bold font-mono text-primary block mt-1">
                        ₹{creditBalanceDue.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {cart.advanceAmount > 0 && (
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Advance Received Via</Label>
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
              <Button
                type="button"
                onClick={handleProceedToPreview}
                className="shadow-soft"
              >
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
                    Please review invoice line items, party information, and payment details before confirmation.
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
                  <span className="text-xs font-bold uppercase text-primary tracking-wider block">TAX INVOICE</span>
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
                  <span className="font-bold text-primary uppercase block mb-0.5 text-[10px]">BILLED TO:</span>
                  <span className="font-semibold text-foreground block text-xs">
                    {cart.customer.name || "Walk-in Customer"}
                  </span>
                  {cart.customer.phone && <span className="text-muted-foreground block">Phone: {cart.customer.phone}</span>}
                  {cart.customer.address && <span className="text-muted-foreground block truncate">{cart.customer.address}</span>}
                  {cart.customer.gstin && <span className="text-muted-foreground block">GSTIN: {cart.customer.gstin}</span>}
                </div>
                <div className="text-right">
                  <span className="font-bold text-primary uppercase block mb-0.5 text-[10px]">PAYMENT TERMS:</span>
                  <span className="font-semibold text-foreground uppercase block text-xs">
                    {cart.paymentMethod}
                  </span>
                  {cart.paymentMethod === "cash" && cashNum > 0 && (
                    <span className="text-muted-foreground block">
                      Tendered: ₹{cashNum.toFixed(2)} (Change: ₹{Math.max(0, changeToReturn).toFixed(2)})
                    </span>
                  )}
                  {cart.paymentMethod === "credit" && (
                    <span className="text-muted-foreground block">
                      Advance: ₹{advanceNum.toFixed(2)} | Balance Due: ₹{creditBalanceDue.toFixed(2)}
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
                      const pps = getPiecesPerStrip(it.product.pack, it.product.stockType);
                      const isTabCap = isRetailer && isTabOrCap(it.product.stockType || it.product.pack);
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
                          <td className="py-2 px-2 text-center font-mono text-muted-foreground">{expFormatted}</td>
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
                          <td className="py-2 px-2 text-right font-mono font-semibold">₹{lineAmt.toFixed(2)}</td>
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
                        <span>{roundOff > 0 ? "+" : ""}{formatMoney(roundOff)}</span>
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
