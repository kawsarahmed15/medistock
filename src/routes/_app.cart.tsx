import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  ShoppingCart,
  User,
  Phone,
  UserPlus,
  CreditCard,
  Plus,
  Trash2,
  AlertTriangle,
  FolderOpen,
  Save,
  Printer,
  History,
  FileText,
  ScanLine,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { billsStore, productsStore, type Product } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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

  // Customer Panel inputs
  const [custName, setCustName] = useState(cart.customer.name || "");
  const [custPhone, setCustPhone] = useState(cart.customer.phone || "");
  const [custDoctor, setCustDoctor] = useState("");
  const [custGst, setCustGst] = useState("");
  const [custLoyalty, setCustLoyalty] = useState("Regular Member");

  // Dialog States
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [recallOpen, setRecallOpen] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  // Hold / Recall Bills state (In-memory for POS speed)
  const [heldBills, setHeldBills] = useState<{ id: string; customerName: string; items: any[]; time: string }[]>([]);

  // Payment Calculation variables
  const [amountPaid, setAmountPaid] = useState("");

  // Keep customer input fields synced with cart context
  useEffect(() => {
    setCustName(cart.customer.name || "");
    setCustPhone(cart.customer.phone || "");
  }, [cart.customer.name, cart.customer.phone]);

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

  // Handle auto-save of draft every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (cart.items.length > 0) {
        localStorage.setItem("medistock_cart_draft", JSON.stringify({
          items: cart.items,
          customer: cart.customer,
          discountValue: cart.discountValue,
          discountType: cart.discountType,
          paymentMethod: cart.paymentMethod,
        }));
        setDraftSavedAt(new Date().toLocaleTimeString());
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [cart]);

  // Restore draft if exists
  useEffect(() => {
    const draft = localStorage.getItem("medistock_cart_draft");
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.items && parsed.items.length > 0 && cart.items.length === 0) {
          parsed.items.forEach((item: any) => {
            cart.add(item.product, item.qty);
            if (item.freeQty) cart.setFreeQty(item.product.id, item.freeQty);
            if (item.customPrice) cart.setCustomPrice(item.product.id, item.customPrice);
          });
          if (parsed.customer) cart.setCustomer(parsed.customer);
          if (parsed.discountValue) cart.setDiscountValue(parsed.discountValue);
          if (parsed.discountType) cart.setDiscountType(parsed.discountType);
          if (parsed.paymentMethod) cart.setPaymentMethod(parsed.paymentMethod);
          toast.success("Restored previous cart draft");
        }
      } catch (e) {
        console.error("Failed to restore draft", e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // calculations
  const totalItemLines = cart.items.length;
  const totalQty = cart.items.reduce((s, i) => s + i.qty, 0);

  // Subtotal with overrides applied
  const subtotalWithOverrides = useMemo(() => {
    return cart.items.reduce((sum, item) => {
      const price = item.customPrice ?? item.product.price;
      const billableQty = Math.max(0, item.qty - (item.freeQty || 0));
      return sum + (price * billableQty);
    }, 0);
  }, [cart.items]);

  // GST with overrides
  const taxWithOverrides = useMemo(() => {
    return cart.items.reduce((sum, item) => {
      const price = item.customPrice ?? item.product.price;
      const billableQty = Math.max(0, item.qty - (item.freeQty || 0));
      const taxRate = item.product.taxPercent ?? 0;
      const discount = itemDiscounts[item.product.id] || 0;
      const discountedPrice = price * (1 - discount / 100);
      return sum + ((discountedPrice * billableQty * taxRate) / 100);
    }, 0);
  }, [cart.items, itemDiscounts]);

  // Item discounts sum
  const itemDiscountsTotal = useMemo(() => {
    return cart.items.reduce((sum, item) => {
      const price = item.customPrice ?? item.product.price;
      const billableQty = Math.max(0, item.qty - (item.freeQty || 0));
      const discount = itemDiscounts[item.product.id] || 0;
      return sum + (price * billableQty * (discount / 100));
    }, 0);
  }, [cart.items, itemDiscounts]);

  const grossAmount = subtotalWithOverrides;
  const discountTotal = cart.discount + itemDiscountsTotal;
  const rawNetTotal = Math.max(0, grossAmount + taxWithOverrides - discountTotal);
  const roundedNetTotal = Math.round(rawNetTotal);
  const roundOffValue = roundedNetTotal - rawNetTotal;

  // Paid and change fields
  const parsedPaid = parseFloat(amountPaid) || 0;
  const changeValue = Math.max(0, parsedPaid - roundedNetTotal);
  const balanceValue = Math.max(0, roundedNetTotal - parsedPaid);

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
      // SKUs or exact search
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

  // Hold Bill
  const handleHoldBill = () => {
    if (cart.items.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    const newHold = {
      id: Math.random().toString(),
      customerName: custName || "Walk-in Customer",
      items: [...cart.items],
      time: new Date().toLocaleTimeString(),
    };
    setHeldBills([newHold, ...heldBills]);
    cart.clear();
    toast.success("Current bill put on hold");
  };

  // Recall Bill
  const handleRecallBill = (bill: any) => {
    cart.clear();
    bill.items.forEach((item: any) => {
      cart.add(item.product, item.qty);
      if (item.freeQty) cart.setFreeQty(item.product.id, item.freeQty);
      if (item.customPrice) cart.setCustomPrice(item.product.id, item.customPrice);
    });
    setHeldBills(heldBills.filter(b => b.id !== bill.id));
    setRecallOpen(false);
    toast.success(`Recalled bill for ${bill.customerName}`);
  };

  // Save / Print Bill Checkout
  const checkout = async (shouldPrint = false) => {
    if (cart.items.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (cart.paymentMethod === "credit" && (!custName.trim() || !custPhone.trim())) {
      toast.error("Customer details (name & phone) are mandatory for credit sales.");
      return;
    }

    try {
      const newBill = await billsStore.add({
        customerName: custName || undefined,
        customerPhone: custPhone || undefined,
        customerAddress: cart.customer.address || undefined,
        customerDrugLicNo: custGst || undefined,
        customerNotes: custDoctor ? `Doctor: ${custDoctor}` : undefined,
        cashier: session?.name || "Cashier",
        paymentMethod: cart.paymentMethod,
        advanceAmount: 0,
        discount: discountTotal,
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
          batch: customBatches[i.product.id] ?? i.product.batch ?? "BATCH-1",
          pack: i.product.pack,
          expiry: customExpiries[i.product.id] ?? i.product.expiry ?? "2030-01-01",
        })),
        subtotal: subtotalWithOverrides,
        tax: taxWithOverrides,
        total: roundedNetTotal,
      });

      // Decrement stock
      await Promise.all(cart.items.map((i) => productsStore.decrementStock(i.product.id, i.qty)));
      cart.clear();
      localStorage.removeItem("medistock_cart_draft");
      toast.success("Bill generated successfully!");

      if (shouldPrint) {
        navigate({ to: `/bills/${newBill.id}?print=true` });
      } else {
        navigate({ to: `/bills/${newBill.id}` });
      }
    } catch (e) {
      toast.error((e as Error).message || "Failed to save bill");
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
        setCustomerSearchOpen(true);
      } else if (e.key === "F3") {
        e.preventDefault();
        setNewCustomerOpen(true);
      } else if (e.key === "F4") {
        e.preventDefault();
        handleHoldBill();
      } else if (e.key === "F5") {
        e.preventDefault();
        setRecallOpen(true);
      } else if (e.key === "F6") {
        e.preventDefault();
        document.getElementById("payment-mode-cash")?.focus();
      } else if (e.key === "F7") {
        e.preventDefault();
        document.getElementById("discount-percent-input")?.focus();
      } else if (e.key === "F8" || (e.ctrlKey && e.key.toLowerCase() === "s")) {
        e.preventDefault();
        void checkout(false);
      } else if (e.key === "F9") {
        e.preventDefault();
        void checkout(true);
      } else if (e.ctrlKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        document.getElementById("cart-medicine-search")?.focus();
      } else if (e.ctrlKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        cart.clear();
        toast.success("Cart cleared");
      }
    };

    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  });

  return (
    <div className="flex flex-col xl:flex-row gap-4 h-[calc(100vh-6rem)] overflow-hidden text-slate-800">
      
      {/* LEFT COLUMN: Search & Cart Items Grid (70%) */}
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
          {draftSavedAt && (
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md font-mono">
              Draft Saved {draftSavedAt}
            </span>
          )}

          {/* Instant Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border rounded-xl shadow-xl z-50 mt-1 max-h-72 overflow-y-auto divide-y">
              {searchResults.map((p, idx) => (
                <div
                  key={p.id}
                  onClick={() => confirmAdd(p)}
                  className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                    highlightedSearchIdx === idx
                      ? "bg-[#1A9890]/10 border-l-4 border-[#1A9890]"
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

          {/* Preset Add Presets & Status */}
          <div className="bg-slate-50 border-t p-3 flex justify-between items-center text-xs">
            <div className="flex gap-2">
              <span className="font-semibold text-slate-600">Quick Presets:</span>
              <span className="text-slate-500">[F2] Customer Search · [F3] New Customer · [F4] Hold · [F5] Recall · [F8] Save · [F9] Print</span>
            </div>
            <div className="font-mono text-slate-500">
              Lines: {totalItemLines} · Items Qty: {totalQty}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Customer, Summary, Payment Panel (30%) */}
      <div className="w-full xl:w-96 flex flex-col gap-3 min-w-[24rem] h-full overflow-y-auto pb-4">
        
        {/* Customer Details section */}
        <div className="bg-white border rounded-xl shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
              <User className="h-4 w-4 text-[#1A9890]" /> Customer Details
            </h3>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px]"
                onClick={() => setCustomerSearchOpen(true)}
              >
                Search [F2]
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px]"
                onClick={() => setNewCustomerOpen(true)}
              >
                New [F3]
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Name</span>
              <input
                type="text"
                className="w-full px-2.5 py-1.5 border rounded-lg text-xs outline-none bg-slate-50 focus:bg-white"
                value={custName}
                onChange={(e) => {
                  setCustName(e.target.value);
                  cart.setCustomer({ ...cart.customer, name: e.target.value });
                }}
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Mobile Number</span>
              <input
                type="text"
                className="w-full px-2.5 py-1.5 border rounded-lg text-xs outline-none bg-slate-50 focus:bg-white"
                value={custPhone}
                onChange={(e) => {
                  setCustPhone(e.target.value);
                  cart.setCustomer({ ...cart.customer, phone: e.target.value });
                }}
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Doctor</span>
              <input
                type="text"
                className="w-full px-2.5 py-1.5 border rounded-lg text-xs outline-none bg-slate-50 focus:bg-white"
                placeholder="Prescribing Dr."
                value={custDoctor}
                onChange={(e) => setCustDoctor(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">GSTIN (Optional)</span>
              <input
                type="text"
                className="w-full px-2.5 py-1.5 border rounded-lg text-xs outline-none bg-slate-50 focus:bg-white"
                placeholder="Tax ID"
                value={custGst}
                onChange={(e) => setCustGst(e.target.value)}
              />
            </div>
          </div>
          <div className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-1.5 rounded-lg border border-emerald-100 font-medium">
            Loyalty Tier: <span className="font-bold">{custLoyalty}</span>
          </div>
        </div>

        {/* Billing calculations Summary */}
        <div className="bg-white border rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-[#1A9890]" /> Billing Summary
          </h3>
          
          <div className="space-y-2 text-xs font-medium text-slate-600">
            <div className="flex justify-between">
              <span>Gross Total ({totalItemLines} items)</span>
              <span>{formatMoney(grossAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST Total</span>
              <span>{formatMoney(taxWithOverrides)}</span>
            </div>
            <div className="flex justify-between text-rose-600">
              <span>Discounts</span>
              <span>-{formatMoney(discountTotal)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Round Off</span>
              <span>{roundOffValue >= 0 ? "+" : ""}{formatMoney(roundOffValue)}</span>
            </div>
            
            <div className="border-t pt-3 flex justify-between items-end">
              <span className="font-bold text-slate-700 text-sm">Net Payable</span>
              <span className="text-2xl font-black text-[#1A9890] tabular-nums">
                {formatMoney(roundedNetTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment entry section */}
        <div className="bg-white border rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
            <CreditCard className="h-4 w-4 text-[#1A9890]" /> Payment Details
          </h3>

          <div className="grid grid-cols-3 gap-1">
            {["cash", "online", "credit"].map((mode) => (
              <button
                key={mode}
                id={`payment-mode-${mode}`}
                onClick={() => cart.setPaymentMethod(mode as any)}
                className={`py-2 text-xs font-bold rounded-lg border uppercase transition-all ${
                  cart.paymentMethod === mode
                    ? "bg-[#1A9890] text-white border-[#1A9890] shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1.5">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Amount Paid</span>
              <input
                type="number"
                step="0.01"
                className="w-full px-2.5 py-1.5 border rounded-lg text-sm font-bold text-right outline-none bg-slate-50 focus:bg-white"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Change / Balance</span>
              <div className={`w-full px-2.5 py-1.5 border rounded-lg text-sm font-black text-right tabular-nums ${
                changeValue > 0 ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
              }`}>
                {changeValue > 0 ? formatMoney(changeValue) : formatMoney(balanceValue)}
              </div>
            </div>
          </div>
        </div>

        {/* Action Button Panel */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => checkout(false)}
            className="col-span-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <Save className="h-5 w-5" /> Save Bill [F8]
          </button>
          <button
            onClick={() => checkout(true)}
            className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
          >
            <Printer className="h-4 w-4" /> Print [F9]
          </button>
          <button
            onClick={handleHoldBill}
            className="py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
          >
            <History className="h-4 w-4" /> Hold Bill [F4]
          </button>
          <button
            onClick={() => {
              cart.clear();
              toast.success("Bill cleared");
            }}
            className="col-span-2 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all"
          >
            Cancel Bill
          </button>
        </div>

      </div>

      {/* DIALOG: Recall held bills */}
      <Dialog open={recallOpen} onOpenChange={setRecallOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-[#1A9890]" /> Recall Held Bills
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {heldBills.map((b) => (
              <div
                key={b.id}
                onClick={() => handleRecallBill(b)}
                className="p-3 border rounded-xl hover:bg-slate-50 cursor-pointer flex justify-between items-center"
              >
                <div>
                  <div className="font-bold text-slate-800">{b.customerName}</div>
                  <div className="text-[10px] text-slate-400">{b.time}</div>
                </div>
                <span className="text-xs bg-[#1A9890]/10 text-[#1A9890] px-2.5 py-1 rounded-full font-bold">
                  {b.items.length} items
                </span>
              </div>
            ))}
            {heldBills.length === 0 && (
              <div className="text-center py-8 text-slate-400 font-medium text-xs">
                No bills currently on hold.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecallOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Customer Search */}
      <Dialog open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Search Customers</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center text-xs text-slate-400 font-medium">
            Type customer name or phone directly in the Customer Details panel for instant billing setup.
          </div>
          <DialogFooter>
            <Button onClick={() => setCustomerSearchOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: New Customer Details */}
      <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-600">Full Name</span>
              <Input value={custName} onChange={(e) => setCustName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-600">Mobile Phone</span>
              <Input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-600">Doctor</span>
              <Input value={custDoctor} onChange={(e) => setCustDoctor(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="bg-[#1A9890]"
              onClick={() => {
                cart.setCustomer({ name: custName, phone: custPhone, notes: custDoctor });
                setNewCustomerOpen(false);
                toast.success("New customer configured");
              }}
            >
              Configure Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
