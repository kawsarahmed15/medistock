import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { billsStore, productsStore, type Product } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerDetailsDialog } from "@/components/customer-details-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/cart")({
  component: CartPage,
});

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);
}

function CartPage() {
  const cart = useCart();
  const { session } = useAuth();
  const navigate = useNavigate();

  // Core lists
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [highlightedSearchIdx, setHighlightedSearchIdx] = useState(0);

  // Custom inline states for Cart Items
  const [customBatches, setCustomBatches] = useState<Record<string, string>>({});
  const [customExpiries, setCustomExpiries] = useState<Record<string, string>>({});
  const [customMrps, setCustomMrps] = useState<Record<string, number>>({});
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, number>>({});

  // Dialog States
  const [customerOpen, setCustomerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Load products list on mount
  useEffect(() => {
    productsStore.list().then(setProducts).catch(console.error);
  }, []);

  // Filter products by Name, Category, SKU/Barcode, Batch, Manufacturer
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const needle = query.toLowerCase().trim();
    return products.filter((p) =>
      p.name.toLowerCase().includes(needle) ||
      p.category.toLowerCase().includes(needle) ||
      (p.sku && p.sku.toLowerCase().includes(needle)) ||
      (p.batch && p.batch.toLowerCase().includes(needle)) ||
      (p.manufacturer && p.manufacturer.toLowerCase().includes(needle))
    ).slice(0, 10);
  }, [products, query]);

  // Calculations
  const hasCustomer = !!(cart.customer.name || cart.customer.phone || cart.customer.address);
  const rxItems = cart.items.filter((i) => i.product.prescription);
  const hasRx = rxItems.length > 0;
  const prescriptionRef = (cart.customer.prescriptionRef ?? "").trim();
  const prescriptionPhoto = (cart.customer.prescriptionPhoto ?? "").trim();
  const rxBlocked = hasRx && !prescriptionRef && !prescriptionPhoto;

  const confirmAdd = (p: Product) => {
    // Check if expired
    if (p.expiry && new Date(p.expiry) < new Date()) {
      const ok = window.confirm(`WARNING: ${p.name} has expired on ${new Date(p.expiry).toLocaleDateString()}! Are you sure you want to add it?`);
      if (!ok) return;
    }
    // Check stock
    if (p.stock <= 0) {
      toast.error(`${p.name} is out of stock`);
      return;
    }
    cart.add(p, 1);
    setQuery("");
    setHighlightedSearchIdx(0);
    toast.success(`${p.name} added to cart`);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const exactMatch = products.find(p => p.sku === query || p.id === query);
      if (exactMatch) {
        confirmAdd(exactMatch);
        return;
      }
      const selected = searchResults[highlightedSearchIdx];
      if (selected) {
        confirmAdd(selected);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedSearchIdx(prev => Math.min(searchResults.length - 1, prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedSearchIdx(prev => Math.max(0, prev - 1));
    } else if (e.key === "Escape") {
      setQuery("");
      setHighlightedSearchIdx(0);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextCol = col + 1;
      const nextEl = document.getElementById(`input-${row}-${nextCol}`) || document.getElementById(`input-${row + 1}-0`);
      if (nextEl) {
        (nextEl as HTMLInputElement).focus();
        (nextEl as HTMLInputElement).select();
      }
    }
  };

  const [submitting, setSubmitting] = useState(false);

  // Save / Print Bill Checkout
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
        customerNotes: combinedNotes || undefined,
        cashier: session?.name || "Cashier",
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
          mrp: customMrps[i.product.id] ?? i.product.mrp ?? i.product.price,
          batch: customBatches[i.product.id] ?? i.product.batch ?? i.product.batch,
          pack: i.product.pack,
          expiry: customExpiries[i.product.id] ?? i.product.expiry ?? i.product.expiry,
        })),
        subtotal: cart.subtotal,
        tax: cart.tax,
        total: cart.total,
      });

      await Promise.all(cart.items.map((i) => productsStore.decrementStock(i.product.id, i.qty)));
      cart.clear();
      toast.success(`Bill ${bill.number} generated`);
      navigate({ to: `/bills/${bill.id}` });
    } catch (e) {
      toast.error((e as Error).message || "Failed to generate bill");
    } finally {
      setSubmitting(false);
    }
  };

  // Keyboard Shortcuts handling
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      const isFKey = /^F[0-9]+$/.test(e.key);
      const isCtrlKey = e.ctrlKey;
      
      if (!isFKey && !isCtrlKey) return;

      if (e.key === "F2") {
        e.preventDefault();
        setCustomerOpen(true);
      } else if (e.key === "F9") {
        e.preventDefault();
        void checkout();
      } else if (e.ctrlKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        document.getElementById("cart-medicine-search")?.focus();
      }
    };

    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  });

  return (
    <div className="flex flex-col xl:flex-row gap-4 h-[calc(100vh-6rem)] overflow-hidden text-slate-800">
      
      {/* LEFT COLUMN: Search & Cart Items Table (70%) */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 h-full">
        {/* Search Header Bar */}
        <div className="flex gap-2 items-center bg-white border p-2 rounded-xl shadow-sm relative">
          <Search className="h-5 w-5 text-slate-400 ml-2" />
          <input
            id="cart-medicine-search"
            type="text"
            className="flex-1 outline-none text-base font-medium placeholder:text-slate-400 bg-transparent py-1.5"
            placeholder="Search Medicine (Name / Barcode / Batch / Generic)  [Ctrl + F]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            autoFocus
          />

          {/* Instant Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border rounded-xl shadow-xl z-50 mt-1 max-h-72 overflow-y-auto divide-y">
              {searchResults.map((p, idx) => (
                <div
                  key={p.id}
                  onClick={() => confirmAdd(p)}
                  className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                    highlightedSearchIdx === idx
                      ? "bg-primary/10 border-l-4 border-primary"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div>
                    <span className="font-semibold text-slate-800">{p.name}</span>
                    <span className="text-xs text-slate-400 ml-2 bg-slate-100 px-1.5 py-0.5 rounded">
                      {p.category}
                    </span>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <span className="mr-3">Stock: <b className={p.stock < 10 ? "text-rose-600" : ""}>{p.stock}</b></span>
                    <span>MRP: {formatMoney(p.price)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart items list container */}
        <div className="flex-1 bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="overflow-x-auto flex-1 min-h-0">
            <table className="w-full text-left border-collapse text-xs select-none">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 w-8">#</th>
                  <th className="py-2.5 px-3">Medicine</th>
                  <th className="py-2.5 px-3 w-24">Batch</th>
                  <th className="py-2.5 px-3 w-24">Expiry</th>
                  <th className="py-2.5 px-3 w-16 text-right">Qty</th>
                  <th className="py-2.5 px-3 w-16 text-right">Free</th>
                  <th className="py-2.5 px-3 w-20 text-right">MRP</th>
                  <th className="py-2.5 px-3 w-20 text-right">Rate</th>
                  <th className="py-2.5 px-3 w-16 text-right">Disc %</th>
                  <th className="py-2.5 px-3 w-12 text-center">GST</th>
                  <th className="py-2.5 px-3 w-24 text-right">Total</th>
                  <th className="py-2.5 px-2 w-8 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 min-h-0 overflow-y-auto">
                {cart.items.map((item, idx) => {
                  const p = item.product;
                  const discount = itemDiscounts[p.id] || 0;
                  const price = item.customPrice ?? p.price;
                  const mrp = customMrps[p.id] ?? p.mrp ?? p.price;
                  const batch = customBatches[p.id] ?? p.batch ?? "B-1";
                  const expiry = customExpiries[p.id] ?? p.expiry ?? "2030-01-01";
                  const itemTotal = (price * (1 - discount / 100)) * Math.max(0, item.qty - (item.freeQty || 0));

                  const isLowStock = p.stock < 10;
                  const isExpired = p.expiry && new Date(p.expiry) < new Date();

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/50 group transition-colors ${
                        isExpired ? "bg-rose-50/30" : ""
                      }`}
                    >
                      <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2 px-3 font-medium">
                        <div className="font-semibold text-slate-800">{p.name}</div>
                        <div className="text-[10px] text-slate-400 flex gap-2 mt-0.5">
                          {p.category}
                          {isLowStock && <span className="text-rose-500 font-bold">Low Stock ({p.stock})</span>}
                          {isExpired && <span className="text-rose-600 font-bold">Expired</span>}
                        </div>
                      </td>
                      <td className="py-2 px-1">
                        <input
                          id={`input-${idx}-0`}
                          type="text"
                          className="w-full px-2 py-1 border rounded bg-transparent focus:bg-white outline-none text-slate-800"
                          value={batch}
                          onChange={(e) => setCustomBatches({ ...customBatches, [p.id]: e.target.value })}
                          onKeyDown={(e) => handleInputKeyDown(e, idx, 0)}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <input
                          id={`input-${idx}-1`}
                          type="text"
                          placeholder="YYYY-MM"
                          className="w-full px-2 py-1 border rounded bg-transparent focus:bg-white outline-none text-slate-800"
                          value={expiry.slice(0, 7)}
                          onChange={(e) => setCustomExpiries({ ...customExpiries, [p.id]: e.target.value })}
                          onKeyDown={(e) => handleInputKeyDown(e, idx, 1)}
                        />
                      </td>
                      <td className="py-2 px-1 text-right">
                        <input
                          id={`input-${idx}-2`}
                          type="number"
                          min={1}
                          className="w-14 px-2 py-1 border rounded text-right bg-transparent focus:bg-white outline-none font-semibold text-slate-800"
                          value={item.qty}
                          onChange={(e) => cart.setQty(p.id, Number(e.target.value))}
                          onKeyDown={(e) => handleInputKeyDown(e, idx, 2)}
                        />
                      </td>
                      <td className="py-2 px-1 text-right">
                        <input
                          id={`input-${idx}-3`}
                          type="number"
                          min={0}
                          className="w-12 px-2 py-1 border rounded text-right bg-transparent focus:bg-white outline-none text-slate-800"
                          value={item.freeQty || 0}
                          onChange={(e) => cart.setFreeQty(p.id, Number(e.target.value))}
                          onKeyDown={(e) => handleInputKeyDown(e, idx, 3)}
                        />
                      </td>
                      <td className="py-2 px-1 text-right">
                        <input
                          id={`input-${idx}-4`}
                          type="number"
                          step="0.01"
                          className="w-16 px-2 py-1 border rounded text-right bg-transparent focus:bg-white outline-none text-slate-800"
                          value={mrp}
                          onChange={(e) => setCustomMrps({ ...customMrps, [p.id]: Number(e.target.value) })}
                          onKeyDown={(e) => handleInputKeyDown(e, idx, 4)}
                        />
                      </td>
                      <td className="py-2 px-1 text-right">
                        <input
                          id={`input-${idx}-5`}
                          type="number"
                          step="0.01"
                          className="w-16 px-2 py-1 border rounded text-right bg-transparent focus:bg-white outline-none text-slate-800 font-semibold"
                          value={price}
                          onChange={(e) => cart.setCustomPrice(p.id, Number(e.target.value))}
                          onKeyDown={(e) => handleInputKeyDown(e, idx, 5)}
                        />
                      </td>
                      <td className="py-2 px-1 text-right">
                        <input
                          id={`input-${idx}-6`}
                          type="number"
                          min={0}
                          max={100}
                          className="w-12 px-2 py-1 border rounded text-right bg-transparent focus:bg-white outline-none text-slate-800"
                          value={discount}
                          onChange={(e) => setItemDiscounts({ ...itemDiscounts, [p.id]: Number(e.target.value) })}
                          onKeyDown={(e) => handleInputKeyDown(e, idx, 6)}
                        />
                      </td>
                      <td className="py-2 px-3 text-center text-slate-500 font-mono">
                        {p.taxPercent ?? 12}%
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-800 tabular-nums">
                        {formatMoney(itemTotal)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          onClick={() => cart.remove(p.id)}
                          className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {cart.items.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-16 text-center text-slate-400 font-medium text-sm">
                      <ShoppingCart className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                      Cart is empty. Scan barcode or type in search bar to add medicines.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Old layout card components (30%) */}
      <div className="w-full xl:w-96 flex flex-col gap-4 min-w-[24rem] h-full overflow-y-auto pb-4">
        
        {/* Customer Info Card */}
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

        {/* Payment Card */}
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

        {/* Discount Card */}
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

        {/* Prescription Card */}
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

        {/* Summary Card */}
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

      <CustomerDetailsDialog open={customerOpen} onOpenChange={setCustomerOpen} />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Remove from cart?
            </DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  cart.remove(deleteTarget);
                  setDeleteTarget(null);
                }
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
