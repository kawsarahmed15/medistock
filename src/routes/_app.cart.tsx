import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback, type FormEvent } from "react";
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { billsStore, productsStore, type Product } from "@/lib/storage";
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
import { Switch } from "@/components/ui/switch";
import { SkuScanner } from "@/components/sku-scanner";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const navigate = useNavigate();
  const search = Route.useSearch();
  const routeNavigate = Route.useNavigate();
  const [customerOpen, setCustomerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
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

  // ── Refs to keep stable handler closure with always-fresh values ────────────
  const selectedIdxRef = useRef(selectedIdx);
  const addOpenRef = useRef(addOpen);
  const customerOpenRef = useRef(customerOpen);
  const deleteTargetRef = useRef(deleteTarget);
  const cartRef = useRef(cart);
  const checkoutRef = useRef<() => Promise<void>>();

  // Keep refs in sync every render (no re-subscription needed)
  useEffect(() => { selectedIdxRef.current = selectedIdx; });
  useEffect(() => { addOpenRef.current = addOpen; });
  useEffect(() => { customerOpenRef.current = customerOpen; });
  useEffect(() => { deleteTargetRef.current = deleteTarget; });
  useEffect(() => { cartRef.current = cart; });

  const checkout = async () => {
    if (cart.items.length === 0 || submitting) return;
    if (rxBlocked) {
      toast.error("Prescription reference is required for Rx items. Add it below.");
      return;
    }

    if (cart.customer.name && !cart.customer.phone?.trim()) {
      toast.error("Phone number is mandatory when adding a customer.");
      return;
    }
    if (
      cart.paymentMethod === "credit" &&
      (!cart.customer.name?.trim() || !cart.customer.phone?.trim())
    ) {
      toast.error("Customer name and phone number are mandatory for credit payments.");
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
      await Promise.all(cart.items.map((i) => productsStore.decrementStock(i.product.id, i.qty)));
      cart.clear();
      toast.success(`Bill ${bill.number} generated`);
      navigate({ to: "/bills/$id", params: { id: bill.id } });
    } catch (e) {
      toast.error((e as Error).message || "Failed to generate bill");
    } finally {
      setSubmitting(false);
    }
  };

  // Keep checkoutRef in sync so the stable keyboard handler can call it
  checkoutRef.current = checkout;

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

      // F9 → Generate bill
      if (e.key === "F9" && !isTyping) {
        e.preventDefault();
        void checkoutRef.current?.();
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" /> Cart
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review items, choose payment, and finalize the sale.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button asChild variant="ghost" size="sm">
            <Link to="/sell">Sell page</Link>
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
                                        {b.batch || "No Batch"} (Stock: {b.stock} · Exp: {b.expiry ? new Date(b.expiry).toLocaleDateString().slice(3) : "N/A"})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              );
                            }
                            return (
                              <div className="text-[11px] text-muted-foreground mt-1 font-medium">
                                Batch: <span className="font-semibold text-slate-800 dark:text-slate-200">{i.product.batch || "—"}</span>
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
                                    key={`${i.product.id}-${i.customPrice ?? i.product.price}`}
                                    className="w-16 h-6 px-1.5 border rounded bg-background text-foreground outline-none font-medium focus:ring-1 focus:ring-primary text-xs"
                                    defaultValue={i.customPrice !== undefined ? i.customPrice : i.product.price}
                                    onBlur={(e) => {
                                      const val = parseFloat(e.target.value);
                                      const cost = i.product.costPrice ?? 0;
                                      if (isNaN(val) || val <= cost) {
                                        toast.error(`Price must be higher than buying price (${formatMoney(cost)}). Please fix the price.`);
                                        e.target.value = String(i.customPrice !== undefined ? i.customPrice : i.product.price);
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
                                {i.product.costPrice ? (
                                  <span className="text-[10px] bg-muted px-1 py-0.5 rounded text-muted-foreground">
                                    Buying: {formatMoney(i.product.costPrice)}
                                  </span>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>

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
                              {Array.from({ length: i.qty + 1 }, (_, k) => (
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
                  onClick={() => cart.setPaymentMethod("credit")}
                />
              </div>

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
                onClick={() => void checkout()}
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
              <p className="text-xs text-center text-muted-foreground">
                Press <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-semibold">F9</kbd> to generate bill
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <CustomerDetailsDialog open={customerOpen} onOpenChange={setCustomerOpen} />
      <CartAddDialog open={addOpen} onOpenChange={setAddOpen} />

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

    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || "General",
      costPrice: form.costPrice === "" ? undefined : Number(form.costPrice),
      price: Number(form.price),
      mrp: form.mrp === "" ? undefined : Number(form.mrp),
      stock: Number(form.stock) || 0,
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
      batch: form.batch.trim() || undefined,
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

            <FieldInline label="Stock Quantity">
              <Input
                type="number"
                placeholder="Total qty"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                required
              />
            </FieldInline>

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
                onChange={(e) => setForm({ ...form, batch: e.target.value })}
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
