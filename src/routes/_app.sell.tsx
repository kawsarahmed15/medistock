import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { FileWarning, Plus, Search } from "lucide-react";
import { productsStore, type Product } from "@/lib/storage";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerDetailsDialog } from "@/components/customer-details-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Minus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { SellSkeleton } from "@/components/loading-skeleton";

type SellSearch = { add?: string; new?: number };

export const Route = createFileRoute("/_app/sell")({
  validateSearch: (search: Record<string, unknown>): SellSearch => ({
    add: typeof search.add === "string" ? search.add : undefined,
    new: search.new ? 1 : undefined,
  }),
  component: SellPage,
});

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);
}

function SellPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [qtyProduct, setQtyProduct] = useState<Product | null>(null);
  const [qtyValue, setQtyValue] = useState(1);
  const cart = useCart();
  const navigate = useNavigate();

  const [focusedIdx, setFocusedIdx] = useState(0);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setFocusedIdx(0);
  }, [query]);

  useEffect(() => {
    if (buttonRefs.current[focusedIdx]) {
      buttonRefs.current[focusedIdx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focusedIdx]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (qtyProduct || customerOpen) return;

      const activeEl = document.activeElement;
      const isSearchFocused = activeEl && activeEl.id === "sell-search-input";

      if (isSearchFocused) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          document.getElementById("sell-search-input")?.blur();
          setFocusedIdx(0);
        }
        return;
      }

      const colCount = (() => {
        if (typeof window === "undefined") return 1;
        const w = window.innerWidth;
        if (w >= 1280) return 4;
        if (w >= 1024) return 3;
        if (w >= 640) return 2;
        return 1;
      })();

      if (e.key === "ArrowRight") {
        e.preventDefault();
        setFocusedIdx((prev) => Math.min(filtered.length - 1, prev + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusedIdx((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIdx((prev) => Math.min(filtered.length - 1, prev + colCount));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIdx((prev) => Math.max(0, prev - colCount));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const p = filtered[focusedIdx];
        if (p && p.stock > 0) {
          openQtyPicker(p);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        document.getElementById("sell-search-input")?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filtered, qtyProduct, customerOpen, focusedIdx]);

  const refresh = async () => {
    try {
      const list = await productsStore.list();
      setProducts(list);
      return list;
    } catch (e) {
      toast.error((e as Error).message || "Failed to load products");
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = Route.useSearch();
  const routeNavigate = Route.useNavigate();

  // Marg F2 flow: when arriving with ?add=<productId>, push it into the cart
  useEffect(() => {
    if (!search.add) return;
    let cancelled = false;
    (async () => {
      const list = await refresh();
      if (cancelled) return;
      const p = list.find((x) => x.id === search.add);
      if (p && p.stock > 0) {
        const { isFirst } = cart.add(p, 1);
        toast.success(`${p.name} added to cart`);
        if (isFirst && !cart.customerSubmitted) setCustomerOpen(true);
      } else if (p) {
        toast.error(`${p.name} is out of stock`);
      }
      routeNavigate({ search: {}, replace: true });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.add]);

  // Handle Alt+N shortcut via custom event
  useEffect(() => {
    const handler = () => {
      document.getElementById("sell-search-input")?.focus();
      toast.success("Started a new bill");
    };
    window.addEventListener("trigger-new-bill", handler);
    return () => window.removeEventListener("trigger-new-bill", handler);
  }, []);

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.category.toLowerCase().includes(query.toLowerCase()),
      ),
    [products, query],
  );

  const openQtyPicker = (p: Product) => {
    setQtyProduct(p);
    setQtyValue(1);
  };

  const confirmAdd = () => {
    if (!qtyProduct) return;
    const { isFirst } = cart.add(qtyProduct, qtyValue);
    toast.success(`${qtyProduct.name} × ${qtyValue} added`);
    setQtyProduct(null);
    if (isFirst && !cart.customerSubmitted) {
      setCustomerOpen(true);
    }
  };

  const maxQty = qtyProduct
    ? qtyProduct.stock - (cart.items.find((i) => i.product.id === qtyProduct.id)?.qty ?? 0)
    : 1;

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Sell</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tap a product to add it. Use the floating cart button to checkout.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/cart" })}
          disabled={cart.count === 0}
        >
          <ShoppingCart className="h-4 w-4" />
          {cart.count > 0 ? `Open cart (${cart.count})` : "Cart empty"}
        </Button>
      </div>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="sell-search-input"
          placeholder="Search products in stock…"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <SellSkeleton />
      ) : filtered.length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {products.length === 0
              ? "No products in inventory yet. Add one from the Inventory page."
              : "No matching products in stock."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.slice(0, 50).map((p, i) => (
            <button
              key={p.id}
              ref={(el) => (buttonRefs.current[i] = el)}
              onClick={() => p.stock > 0 && openQtyPicker(p)}
              disabled={p.stock <= 0}
              className={`text-left rounded-xl border p-4 shadow-soft transition-smooth animate-fade-in outline-none ${
                p.stock > 0
                  ? `bg-card hover:shadow-glow hover:-translate-y-0.5 ${
                      focusedIdx === i
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border"
                    }`
                  : "bg-muted opacity-50 cursor-not-allowed border-border"
              }`}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-1.5">
                    {p.name}
                    {p.prescription && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive shrink-0"
                        title="Prescription required"
                      >
                        Rx
                      </span>
                    )}
                    {p.pack && (
                      <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                        {p.pack}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.category} {p.manufacturer ? `· ${p.manufacturer}` : ""}
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-accent text-accent-foreground shrink-0">
                  {p.stock} in stock
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-semibold">{formatMoney(p.price)}</span>
                <span className="inline-flex items-center gap-1 text-xs text-primary">
                  <Plus className="h-3 w-3" /> Add
                </span>
              </div>
              {p.prescription && (
                <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-destructive/80">
                  <FileWarning className="h-3 w-3" /> Prescription needed at checkout
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Quantity picker dialog */}
      <Dialog open={!!qtyProduct} onOpenChange={(v) => !v && setQtyProduct(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base">Add to cart</DialogTitle>
          </DialogHeader>
          {qtyProduct && (
            <div className="space-y-4">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {qtyProduct.name}
                  {qtyProduct.pack && (
                    <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                      {qtyProduct.pack}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatMoney(qtyProduct.price)} per unit · {maxQty} available
                </div>
              </div>

              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setQtyValue(Math.max(1, qtyValue - 1))}
                  disabled={qtyValue <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={maxQty}
                  value={qtyValue}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (maxQty >= 1) confirmAdd();
                    } else if (e.key === "+" || e.key === "ArrowUp") {
                      e.preventDefault();
                      setQtyValue(Math.min(maxQty, qtyValue + 1));
                    } else if (e.key === "-" || e.key === "ArrowDown") {
                      e.preventDefault();
                      setQtyValue(Math.max(1, qtyValue - 1));
                    }
                  }}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) setQtyValue(Math.max(1, Math.min(maxQty, v)));
                    else setQtyValue(1);
                  }}
                  className="w-20 text-center text-lg font-semibold tabular-nums"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => setQtyValue(Math.min(maxQty, qtyValue + 1))}
                  disabled={qtyValue >= maxQty}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                Total:{" "}
                <span className="font-semibold text-foreground">
                  {formatMoney(qtyProduct.price * qtyValue)}
                </span>
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setQtyProduct(null)}>
                  Cancel
                </Button>
                <Button className="shadow-soft" onClick={confirmAdd} disabled={maxQty < 1}>
                  <ShoppingCart className="h-4 w-4" /> Add × {qtyValue}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CustomerDetailsDialog open={customerOpen} onOpenChange={setCustomerOpen} />
    </div>
  );
}
