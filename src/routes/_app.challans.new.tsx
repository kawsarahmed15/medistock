import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  ClipboardList,
  Plus,
  Trash2,
  Search,
  ArrowLeft,
  Save,
  Printer,
  AlertCircle,
  CheckCircle2,
  Lock,
  User,
  Phone,
  MapPin,
  FileText,
  X,
  Calendar,
} from "lucide-react";
import {
  challansStore,
  productsStore,
  customersStore,
  type Product,
  type Customer,
  type SaleChallanItem,
} from "@/lib/storage";
import { downloadChallanPdf } from "@/lib/challan-pdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ChallanNewSearch = {
  editId?: string;
};

export const Route = createFileRoute("/_app/challans/new")({
  validateSearch: (search: Record<string, unknown>): ChallanNewSearch => {
    return {
      editId: typeof search.editId === "string" ? search.editId : undefined,
    };
  },
  component: CreateOrEditSaleChallanPage,
});

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
}

function numberToWords(num: number): string {
  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ",
    "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen ",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const val = Math.floor(Math.abs(num));
  if (val === 0) return "Zero Rupees Only";

  const n = ("000000000" + val).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "";

  let str = "";
  str += n[1] !== "00" ? (a[Number(n[1])] || b[n[1][0] as any] + " " + a[n[1][1] as any]) + "Crore " : "";
  str += n[2] !== "00" ? (a[Number(n[2])] || b[n[2][0] as any] + " " + a[n[2][1] as any]) + "Lakh " : "";
  str += n[3] !== "00" ? (a[Number(n[3])] || b[n[3][0] as any] + " " + a[n[3][1] as any]) + "Thousand " : "";
  str += n[4] !== "0" ? (a[Number(n[4])] || b[n[4][0] as any] + " " + a[n[4][1] as any]) + "Hundred " : "";
  str += n[5] !== "00" ? (str !== "" ? "and " : "") + (a[Number(n[5])] || b[n[5][0] as any] + " " + a[n[5][1] as any]) + "Rupees " : "Rupees ";
  return str.trim() + " Only";
}

type ChallanRowState = {
  key: string;
  productId?: string;
  batchId?: string;
  productName: string;
  batchNo: string;
  expiryDate: string;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
  qty: number | "";
  freeQty: number | "";
  mrp: number | "";
  rate: number | "";
  discountPercent: number | "";
  taxPercent: number | "";
  pack?: string;
  sku?: string;
  conversionFactor?: number;
};

function CreateOrEditSaleChallanPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const editId = search.editId;

  // Header Details
  const [challanNumber, setChallanNumber] = useState("");
  const [challanDate, setChallanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  // Customer Details
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");

  // Customer Autocomplete state
  const [savedCustomers, setSavedCustomers] = useState<Customer[]>([]);
  const [custDropdownOpen, setCustDropdownOpen] = useState(false);

  // Products Database
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  // Items in Challan
  const [items, setItems] = useState<ChallanRowState[]>([]);
  const [saving, setSaving] = useState(false);

  // Product Search State for new line
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load Initial Data
  useEffect(() => {
    // 1. Fetch next challan number if not editing
    if (!editId) {
      challansStore
        .getNextNumber()
        .then(setChallanNumber)
        .catch(() => setChallanNumber("CH-0001"));
    }

    // 2. Fetch customers
    customersStore
      .list()
      .then(setSavedCustomers)
      .catch(() => setSavedCustomers([]));

    // 3. Fetch products
    setProductsLoading(true);
    productsStore
      .list()
      .then((prods) => {
        setAllProducts(prods);
        setProductsLoading(false);
      })
      .catch(() => {
        setAllProducts([]);
        setProductsLoading(false);
      });

    // 4. If editing existing challan, populate it
    if (editId) {
      challansStore
        .get(editId)
        .then((existing) => {
          setChallanNumber(existing.challanNumber);
          setChallanDate(String(existing.challanDate).slice(0, 10));
          setCustomerName(existing.customerName || "");
          setCustomerPhone(existing.customerPhone || "");
          setCustomerAddress(existing.customerAddress || "");
          setCustomerGstin(existing.customerGstin || "");
          setNotes(existing.notes || "");

          const loadedItems: ChallanRowState[] = existing.items.map((it, idx) => ({
            key: `row_${Date.now()}_${idx}`,
            productId: it.productId,
            batchId: it.batchId,
            productName: it.productName,
            batchNo: it.batchNo || "DEFAULT",
            expiryDate: it.expiryDate ? String(it.expiryDate).slice(0, 10) : "",
            physicalStock: Number(it.availableStock || 0),
            reservedStock: Number(it.reservation?.reservedQty || 0),
            availableStock: Number(it.availableStock || 0),
            qty: it.qty,
            freeQty: it.freeQty || 0,
            mrp: it.mrp != null ? it.mrp : "",
            rate: it.rate,
            discountPercent: it.discountPercent || 0,
            taxPercent: it.taxPercent || 0,
            pack: it.pack,
            sku: it.sku,
            conversionFactor: it.conversionFactor || 1,
          }));
          setItems(loadedItems);
        })
        .catch((err) => {
          toast.error("Failed to load existing challan for editing");
          navigate({ to: "/challans" });
        });
    }
  }, [editId]);

  // Filtered Customers Autocomplete
  const filteredCustomers = useMemo(() => {
    if (!customerName && !customerPhone) return [];
    const qName = customerName.toLowerCase().trim();
    const qPhone = customerPhone.replace(/\D/g, "");
    return savedCustomers
      .filter((c) => {
        const cName = (c.name || "").toLowerCase();
        const cPhone = (c.phone || "").replace(/\D/g, "");
        if (qName && cName.includes(qName)) return true;
        if (qPhone && cPhone.includes(qPhone)) return true;
        return false;
      })
      .slice(0, 6);
  }, [customerName, customerPhone, savedCustomers]);

  const selectCustomer = (c: Customer) => {
    setCustomerName(c.name || "");
    setCustomerPhone(c.phone || "");
    if (c.address) setCustomerAddress(c.address);
    if (c.gstin) setCustomerGstin(c.gstin);
    setCustDropdownOpen(false);
  };

  // Filtered Products Search (search by name, barcode, or SKU)
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allProducts
      .filter((p) => {
        const nameMatch = p.name.toLowerCase().includes(q);
        const skuMatch = p.sku && p.sku.toLowerCase().includes(q);
        const batchMatch = p.batches && p.batches.some((b) => (b.batch || "").toLowerCase().includes(q));
        return nameMatch || skuMatch || batchMatch;
      })
      .slice(0, 10);
  }, [searchQuery, allProducts]);

  // Add Product with chosen Batch to Challan table
  const addProductToChallan = (product: Product, batch?: any) => {
    const chosenBatch = batch || (product.batches && product.batches.length > 0 ? product.batches[0] : null);

    const physicalStock = chosenBatch ? Number((chosenBatch as any).physical_qty ?? chosenBatch.stock ?? product.stock ?? 0) : Number(product.stock || 0);
    const reservedStock = chosenBatch ? Number((chosenBatch as any).reserved_qty ?? 0) : Number((product as any).reserved_qty ?? 0);
    const availableStock = chosenBatch ? Number((chosenBatch as any).available_qty ?? chosenBatch.stock ?? product.stock ?? 0) : Number(product.stock || 0);

    const rate = chosenBatch ? Number(chosenBatch.price || product.price || 0) : Number(product.price || 0);
    const mrp = chosenBatch ? Number(chosenBatch.mrp || product.mrp || 0) : Number(product.mrp || 0);
    const batchNo = chosenBatch?.batch || chosenBatch?.batch_no || product.batch || "DEFAULT";
    const expiry = chosenBatch?.expiry || chosenBatch?.expiry_date || product.expiry || "2030-12-31";

    const newItem: ChallanRowState = {
      key: `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productId: product.id,
      batchId: chosenBatch?.id,
      productName: product.name,
      batchNo,
      expiryDate: String(expiry).slice(0, 10),
      physicalStock,
      reservedStock,
      availableStock,
      qty: 1,
      freeQty: 0,
      mrp: mrp > 0 ? mrp : "",
      rate,
      discountPercent: 0,
      taxPercent: Number(product.taxPercent || 12),
      pack: product.pack,
      sku: product.sku,
      conversionFactor: product.conversionFactor || 1,
    };

    setItems((prev) => [...prev, newItem]);
    setSearchQuery("");
    setSearchDropdownOpen(false);
    toast.success(`Added ${product.name} (Batch: ${batchNo})`);
  };

  // Update item field
  const updateItem = (index: number, field: keyof ChallanRowState, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Remove item row
  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Totals Calculation
  const { subtotal, totalDiscount, totalTax, grandTotal } = useMemo(() => {
    let sub = 0;
    let disc = 0;
    let tax = 0;
    let grand = 0;

    for (const it of items) {
      const q = Math.max(0, Number(it.qty) || 0);
      const r = Math.max(0, Number(it.rate) || 0);
      const dp = Math.max(0, Math.min(100, Number(it.discountPercent) || 0));
      const tp = Math.max(0, Number(it.taxPercent) || 0);

      const gross = q * r;
      const dAmt = gross * (dp / 100);
      const taxable = gross - dAmt;
      const tAmt = taxable * (tp / 100);

      sub += taxable;
      disc += dAmt;
      tax += tAmt;
      grand += taxable + tAmt;
    }

    return {
      subtotal: Math.round(sub * 100) / 100,
      totalDiscount: Math.round(disc * 100) / 100,
      totalTax: Math.round(tax * 100) / 100,
      grandTotal: Math.round(grand * 100) / 100,
    };
  }, [items]);

  // Validation: Check for over-reservation
  const overReservedItems = useMemo(() => {
    return items.filter((it) => {
      const totalQty = (Number(it.qty) || 0) + (Number(it.freeQty) || 0);
      return totalQty > (it.availableStock || 0);
    });
  }, [items]);

  // Save Challan Handler
  const handleSaveChallan = async (status: "draft" | "issued") => {
    if (items.length === 0) {
      toast.error("Please add at least one product item to the Sale Challan.");
      return;
    }

    // Validate quantities
    for (const it of items) {
      const totalQ = (Number(it.qty) || 0) + (Number(it.freeQty) || 0);
      if (totalQ <= 0) {
        toast.error(`Quantity for "${it.productName}" must be greater than zero.`);
        return;
      }
    }

    // Enforce over-reservation protection on 'issued' status
    if (status === "issued" && overReservedItems.length > 0) {
      const first = overReservedItems[0];
      const req = (Number(first.qty) || 0) + (Number(first.freeQty) || 0);
      toast.error(
        `Over-reservation prevented! "${first.productName}" requested ${req}, but only ${first.availableStock} available in stock.`
      );
      return;
    }

    try {
      setSaving(true);

      const payload = {
        challanNumber: challanNumber.trim(),
        challanDate,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        customerGstin: customerGstin.trim() || undefined,
        notes: notes.trim() || undefined,
        status,
        items: items.map((it) => ({
          productId: it.productId,
          batchId: it.batchId,
          productName: it.productName,
          batchNo: it.batchNo,
          expiryDate: it.expiryDate,
          qty: Number(it.qty) || 0,
          freeQty: Number(it.freeQty) || 0,
          mrp: it.mrp !== "" ? Number(it.mrp) : undefined,
          rate: Number(it.rate) || 0,
          discountPercent: Number(it.discountPercent) || 0,
          taxPercent: Number(it.taxPercent) || 0,
          pack: it.pack,
          sku: it.sku,
          conversionFactor: it.conversionFactor,
        })),
      };

      if (editId) {
        await challansStore.update(editId, payload as any);
        toast.success(`Sale Challan ${challanNumber} updated successfully!`);
      } else {
        const res = await challansStore.create(payload as any);
        toast.success(
          `Sale Challan ${res.challan.challanNumber} created! ${
            status === "issued" ? "Stock quantity has been reserved." : "Saved as draft."
          }`
        );
      }

      navigate({ to: "/challans" });
    } catch (err: any) {
      toast.error(err?.message || "Failed to save Sale Challan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in pb-16">
      {/* ── Top Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border shadow-soft">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/challans" })}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              {editId ? "Edit Sale Challan" : "New Sale Challan"}
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                Temporary Delivery
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Temporary dispatch slip. Selected quantity will be locked/reserved from inventory without deducting physical stock.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSaveChallan("draft")}
            disabled={saving}
            className="h-9 text-xs font-semibold"
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            Save as Draft
          </Button>

          <Button
            size="sm"
            onClick={() => handleSaveChallan("issued")}
            disabled={saving || (overReservedItems.length > 0 && items.length > 0)}
            className="h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-soft"
          >
            <Lock className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Issue Challan & Reserve Stock"}
          </Button>
        </div>
      </div>

      {/* ── Over-reservation Warning Alert ── */}
      {overReservedItems.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start gap-3 text-rose-800 dark:text-rose-300 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div>
            <strong className="font-bold">Over-reservation Detected!</strong>
            <p className="mt-0.5">
              The following item(s) exceed available stock:{" "}
              {overReservedItems.map((it) => `"${it.productName}" (Available: ${it.availableStock})`).join(", ")}.
              Please decrease the quantity before issuing the challan.
            </p>
          </div>
        </div>
      )}

      {/* ── Challan & Customer Information Card ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Challan Meta */}
        <Card className="p-4 border shadow-soft space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-primary" />
            Challan Details
          </div>

          <div className="space-y-2">
            <div>
              <Label className="text-xs font-semibold">Challan Number</Label>
              <Input
                value={challanNumber}
                onChange={(e) => setChallanNumber(e.target.value)}
                placeholder="CH-0001"
                className="h-9 text-xs font-mono font-bold uppercase mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Challan Date</Label>
              <Input
                type="date"
                value={challanDate}
                onChange={(e) => setChallanDate(e.target.value)}
                className="h-9 text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Notes / Remarks</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Dispatched via courier / vehicle #..."
                className="h-9 text-xs mt-1"
              />
            </div>
          </div>
        </Card>

        {/* Customer Information (with Autocomplete) */}
        <Card className="p-4 border shadow-soft space-y-3 lg:col-span-2 relative">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-primary" />
              Customer Information
            </span>
            <span className="text-[10px] text-muted-foreground font-normal">
              Search existing customer or enter new
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Customer Name with Autocomplete */}
            <div className="relative">
              <Label className="text-xs font-semibold">Customer Name</Label>
              <Input
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setCustDropdownOpen(true);
                }}
                onFocus={() => setCustDropdownOpen(true)}
                placeholder="Enter customer / patient name..."
                className="h-9 text-xs mt-1"
              />

              {/* Customer Autocomplete Dropdown */}
              {custDropdownOpen && filteredCustomers.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden text-xs">
                  <div className="p-1.5 bg-muted/60 text-[10px] font-semibold text-muted-foreground">
                    Matching Registered Customers
                  </div>
                  {filteredCustomers.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left p-2 hover:bg-muted/80 flex justify-between items-center border-b last:border-0"
                    >
                      <div>
                        <div className="font-semibold text-foreground">{c.name}</div>
                        {c.address && (
                          <div className="text-[10px] text-muted-foreground line-clamp-1">{c.address}</div>
                        )}
                      </div>
                      <div className="text-right font-mono text-[11px] text-muted-foreground">
                        {c.phone || "No mobile"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile Number */}
            <div>
              <Label className="text-xs font-semibold">Mobile Number</Label>
              <Input
                value={customerPhone}
                onChange={(e) => {
                  setCustomerPhone(e.target.value);
                  setCustDropdownOpen(true);
                }}
                placeholder="+91 98765 43210"
                className="h-9 text-xs mt-1"
              />
            </div>

            {/* Customer Address */}
            <div>
              <Label className="text-xs font-semibold">Customer Address</Label>
              <Input
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Clinic / Pharmacy / Patient address..."
                className="h-9 text-xs mt-1"
              />
            </div>

            {/* Customer GSTIN */}
            <div>
              <Label className="text-xs font-semibold">Customer GSTIN</Label>
              <Input
                value={customerGstin}
                onChange={(e) => setCustomerGstin(e.target.value)}
                placeholder="GSTIN (Optional for B2B)"
                className="h-9 text-xs font-mono uppercase mt-1"
              />
            </div>
          </div>
        </Card>
      </div>

      {/* ── Product Search & Addition Bar ── */}
      <Card className="p-4 border shadow-soft bg-card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Search className="w-4 h-4 text-primary" />
            Add Products & Batches to Challan
          </div>
          <div className="text-xs text-muted-foreground">
            Search by Medicine Name, Barcode, or HSN/SKU
          </div>
        </div>

        {/* Search input with live dropdown */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchDropdownOpen(true);
            }}
            onFocus={() => setSearchDropdownOpen(true)}
            placeholder="Type medicine name (e.g. Paracetamol), scan barcode, or enter SKU..."
            className="pl-9 h-10 text-xs sm:text-sm bg-background"
          />

          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Search Dropdown with Batches and Live Stock Reservation Stats */}
          {searchDropdownOpen && filteredProducts.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-popover border rounded-xl shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto">
              <div className="p-2 bg-muted/60 text-[11px] font-bold text-muted-foreground flex justify-between">
                <span>Select Medicine & Batch</span>
                <span>Stock: Actual (Reserved) = Available</span>
              </div>

              {filteredProducts.map((p) => {
                const batches = p.batches && p.batches.length > 0 ? p.batches : [p as any];
                return (
                  <div key={p.id} className="border-b last:border-0 p-2 hover:bg-muted/30">
                    <div className="flex justify-between items-center mb-1">
                      <div className="font-bold text-xs text-foreground flex items-center gap-2">
                        {p.name}
                        {p.pack && <span className="text-[10px] text-muted-foreground font-normal">({p.pack})</span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {p.sku ? `SKU: ${p.sku}` : ""}
                      </div>
                    </div>

                    {/* Batch rows for this product */}
                    <div className="space-y-1 pl-2">
                      {batches.map((b: any, bIdx: number) => {
                        const batchNo = b.batch || b.batch_no || "DEFAULT";
                        const expDate = b.expiry || b.expiry_date || "—";
                        const physical = Number(b.physical_qty ?? b.stock ?? p.stock ?? 0);
                        const reserved = Number(b.reserved_qty ?? 0);
                        const available = Number(b.available_qty ?? b.stock ?? p.stock ?? 0);
                        const rate = Number(b.price || p.price || 0);

                        return (
                          <div
                            key={bIdx}
                            onClick={() => addProductToChallan(p, b)}
                            className="flex items-center justify-between p-1.5 rounded-lg bg-card hover:bg-primary/10 hover:border-primary/40 border cursor-pointer text-xs transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-semibold uppercase text-[11px]">
                                Batch: {batchNo}
                              </span>
                              <span className="text-muted-foreground text-[10px]">
                                Exp: {String(expDate).slice(0, 7)}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-foreground">
                                Rate: ₹{rate.toFixed(2)}
                              </span>

                              {/* Stock Display: Actual, Reserved, Available */}
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <span className="text-muted-foreground" title="Actual Physical Stock">
                                  {physical} Act
                                </span>
                                {reserved > 0 && (
                                  <span className="text-amber-600 dark:text-amber-400 font-semibold" title="Reserved in Challans">
                                    (-{reserved} Res)
                                  </span>
                                )}
                                <span
                                  className={cn(
                                    "px-1.5 py-0.5 rounded font-bold",
                                    available > 0
                                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                      : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                                  )}
                                  title="Available Stock for New Challan"
                                >
                                  {available} Avail
                                </span>
                              </div>

                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs font-bold text-primary">
                                + Add
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* ── Challan Products Table ── */}
      <Card className="border shadow-soft overflow-hidden">
        <div className="p-3 bg-muted/40 border-b flex justify-between items-center">
          <div className="text-xs font-bold text-foreground">
            Challan Items ({items.length})
          </div>
          <div className="text-[11px] text-muted-foreground">
            Stock formula: <strong className="text-foreground">Available = Actual - Reserved</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow className="text-xs">
                <TableHead className="w-10 text-center">#</TableHead>
                <TableHead className="min-w-[200px]">Product Name</TableHead>
                <TableHead className="w-28">Batch No</TableHead>
                <TableHead className="w-24">Expiry</TableHead>
                <TableHead className="w-28 text-center bg-primary/5">Stock Status</TableHead>
                <TableHead className="w-20 text-center">Qty</TableHead>
                <TableHead className="w-16 text-center">Free</TableHead>
                <TableHead className="w-20 text-right">MRP (₹)</TableHead>
                <TableHead className="w-24 text-right">Rate (₹)</TableHead>
                <TableHead className="w-16 text-right">Disc %</TableHead>
                <TableHead className="w-16 text-right">GST %</TableHead>
                <TableHead className="w-24 text-right">Amount (₹)</TableHead>
                <TableHead className="w-12 text-center"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="h-32 text-center text-xs text-muted-foreground">
                    No items added yet. Use the search box above to add medicines & batches.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((it, idx) => {
                  const reqTotal = (Number(it.qty) || 0) + (Number(it.freeQty) || 0);
                  const isOver = reqTotal > it.availableStock;

                  const q = Math.max(0, Number(it.qty) || 0);
                  const r = Math.max(0, Number(it.rate) || 0);
                  const dp = Math.max(0, Math.min(100, Number(it.discountPercent) || 0));
                  const tp = Math.max(0, Number(it.taxPercent) || 0);

                  const gross = q * r;
                  const dAmt = gross * (dp / 100);
                  const taxable = gross - dAmt;
                  const itemAmount = taxable + taxable * (tp / 100);

                  return (
                    <TableRow key={it.key} className={cn("text-xs", isOver ? "bg-rose-500/10" : "")}>
                      {/* S.No */}
                      <TableCell className="text-center font-medium">{idx + 1}</TableCell>

                      {/* Name */}
                      <TableCell>
                        <div className="font-semibold text-foreground">{it.productName}</div>
                        {it.pack && <div className="text-[10px] text-muted-foreground">{it.pack}</div>}
                      </TableCell>

                      {/* Batch */}
                      <TableCell>
                        <Input
                          value={it.batchNo}
                          onChange={(e) => updateItem(idx, "batchNo", e.target.value.toUpperCase())}
                          className="h-8 text-xs font-mono uppercase"
                        />
                      </TableCell>

                      {/* Expiry */}
                      <TableCell>
                        <Input
                          type="date"
                          value={it.expiryDate}
                          onChange={(e) => updateItem(idx, "expiryDate", e.target.value)}
                          className="h-8 text-xs"
                        />
                      </TableCell>

                      {/* Stock Status Badge (Actual, Reserved, Available) */}
                      <TableCell className="text-center bg-primary/5">
                        <div className="flex flex-col items-center gap-0.5 text-[10px]">
                          <div className="flex items-center gap-1 font-mono">
                            <span title="Physical stock on hand">{it.physicalStock} Act</span>
                            <span className="text-amber-600 dark:text-amber-400" title="Reserved in other challans">
                              (-{it.reservedStock} Res)
                            </span>
                          </div>
                          <span
                            className={cn(
                              "font-bold px-1.5 py-0.5 rounded text-[10px]",
                              isOver
                                ? "bg-rose-500 text-white animate-pulse"
                                : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                            )}
                          >
                            {it.availableStock} Available
                          </span>
                        </div>
                      </TableCell>

                      {/* Qty */}
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={it.qty}
                          onChange={(e) => updateItem(idx, "qty", e.target.value === "" ? "" : Number(e.target.value))}
                          className={cn(
                            "h-8 text-xs font-bold text-center",
                            isOver ? "border-rose-500 text-rose-600 ring-1 ring-rose-500" : ""
                          )}
                        />
                      </TableCell>

                      {/* Free Qty */}
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={it.freeQty}
                          onChange={(e) => updateItem(idx, "freeQty", e.target.value === "" ? "" : Number(e.target.value))}
                          className="h-8 text-xs text-center"
                        />
                      </TableCell>

                      {/* MRP */}
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={it.mrp}
                          onChange={(e) => updateItem(idx, "mrp", e.target.value === "" ? "" : Number(e.target.value))}
                          className="h-8 text-xs text-right"
                        />
                      </TableCell>

                      {/* Rate */}
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={it.rate}
                          onChange={(e) => updateItem(idx, "rate", e.target.value === "" ? "" : Number(e.target.value))}
                          className="h-8 text-xs text-right font-medium"
                        />
                      </TableCell>

                      {/* Disc % */}
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={it.discountPercent}
                          onChange={(e) =>
                            updateItem(idx, "discountPercent", e.target.value === "" ? "" : Number(e.target.value))
                          }
                          className="h-8 text-xs text-right"
                        />
                      </TableCell>

                      {/* GST % */}
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="28"
                          value={it.taxPercent}
                          onChange={(e) =>
                            updateItem(idx, "taxPercent", e.target.value === "" ? "" : Number(e.target.value))
                          }
                          className="h-8 text-xs text-right"
                        />
                      </TableCell>

                      {/* Row Total */}
                      <TableCell className="text-right font-bold text-xs tabular-nums text-foreground">
                        ₹{itemAmount.toFixed(2)}
                      </TableCell>

                      {/* Delete */}
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(idx)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ── Summary & Footer Totals ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Notes & Stock Reservation Rules */}
        <Card className="p-4 border shadow-soft bg-card space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Stock Reservation Policy
          </div>
          <div className="text-xs text-muted-foreground space-y-1.5 bg-muted/30 p-3 rounded-lg border">
            <p>
              • <strong>Temporary Challan:</strong> Selected quantities are reserved immediately so other sales cannot take this stock.
            </p>
            <p>
              • <strong>Inventory Deduction:</strong> Physical stock is <em>not</em> deducted yet. Deduction occurs only when this challan is converted into a final Sales Bill.
            </p>
            <p>
              • <strong>Cancellation:</strong> Cancelling this challan will immediately release all reserved stock.
            </p>
          </div>

          <div className="text-xs">
            <span className="font-semibold text-muted-foreground">Amount in Words: </span>
            <span className="font-bold text-foreground">{numberToWords(grandTotal)}</span>
          </div>
        </Card>

        {/* Right: Calculations Box */}
        <Card className="p-4 border shadow-soft bg-card space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Challan Summary
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxable Subtotal:</span>
              <span className="font-mono font-medium">₹{subtotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Discount:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                - ₹{totalDiscount.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Total GST:</span>
              <span className="font-mono font-medium">+ ₹{totalTax.toFixed(2)}</span>
            </div>

            <div className="border-t pt-2 flex justify-between items-center">
              <span className="font-bold text-sm text-foreground">Grand Total:</span>
              <span className="font-mono font-bold text-lg text-primary">
                {formatMoney(grandTotal)}
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSaveChallan("draft")}
              disabled={saving}
              className="text-xs font-semibold"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              Save as Draft
            </Button>

            <Button
              size="sm"
              onClick={() => handleSaveChallan("issued")}
              disabled={saving || (overReservedItems.length > 0 && items.length > 0)}
              className="text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-soft"
            >
              <Lock className="w-3.5 h-3.5" />
              {saving ? "Saving..." : "Issue Challan & Reserve Stock"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
