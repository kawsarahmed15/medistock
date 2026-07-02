import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, ScanLine, Search, ShoppingCart, Trash2, Eye } from "lucide-react";

import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { productsStore, type Product } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { SkuScanner } from "@/components/sku-scanner";
import { toast } from "sonner";

import { TableSkeleton } from "@/components/loading-skeleton";
import { calculateSmallestUnits, formatStock } from "@/lib/inventory-utils";

type InventorySearch = {
  add?: number;
  filter?: "low" | "expiring" | "expired";
  q?: string;
};

export const Route = createFileRoute("/_app/inventory")({
  validateSearch: (search: Record<string, unknown>): InventorySearch => {
    const f = search.filter as string | undefined;
    const valid = ["low", "expiring", "expired"];
    return {
      add: search.add ? Number(search.add) : undefined,
      filter: valid.includes(f as string) ? (f as InventorySearch["filter"]) : undefined,
      q: typeof search.q === "string" ? search.q : undefined,
    };
  },
  component: InventoryPage,
});

type FormState = {
  name: string;
  category: string;
  manufacturer: string;
  batch: string;
  sku: string;
  expiry: string;
  taxPercent: string;
  prescription: boolean;

  medicineType: string;
  tabletsPerStrip: string;
  stripsPerBox: string;

  purchaseQuantity: string;
  purchaseUnit: string;
  purchasePrice: string;

  mrpPerTablet: string;
  mrpPerStrip: string;
  mrpPerBox: string;

  pricePerTablet: string;
  pricePerStrip: string;
  pricePerBox: string;
};

const empty: FormState = {
  name: "",
  category: "",
  manufacturer: "",
  batch: "",
  sku: "",
  expiry: "",
  taxPercent: "12",
  prescription: false,
  medicineType: "Tablet",
  tabletsPerStrip: "10",
  stripsPerBox: "10",
  purchaseQuantity: "1",
  purchaseUnit: "Box",
  purchasePrice: "",
  mrpPerTablet: "",
  mrpPerStrip: "",
  mrpPerBox: "",
  pricePerTablet: "",
  pricePerStrip: "",
  pricePerBox: "",
};


function InventoryPage() {
  const { q: qParam } = Route.useSearch();
  const [items, setItems] = useState<Product[]>([]);
  const [query, setQuery] = useState(qParam ?? "");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof qParam === "string") setQuery(qParam);
  }, [qParam]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "name_asc" | "name_desc">(
    "date_desc",
  );
  const { session } = useAuth();
  const expiryDays = session?.expiryDays ?? 60;
  const defaultTax = session?.defaultTax ?? 12;

  useEffect(() => {
    // Initialize form with default tax once session is loaded if it's the empty form
    if (form === empty) {
      setForm({ ...empty, taxPercent: String(defaultTax) });
    }
  }, [defaultTax]);

  const [recentCategories, setRecentCategories] = useState<string[]>([]);
  const [recentManufacturers, setRecentManufacturers] = useState<string[]>([]);
  const [recentHsns, setRecentHsns] = useState<string[]>([]);

  useEffect(() => {
    try {
      setRecentCategories(JSON.parse(localStorage.getItem("recentCategories") || "[]"));
      setRecentManufacturers(JSON.parse(localStorage.getItem("recentManufacturers") || "[]"));
      setRecentHsns(JSON.parse(localStorage.getItem("recentHsns") || "[]"));
    } catch (e) {}
  }, []);

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

  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const cart = useCart();

  const quickAdd = (p: Product) => {
    if (p.stock <= 0) {
      toast.error(`${p.name} is out of stock`);
      return;
    }
    cart.add(p, 1);
    toast.success(`${p.name} added to cart`);
  };

  const handleScan = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    // Match an existing product by SKU
    const match = items.find((p) => (p.sku ?? "").trim().toLowerCase() === trimmed.toLowerCase());
    if (match) {
      // Edit flow with all existing info pre-filled
      setEditing(match);
      setForm({
        name: match.name,
        category: match.category,
        costPrice: match.costPrice != null ? String(match.costPrice) : "",
        price: String(match.price),
        mrp: match.mrp != null ? String(match.mrp) : "",
        stock: String(match.stock),
        ...parsePack(match.pack),
        expiry: match.expiry.slice(0, 10),
        batch: match.batch ?? "",
        manufacturer: match.manufacturer ?? "",
        sku: match.sku ?? trimmed,
        taxPercent: String(match.taxPercent ?? 0),
        prescription: !!match.prescription,
        baseUnit: match.baseUnit ?? "Unit",
        packUnit: match.packUnit ?? "Pack",
        conversionFactor: String(match.conversionFactor ?? 1),
        packPrice: match.packPrice != null ? String(match.packPrice) : "",
        packCostPrice: match.packCostPrice != null ? String(match.packCostPrice) : "",
      });
      toast.success(`Found ${match.name} · adjust stock and save`);
    } else {
      // New product flow with SKU pre-filled
      setEditing(null);
      setForm({ ...empty, sku: trimmed, taxPercent: String(defaultTax) });
      toast.info("New SKU — fill the rest to add the product");
    }
    setOpen(true);
  };

  const refresh = () => {
    setLoading(true);
    productsStore
      .list()
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => {
        setItems([]);
        setLoading(false);
      });
  };
  useEffect(refresh, []);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      const q = query.toLowerCase();
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.category.toLowerCase().includes(q) &&
        !(p.sku ?? "").toLowerCase().includes(q)
      )
        return false;

      if (search.filter === "low") return p.stock <= 10;
      if (search.filter === "expiring") {
        const d = new Date(p.expiry).getTime();
        const days = (d - Date.now()) / (1000 * 60 * 60 * 24);
        return days <= expiryDays && days >= 0;
      }
      if (search.filter === "expired") {
        return new Date(p.expiry).getTime() < Date.now();
      }
      return true;
    });
  }, [items, query, search.filter, expiryDays]);
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === "name_asc") return a.name.localeCompare(b.name);
      if (sortBy === "name_desc") return b.name.localeCompare(a.name);
      if (sortBy === "date_asc")
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filtered, sortBy]);

  useEffect(() => {
    const handler = () => {
      setEditing(null);
      setForm({ ...empty, taxPercent: String(defaultTax) });
      setOpen(true);
    };
    window.addEventListener("trigger-add-product", handler);
    return () => window.removeEventListener("trigger-add-product", handler);
  }, []);

  if (loading && items.length === 0) return <TableSkeleton cols={6} />;

  const startAdd = () => {
    setEditing(null);
    setForm({ ...empty, taxPercent: String(defaultTax) });
    setOpen(true);
  };

  const startEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category,
      manufacturer: p.manufacturer ?? "",
      batch: p.batch ?? "",
      sku: p.sku ?? "",
      expiry: p.expiry ? (p.expiry.split("-").length >= 2 ? `${p.expiry.split("-")[1]}/${p.expiry.split("-")[0].substring(2)}` : p.expiry) : "",
      taxPercent: String(p.taxPercent ?? 0),
      prescription: !!p.prescription,

      medicineType: p.medicineType || "Tablet",
      tabletsPerStrip: String(p.tabletsPerStrip || 10),
      stripsPerBox: String(p.stripsPerBox || 10),

      purchaseQuantity: "1",
      purchaseUnit: p.medicineType === "Tablet" || p.medicineType === "Capsule" ? "Box" : "Unit",
      purchasePrice: p.costPrice ? String(p.costPrice * calculateSmallestUnits(1, p.medicineType === "Tablet" || p.medicineType === "Capsule" ? "Box" : "Unit", p.medicineType || "Tablet", Number(p.tabletsPerStrip || 10), Number(p.stripsPerBox || 10))) : "",

      mrpPerTablet: p.mrpPerTablet ? String(p.mrpPerTablet) : p.mrp ? String(p.mrp) : "",
      mrpPerStrip: p.mrpPerStrip ? String(p.mrpPerStrip) : "",
      mrpPerBox: p.mrpPerBox ? String(p.mrpPerBox) : "",

      pricePerTablet: p.price ? String(p.price) : "",
      pricePerStrip: "",
      pricePerBox: "",
    });
    setOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    
    const tps = Number(form.tabletsPerStrip) || 10;
    const spb = Number(form.stripsPerBox) || 10;
    
    // Calculate base quantities
    const addedStock = calculateSmallestUnits(Number(form.purchaseQuantity) || 0, form.purchaseUnit, form.medicineType, tps, spb);
    let finalStock = editing ? editing.stock + addedStock : addedStock;

    // Price calculation
    let costPerUnit = 0;
    if (addedStock > 0 && Number(form.purchasePrice)) {
      costPerUnit = Number(form.purchasePrice) / addedStock;
    }

    let pricePerUnit = Number(form.pricePerTablet) || 0;
    let mrpPerUnit = Number(form.mrpPerTablet) || 0;

    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || "General",
      manufacturer: form.manufacturer.trim() || undefined,
      batch: form.batch.trim() || undefined,
      sku: form.sku.trim() || undefined,
      taxPercent: Number(form.taxPercent) || 0,
      prescription: form.prescription,
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

      medicineType: form.medicineType,
      tabletsPerStrip: form.medicineType === "Tablet" || form.medicineType === "Capsule" ? tps : undefined,
      stripsPerBox: form.medicineType === "Tablet" || form.medicineType === "Capsule" ? spb : undefined,

      mrpPerTablet: Number(form.mrpPerTablet) || undefined,
      mrpPerStrip: Number(form.mrpPerStrip) || undefined,
      mrpPerBox: Number(form.mrpPerBox) || undefined,

      stock: finalStock,
      costPrice: costPerUnit || (editing ? editing.costPrice : 0),
      price: pricePerUnit,
      mrp: mrpPerUnit || undefined,
    };

    if (!payload.name || !payload.expiry || isNaN(payload.price)) {
      toast.error("Please fill required fields (Name, Price, Expiry).");
      return;
    }

    try {
      if (editing) {
        await productsStore.update(editing.id, payload);
        toast.success("Product updated");
      } else {
        await productsStore.add(payload);
        toast.success("Product added");
      }
      saveRecent("recentCategories", payload.category, recentCategories, setRecentCategories, 4);
      if (payload.manufacturer) saveRecent("recentManufacturers", payload.manufacturer, recentManufacturers, setRecentManufacturers, 8);
      if (payload.sku) saveRecent("recentHsns", payload.sku, recentHsns, setRecentHsns, 4);

      refresh();
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message || "Failed to save product");
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(`Delete ${p.name}?`)) return;
    try {
      await productsStore.remove(p.id);
      refresh();
      toast.success("Product removed");
    } catch (err) {
      toast.error((err as Error).message || "Failed to delete");
    }
  };

  const filterLabel: Record<NonNullable<InventorySearch["filter"]>, string> = {
    low: "Low stock (≤ 10)",
    expiring: `Expiring within ${expiryDays} days`,
    expired: "Expired products",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your products, stock and expiry.
          </p>
          {search.filter && (
            <div className="mt-3 inline-flex items-center gap-2 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full">
              Filtered: {filterLabel[search.filter as NonNullable<InventorySearch["filter"]>]}
              <button
                onClick={() => navigate({ search: {}, replace: true })}
                className="hover:underline font-medium"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="name_asc">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
          </select>
          <Button variant="outline" onClick={() => setScannerOpen(true)} title="Scan HSN / barcode">
            <ScanLine className="h-4 w-4" />
            <span className="hidden sm:inline">Scan HSN</span>
          </Button>
          <Button onClick={startAdd} className="shadow-soft">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add product</span>
            <span className="sm:hidden">Add</span>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={submit} className="flex flex-col gap-6">
  {/* Basic Information */}
  <div className="space-y-4">
    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Basic Information</h3>
    <div className="grid grid-cols-2 gap-4">
      <Field label="Name" className="col-span-2">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="Category">
        <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Antibiotic" />
      </Field>
      <Field label="Manufacturer">
        <Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
      </Field>
      <Field label="Batch">
        <Input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} />
      </Field>
      <Field label="Expiry (MM/YY)">
        <Input value={form.expiry} onChange={(e) => {
          let val = e.target.value.replace(/[^\d/]/g, "");
          if (val.length === 2 && form.expiry.length !== 3 && !val.includes("/")) val += "/";
          setForm({ ...form, expiry: val });
        }} required />
      </Field>
      <Field label="HSN Code">
        <div className="flex gap-2">
          <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          <Button type="button" variant="outline" size="icon" onClick={(e) => { e.preventDefault(); setScannerOpen(true); }}><ScanLine className="h-4 w-4" /></Button>
        </div>
      </Field>
      <Field label="Tax %">
        <Input type="number" value={form.taxPercent} onChange={(e) => setForm({ ...form, taxPercent: e.target.value })} />
      </Field>
      <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
        <div>
          <div className="text-sm font-medium">Prescription required</div>
          <div className="text-xs text-muted-foreground">Mark this product as Rx-only.</div>
        </div>
        <Switch checked={form.prescription} onCheckedChange={(v) => setForm({ ...form, prescription: v })} />
      </div>
    </div>
  </div>

  {/* Packaging */}
  <div className="space-y-4 pt-2 border-t border-border/50">
    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Packaging</h3>
    <div className="grid grid-cols-2 gap-4">
      <Field label="Medicine Type">
        <select className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={form.medicineType} onChange={(e) => setForm({ ...form, medicineType: e.target.value })}>
          {["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Ointment", "Drops", "Other"].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      {(form.medicineType === "Tablet" || form.medicineType === "Capsule") && (
        <>
          <Field label="Tablets/Capsules Per Strip">
            <Input type="number" value={form.tabletsPerStrip} onChange={(e) => setForm({ ...form, tabletsPerStrip: e.target.value })} required />
          </Field>
          <Field label="Strips Per Box">
            <Input type="number" value={form.stripsPerBox} onChange={(e) => setForm({ ...form, stripsPerBox: e.target.value })} required />
          </Field>
        </>
      )}
    </div>
  </div>

  {/* Purchase */}
  <div className="space-y-4 pt-2 border-t border-border/50">
    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Purchase (Adding Stock)</h3>
    <div className="grid grid-cols-2 gap-4">
      <Field label="Purchase Quantity">
        <Input type="number" value={form.purchaseQuantity} onChange={(e) => setForm({ ...form, purchaseQuantity: e.target.value })} />
      </Field>
      <Field label="Purchase Unit">
        <select className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={form.purchaseUnit} onChange={(e) => setForm({ ...form, purchaseUnit: e.target.value })}>
          {form.medicineType === "Tablet" || form.medicineType === "Capsule" ? (
            <>
              <option value="Box">Box</option>
              <option value="Strip">Strip</option>
              <option value="Tablet">Tablet/Capsule</option>
            </>
          ) : (
            <option value="Unit">Unit / Bottle / Tube</option>
          )}
        </select>
      </Field>
      <Field label="Total Purchase Price">
        <Input type="number" step="0.01" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
      </Field>
    </div>
  </div>

  {/* Pricing */}
  <div className="space-y-4 pt-2 border-t border-border/50">
    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Selling Price & MRP</h3>
    <div className="grid grid-cols-2 gap-4">
      <Field label="Price (Smallest Unit)">
        <Input type="number" step="0.01" value={form.pricePerTablet} onChange={(e) => {
          const v = e.target.value;
          const tps = Number(form.tabletsPerStrip) || 10;
          const spb = Number(form.stripsPerBox) || 10;
          setForm({
            ...form, 
            pricePerTablet: v, 
            pricePerStrip: v ? String(Number(v) * tps) : "",
            pricePerBox: v ? String(Number(v) * tps * spb) : ""
          });
        }} required />
      </Field>
      <Field label="MRP (Smallest Unit)">
        <Input type="number" step="0.01" value={form.mrpPerTablet} onChange={(e) => {
          const v = e.target.value;
          const tps = Number(form.tabletsPerStrip) || 10;
          const spb = Number(form.stripsPerBox) || 10;
          setForm({
            ...form, 
            mrpPerTablet: v, 
            mrpPerStrip: v ? String(Number(v) * tps) : "",
            mrpPerBox: v ? String(Number(v) * tps * spb) : ""
          });
        }} />
      </Field>
      {(form.medicineType === "Tablet" || form.medicineType === "Capsule") && (
        <>
          <Field label="Price Per Strip">
            <Input type="number" step="0.01" value={form.pricePerStrip} onChange={(e) => {
              const v = e.target.value;
              const tps = Number(form.tabletsPerStrip) || 10;
              const spb = Number(form.stripsPerBox) || 10;
              setForm({
                ...form, 
                pricePerStrip: v, 
                pricePerTablet: v ? String(Number(v) / tps) : "",
                pricePerBox: v ? String(Number(v) * spb) : ""
              });
            }} />
          </Field>
          <Field label="MRP Per Strip">
            <Input type="number" step="0.01" value={form.mrpPerStrip} onChange={(e) => {
              const v = e.target.value;
              const tps = Number(form.tabletsPerStrip) || 10;
              const spb = Number(form.stripsPerBox) || 10;
              setForm({
                ...form, 
                mrpPerStrip: v, 
                mrpPerTablet: v ? String(Number(v) / tps) : "",
                mrpPerBox: v ? String(Number(v) * spb) : ""
              });
            }} />
          </Field>
          <Field label="Price Per Box">
            <Input type="number" step="0.01" value={form.pricePerBox} onChange={(e) => {
              const v = e.target.value;
              const tps = Number(form.tabletsPerStrip) || 10;
              const spb = Number(form.stripsPerBox) || 10;
              setForm({
                ...form, 
                pricePerBox: v, 
                pricePerStrip: v ? String(Number(v) / spb) : "",
                pricePerTablet: v ? String(Number(v) / (tps * spb)) : ""
              });
            }} />
          </Field>
          <Field label="MRP Per Box">
            <Input type="number" step="0.01" value={form.mrpPerBox} onChange={(e) => {
              const v = e.target.value;
              const tps = Number(form.tabletsPerStrip) || 10;
              const spb = Number(form.stripsPerBox) || 10;
              setForm({
                ...form, 
                mrpPerBox: v, 
                mrpPerStrip: v ? String(Number(v) / spb) : "",
                mrpPerTablet: v ? String(Number(v) / (tps * spb)) : ""
              });
            }} />
          </Field>
        </>
      )}
    </div>
  </div>

  <DialogFooter className="mt-4">
    <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    <Button type="submit" className="shadow-soft">{editing ? "Save changes" : "Add product"}</Button>
  </DialogFooter>
</form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="shadow-soft overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">MRP</TableHead>
              <TableHead className="text-right">Purchase</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                  {items.length === 0
                    ? "No products yet. Add your first one to get started."
                    : "No products match your search."}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((p, idx) => {
                const lowStock = p.stock <= 10;
                return (
                  <TableRow
                    key={p.id}
                    className="animate-fade-in cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate({ to: "/inventory/$id", params: { id: p.id } })}
                  >
                    <TableCell className="text-center font-medium text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium flex items-center gap-1.5">
                        {p.name}
                        {p.pack && (
                          <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                            {p.pack}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.manufacturer ?? "—"} {p.batch ? `· Batch ${p.batch}` : ""}
                        {p.prescription ? " · Rx" : ""}
                      </div>
                    </TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.mrp ? p.mrp.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.costPrice ? p.costPrice.toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.price.toFixed(2)}
                      {p.taxPercent ? (
                        <span className="text-xs text-muted-foreground"> +{p.taxPercent}%</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          lowStock
                            ? "inline-block bg-warning/30 text-warning-foreground px-2 py-0.5 rounded-md text-xs"
                            : "tabular-nums"
                        }
                      >
                        {formatStock(p.stock, p.medicineType || "Tablet", Number(p.tabletsPerStrip || 10), Number(p.stripsPerBox || 10))}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(p.expiry).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          quickAdd(p);
                        }}
                        disabled={p.stock <= 0}
                        className="text-primary hover:text-primary"
                        title="Add to cart"
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </Button>
                      <Link
                        to="/inventory/$id"
                        params={{ id: p.id }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button variant="ghost" size="icon" title="View Details">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(p);
                        }}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(p);
                        }}
                        className="text-destructive hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <SkuScanner open={scannerOpen} onOpenChange={setScannerOpen} onDetected={handleScan} />
    </div>
  );
}

function Field({
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

function RecentOptions({ id, options }: { id?: string; options: string[] }) {
  if (!options || options.length === 0 || !id) return null;
  return (
    <datalist id={id}>
      {options.map((opt) => (
        <option key={opt} value={opt} />
      ))}
    </datalist>
  );
}
