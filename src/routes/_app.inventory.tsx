import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, ScanLine, Search, ShoppingCart, Trash2, Eye, FileUp } from "lucide-react";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}
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
  const [importOpen, setImportOpen] = useState(false);
  const { session } = useAuth();
  const expiryDays = session?.expiryDays ?? 60;

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
        stockType: match.pack ? "tab" : "other",
        stockPacks: match.pack ? match.pack.split(/[*xX]/)[0] : "",
        stockUnits: match.pack ? match.pack.split(/[*xX]/)[1] : "",
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
      setForm({ ...empty, sku: trimmed });
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
  }, [items, query, search.filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  useEffect(() => {
    const handler = () => {
      setEditing(null);
      setForm(empty);
      setOpen(true);
    };
    window.addEventListener("trigger-add-product", handler);
    return () => window.removeEventListener("trigger-add-product", handler);
  }, []);

  if (loading && items.length === 0) return <TableSkeleton cols={6} />;

  const startAdd = () => {
    setEditing(null);
    setForm(empty);
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
      stockType: p.pack ? "tab" : "other",
      stockPacks: p.pack ? p.pack.split(/[*xX]/)[0] : "",
      stockUnits: p.pack ? p.pack.split(/[*xX]/)[1] : "",
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
    if (form.stockType === "tab" || form.stockType === "cap") {
      if (form.stockPacks && form.stockUnits) {
        packValue = `${form.stockPacks}x${form.stockUnits}`;
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

  const handleBulkImport = async (parsedProducts: any[]) => {
    try {
      let count = 0;
      for (const p of parsedProducts) {
        await productsStore.add({
          name: p.name,
          category: p.category || "General",
          costPrice: p.costPrice,
          price: p.price,
          mrp: p.mrp || p.price,
          stock: p.stock,
          expiry: p.expiry,
          batch: p.batch || undefined,
          manufacturer: p.manufacturer || undefined,
          sku: p.sku || undefined,
          taxPercent: p.taxPercent || 0,
          prescription: !!p.prescription,
          baseUnit: "Unit",
          packUnit: "Pack",
          conversionFactor: 1,
        });
        count++;
      }
      toast.success(`Successfully imported ${count} products`);
      refresh();
    } catch (err) {
      toast.error("Failed to import some products: " + ((err as Error).message || "Unknown error"));
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
          <Button
            variant="outline"
            onClick={() => setScannerOpen(true)}
            title="Scan SKU / barcode"
          >
            <ScanLine className="h-4 w-4" />
            <span className="hidden sm:inline">Scan SKU</span>
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)} title="Bulk Import">
            <FileUp className="h-4 w-4" />
            <span className="hidden sm:inline">Bulk Import</span>
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
                  />
                </Field>
                <Field label="Manufacturer">
                  <Input
                    value={form.manufacturer}
                    onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                  />
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
                    onChange={(e) => setForm({ ...form, stockType: e.target.value })}
                  >
                    <option value="other">General / Other</option>
                    <option value="tab">Tablet (Tab)</option>
                    <option value="cap">Capsule (Cap)</option>
                    <option value="syp">Syrup (Syp)</option>
                    <option value="inj">Injection (Inj)</option>
                    <option value="jar">Jar</option>
                  </select>
                </Field>
                {(form.stockType === "tab" || form.stockType === "cap") && (
                  <Field label="Pack (Strips × Per Strip)">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Strips"
                        value={form.stockPacks}
                        onChange={(e) => setForm({ ...form, stockPacks: e.target.value })}
                        required
                      />
                      <span className="text-muted-foreground">×</span>
                      <Input
                        type="number"
                        placeholder="Units"
                        value={form.stockUnits}
                        onChange={(e) => setForm({ ...form, stockUnits: e.target.value })}
                        required
                      />
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
                <Field label="SKU">
                  <div className="flex gap-2">
                    <Input
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      placeholder="Type or scan"
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
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  {items.length === 0
                    ? "No products yet. Add your first one to get started."
                    : "No products match your search."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => {
                const lowStock = p.stock <= 10;
                return (
                  <TableRow 
                    key={p.id} 
                    className="animate-fade-in cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate({ to: "/inventory/$id", params: { id: p.id } })}
                  >
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.manufacturer ?? "—"} {p.batch ? `· Batch ${p.batch}` : ""}
                        {p.prescription ? " · Rx" : ""}
                      </div>
                    </TableCell>
                    <TableCell>{p.category}</TableCell>
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
      <BulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleBulkImport}
      />
    </div>
  );
}

function BulkImportDialog({ open, onOpenChange, onImport }: { open: boolean, onOpenChange: (o: boolean) => void, onImport: (products: any[]) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    setError("");

    try {
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv")) {
        const data = await parseExcel(file);
        if (data.length === 0) throw new Error("No valid products found in the file.");
        onImport(data);
        onOpenChange(false);
      } else if (file.name.endsWith(".pdf")) {
        const data = await parsePdf(file);
        if (data.length === 0) throw new Error("Could not extract tabular product data from the PDF. The heuristic parser failed.");
        onImport(data);
        onOpenChange(false);
      } else {
        throw new Error("Unsupported file format. Please upload an Excel, CSV, or PDF file.");
      }
    } catch (err) {
      setError((err as Error).message || "Failed to process file.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Import Products</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload an Excel (.xlsx), CSV, or PDF file. Excel/CSV should have columns like <strong>Name, Category, Buying Price, Selling Price, Stock, Expiry, Batch, SKU</strong>.
          </p>
          <div className="flex gap-4 items-center">
             <label className="relative flex-1 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border px-6 py-10 text-center hover:bg-accent/50 transition-smooth">
                <FileUp className="mx-auto h-8 w-8 text-muted-foreground" />
                <span className="mt-2 block text-sm font-medium">Click to select file</span>
                <span className="block text-xs text-muted-foreground">Excel, CSV, PDF up to 10MB</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv,.pdf"
                  onChange={handleFile}
                  disabled={loading}
                />
             </label>
          </div>
          {loading && <p className="text-sm text-primary text-center animate-pulse">Processing file...</p>}
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function parseExcel(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheet = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
        
        const parsed = rows.map((row: any) => ({
          name: row.name || row.Name || row["Product Name"] || "",
          category: row.category || row.Category || "General",
          costPrice: Number(row.costPrice || row.cost_price || row["Cost Price"] || row["Buying Price"]) || 0,
          price: Number(row.price || row.Price || row["Selling Price"]) || 0,
          stock: Number(row.stock || row.Stock || row.Qty || row.Quantity) || 0,
          expiry: row.expiry || row.Expiry ? new Date(row.expiry || row.Expiry).toISOString().slice(0, 10) : new Date(Date.now() + 31536000000).toISOString().slice(0, 10),
          batch: String(row.batch || row.Batch || ""),
          sku: String(row.sku || row.SKU || ""),
        })).filter((p) => p.name && p.price > 0 && p.costPrice > 0);
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

async function parsePdf(file: File): Promise<any[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => item.str);
    fullText += strings.join(" ") + "\n";
  }
  
  const parsed: any[] = [];
  const lines = fullText.split('\n');
  for (const line of lines) {
    // Basic heuristic: check if line has words, and some numbers at the end
    // E.g. "Paracetamol 500mg 100 50 80" -> Name Qty Cost Price
    const match = line.match(/^([A-Za-z0-9\s\-\.]+)\s+(\d+)\s+([\d\.]+)\s+([\d\.]+)/);
    if (match && match[1].trim().length > 3) {
       parsed.push({
         name: match[1].trim(),
         category: "General",
         stock: Number(match[2]),
         costPrice: Number(match[3]),
         price: Number(match[4]),
         expiry: new Date(Date.now() + 31536000000).toISOString().slice(0, 10),
         batch: "",
         sku: "",
       });
    }
  }
  return parsed;
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
