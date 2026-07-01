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

const empty: FormState = {
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

function parsePack(packStr?: string) {
  if (!packStr) return { stockType: "other", stockPacks: "", stockUnits: "" };
  
  if (packStr.toUpperCase().endsWith("ML") && !packStr.includes("x") && !packStr.includes("X")) {
    const val = packStr.substring(0, packStr.length - 2).trim();
    return { stockType: "syp", stockPacks: val, stockUnits: "ML" };
  }
  
  if (packStr.toUpperCase().endsWith("MG")) {
    const val = packStr.substring(0, packStr.length - 2).trim();
    return { stockType: "inj", stockPacks: val, stockUnits: "MG" };
  }

  if (packStr.toUpperCase().endsWith(" GM")) {
    const val = packStr.substring(0, packStr.length - 3).trim();
    return { stockType: "cream", stockPacks: val, stockUnits: "GM" };
  }

  if (packStr.toUpperCase().endsWith("GM")) {
    const val = packStr.substring(0, packStr.length - 2).trim();
    return { stockType: "inj", stockPacks: val, stockUnits: "GM" };
  }

  if (packStr.includes("x") || packStr.includes("X") || packStr.includes("*") || packStr.toUpperCase() === "CAP") {
    return { stockType: "tab", stockPacks: packStr, stockUnits: "" };
  }

  return { stockType: "other", stockPacks: packStr, stockUnits: "" };
}

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
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "name_asc" | "name_desc">("date_desc");
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

  const saveRecent = (key: string, value: string, current: string[], setter: (v: string[]) => void, limit = 4) => {
    if (!value.trim()) return;
    const updated = [value.trim(), ...current.filter((v) => v.toLowerCase() !== value.trim().toLowerCase())].slice(0, limit);
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
    const match = items.find(
      (p) => (p.sku ?? "").trim().toLowerCase() === trimmed.toLowerCase(),
    );
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
      if (sortBy === "date_asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
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
      costPrice: p.costPrice != null ? String(p.costPrice) : "",
      price: String(p.price),
      mrp: p.mrp != null ? String(p.mrp) : "",
      stock: String(p.stock),
      ...parsePack(p.pack),
      expiry: p.expiry.slice(0, 10),
      batch: p.batch ?? "",
      manufacturer: p.manufacturer ?? "",
      sku: p.sku ?? "",
      taxPercent: String(p.taxPercent ?? 0),
      prescription: !!p.prescription,
      baseUnit: p.baseUnit ?? "Unit",
      packUnit: p.packUnit ?? "Pack",
      conversionFactor: String(p.conversionFactor ?? 1),
      packPrice: p.packPrice != null ? String(p.packPrice) : "",
      packCostPrice: p.packCostPrice != null ? String(p.packCostPrice) : "",
    });
    setOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    let packValue: string | undefined = undefined;
    if (form.stockType === "tab" || form.stockType === "cap" || form.stockType === "other") {
      if (form.stockPacks) {
        packValue = form.stockPacks;
      }
    } else if (form.stockType === "syp") {
      if (form.stockPacks) {
        packValue = `${form.stockPacks}ML`;
      }
    } else if (form.stockType === "inj") {
      if (form.stockPacks) {
        packValue = `${form.stockPacks}${form.stockUnits || "ML"}`;
      }
    } else if (form.stockType === "cream") {
      if (form.stockPacks) {
        packValue = `${form.stockPacks} GM`;
      }
    }
    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || "General",
      costPrice: form.costPrice === "" ? undefined : Number(form.costPrice),
      price: Number(form.price),
      mrp: form.mrp === "" ? undefined : Number(form.mrp),
      stock: Number(form.stock) || 0,
      pack: packValue,
      expiry: form.expiry,
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
    if (!payload.name || !payload.expiry || isNaN(payload.price) || isNaN(payload.stock) || payload.costPrice === undefined || isNaN(payload.costPrice)) {
      toast.error("Please fill name, buying price, selling price, stock and expiry.");
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
          <Button
            variant="outline"
            onClick={() => setScannerOpen(true)}
            title="Scan HSN / barcode"
          >
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
              <form onSubmit={submit} className="grid grid-cols-2 gap-4">
                <Field label="Name" className="col-span-2">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Category">
                  <Input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="e.g. Antibiotic"
                    list="category-recent"
                  />
                  <RecentOptions id="category-recent" options={recentCategories} />
                </Field>
                <Field label="Manufacturer">
                  <Input
                    value={form.manufacturer}
                    onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                    list="manufacturer-recent"
                  />
                  <RecentOptions id="manufacturer-recent" options={recentManufacturers} />
                </Field>
                <Field label="Buying price">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                    placeholder="Cost per unit"
                    required
                  />
                </Field>
                <Field label="Selling price">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    required
                  />
                </Field>
                <Field label="MRP">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.mrp}
                    onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                    placeholder="Printed price"
                  />
                </Field>
                <Field label="Stock Type">
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
                  </select>
                </Field>
                {form.stockType === "other" && (
                  <Field label="Pack Options">
                    <div className="flex items-center gap-2">
                      <Input
                        list="general-options"
                        placeholder="e.g. 10X10, ML, GM..."
                        value={form.stockPacks}
                        onChange={(e) => setForm({ ...form, stockPacks: e.target.value })}
                      />
                      <datalist id="general-options">
                        <option value="10X10" />
                        <option value="10X1X10" />
                        <option value="ML" />
                        <option value="MG" />
                        <option value="GM" />
                        <option value="CAP" />
                      </datalist>
                    </div>
                  </Field>
                )}
                {(form.stockType === "tab" || form.stockType === "cap") && (
                  <Field label="Pack Format">
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        list="tab-cap-pack-options"
                        placeholder="e.g. 10x10, 10X1X10, CAP"
                        value={form.stockPacks}
                        onChange={(e) => setForm({ ...form, stockPacks: e.target.value })}
                        required
                      />
                      <datalist id="tab-cap-pack-options">
                        <option value="10X10" />
                        <option value="10X1X10" />
                        <option value="CAP" />
                      </datalist>
                    </div>
                  </Field>
                )}
                {form.stockType === "syp" && (
                  <Field label="Pack (ML)">
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
                  </Field>
                )}
                {form.stockType === "inj" && (
                  <Field label="Pack (Measure)">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={form.stockPacks}
                        onChange={(e) => setForm({ ...form, stockPacks: e.target.value })}
                        required
                      />
                      <select
                        className="flex h-9 w-24 items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={form.stockUnits || "ML"}
                        onChange={(e) => setForm({ ...form, stockUnits: e.target.value })}
                      >
                        <option value="ML">ML</option>
                        <option value="MG">MG</option>
                        <option value="GM">GM</option>
                      </select>
                    </div>
                  </Field>
                )}
                {form.stockType === "cream" && (
                  <Field label="Pack (Measure)">
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
                  </Field>
                )}
                <Field label="Stock Quantity">
                  <Input
                    type="number"
                    placeholder="Total qty"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Expiry">
                  <Input
                    type="date"
                    value={form.expiry}
                    onChange={(e) => setForm({ ...form, expiry: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Tax %">
                  <Input
                    type="number"
                    value={form.taxPercent}
                    onChange={(e) => setForm({ ...form, taxPercent: e.target.value })}
                  />
                </Field>
                <Field label="Batch">
                  <Input
                    value={form.batch}
                    onChange={(e) => setForm({ ...form, batch: e.target.value })}
                  />
                </Field>
                <Field label="HSN Code">
                  <div className="flex gap-2">
                    <Input
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      placeholder="Type or scan"
                      list="hsn-recent"
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
                  <RecentOptions id="hsn-recent" options={recentHsns} />
                </Field>
                <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-medium">Prescription required</div>
                    <div className="text-xs text-muted-foreground">
                      Mark this product as Rx-only.
                    </div>
                  </div>
                  <Switch
                    checked={form.prescription}
                    onCheckedChange={(v) => setForm({ ...form, prescription: v })}
                  />
                </div>
                <DialogFooter className="col-span-2">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="shadow-soft">
                    {editing ? "Save changes" : "Add product"}
                  </Button>
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
                        {p.stock}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(p.expiry).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); quickAdd(p); }}
                        disabled={p.stock <= 0}
                        className="text-primary hover:text-primary"
                        title="Add to cart"
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </Button>
                      <Link to="/inventory/$id" params={{ id: p.id }} onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" title="View Details">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); startEdit(p); }} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); remove(p); }}
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

      <SkuScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={handleScan}
      />
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

