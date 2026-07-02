const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src/routes');

const purchasesOutlet = `import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/purchases")({
  component: () => <Outlet />,
});
`;
fs.writeFileSync(path.join(srcDir, '_app.purchases.tsx'), purchasesOutlet);

const purchasesIndex = `import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Truck, Search, Plus } from "lucide-react";
import { purchasesStore, type Purchase } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/loading-skeleton";

export const Route = createFileRoute("/_app/purchases/")({
  component: PurchasesPage,
});

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);
}

function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    purchasesStore
      .list()
      .then((p) => {
        if (!cancelled) {
          setPurchases(p);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPurchases([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    let res = purchases;
    if (query) {
      const q = query.toLowerCase();
      res = res.filter(
        (p) =>
          p.number.toLowerCase().includes(q) ||
          p.supplierName?.toLowerCase().includes(q) ||
          p.supplierInvoice?.toLowerCase().includes(q)
      );
    }
    return res;
  }, [purchases, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Purchase History</h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage supplier purchases</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search purchases..."
              className="pl-9 h-10 w-full"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button asChild className="shrink-0 h-10">
            <Link to="/purchases/new">
              <Plus className="h-4 w-4 mr-2" /> Add Purchase
            </Link>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-border/60 shadow-soft">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>PO Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Inv No.</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton columns={7} rows={5} />
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    {query ? "No purchases match your search." : "No purchases recorded yet."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-foreground">
                      <Link to={"/purchases/" + p.id} className="text-primary hover:underline">{p.number}</Link>
                    </TableCell>
                    <TableCell>{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{p.supplierName || "—"}</TableCell>
                    <TableCell>{p.supplierInvoice || "—"}</TableCell>
                    <TableCell className="text-right">{p.items.length}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(p.total)}</TableCell>
                    <TableCell className="text-right uppercase text-xs">{p.paymentStatus}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
`;
fs.writeFileSync(path.join(srcDir, '_app.purchases.index.tsx'), purchasesIndex);

const purchasesDetails = `import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Truck } from "lucide-react";
import { purchasesStore, type Purchase } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/purchases/$id")({
  component: PurchaseDetailsPage,
});

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);
}

function PurchaseDetailsPage() {
  const { id } = Route.useParams();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    purchasesStore
      .get(id)
      .then((p) => {
        setPurchase(p);
        setLoading(false);
      })
      .catch((err) => {
        toast.error(err.message || "Failed to load purchase");
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading purchase...</div>;
  }
  if (!purchase) {
    return <div className="p-8 text-center text-rose-500">Purchase not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0 text-muted-foreground hover:text-foreground">
          <Link to="/purchases"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" /> Purchase {purchase.number}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date(purchase.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-5 border-border/60 shadow-soft space-y-1 text-sm">
          <div className="text-muted-foreground mb-3 font-medium uppercase tracking-wider text-xs">Supplier Details</div>
          <div className="font-medium text-foreground text-base">{purchase.supplierName || "N/A"}</div>
          {purchase.supplierPhone && <div>Phone: {purchase.supplierPhone}</div>}
          {purchase.supplierInvoice && <div>Invoice: {purchase.supplierInvoice}</div>}
        </Card>
        <Card className="p-5 border-border/60 shadow-soft space-y-1 text-sm">
          <div className="text-muted-foreground mb-3 font-medium uppercase tracking-wider text-xs">Payment Details</div>
          <div>Status: <span className="uppercase font-medium">{purchase.paymentStatus}</span></div>
          <div>Method: <span className="capitalize">{purchase.paymentMethod.replace("_", " ")}</span></div>
          {purchase.notes && <div className="mt-2 pt-2 border-t border-border">Notes: {purchase.notes}</div>}
        </Card>
      </div>

      <Card className="overflow-hidden border-border/60 shadow-soft">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Item</TableHead>
                <TableHead>Batch/Exp</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Free</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Tax %</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchase.items.map((item, i) => {
                const sub = item.qty * item.costPrice;
                const tax = sub * (item.taxPercent / 100);
                const tot = sub + tax;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.batch ? \`B: \${item.batch}\` : ""} {item.expiry ? \`E: \${item.expiry}\` : ""}
                    </TableCell>
                    <TableCell className="text-right">{item.qty}</TableCell>
                    <TableCell className="text-right">{item.freeQty}</TableCell>
                    <TableCell className="text-right">{formatMoney(item.costPrice)}</TableCell>
                    <TableCell className="text-right">{item.taxPercent}%</TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(tot)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="p-5 bg-muted/20 border-t border-border flex flex-col items-end text-sm space-y-2">
          <div className="w-full sm:w-64 flex justify-between">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-medium">{formatMoney(purchase.subtotal)}</span>
          </div>
          <div className="w-full sm:w-64 flex justify-between">
            <span className="text-muted-foreground">Tax:</span>
            <span className="font-medium">{formatMoney(purchase.tax)}</span>
          </div>
          <div className="w-full sm:w-64 flex justify-between">
            <span className="text-muted-foreground">Discount:</span>
            <span className="font-medium text-emerald-600">-{formatMoney(purchase.discount)}</span>
          </div>
          <div className="w-full sm:w-64 flex justify-between pt-2 border-t border-border text-base">
            <span className="font-semibold text-foreground">Total:</span>
            <span className="font-bold text-primary">{formatMoney(purchase.total)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
`;
fs.writeFileSync(path.join(srcDir, '_app.purchases.$id.tsx'), purchasesDetails);

const purchasesNew = `import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Trash2, Plus, ArrowLeft, Search } from "lucide-react";
import { purchasesStore, productsStore, type Product } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/purchases/new")({
  component: AddPurchasePage,
});

type PurchaseLine = {
  productId?: string;
  name: string;
  qty: number;
  freeQty: number;
  costPrice: number;
  taxPercent: number;
  batch: string;
  expiry: string;
  mrp: number;
};

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);
}

function AddPurchasePage() {
  const navigate = useNavigate();
  const [lines, setLines] = useState<PurchaseLine[]>([
    { productId: "", name: "", qty: 1, freeQty: 0, costPrice: 0, taxPercent: 0, batch: "", expiry: "", mrp: 0 }
  ]);
  const [supplierName, setSupplierName] = useState("");
  const [supplierInvoice, setSupplierInvoice] = useState("");
  const [discount, setDiscount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [activeLine, setActiveLine] = useState<number | null>(null);

  useMemo(() => {
    productsStore.list().then(setProducts).catch(console.error);
  }, []);

  const addLine = () => {
    setLines([...lines, { productId: "", name: "", qty: 1, freeQty: 0, costPrice: 0, taxPercent: 0, batch: "", expiry: "", mrp: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof PurchaseLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const selectProduct = (index: number, p: Product) => {
    const newLines = [...lines];
    newLines[index] = {
      ...newLines[index],
      productId: p.id,
      name: p.name,
      costPrice: p.costPrice || 0,
      taxPercent: p.taxPercent || 0,
      mrp: p.mrp || 0,
    };
    setLines(newLines);
    setActiveLine(null);
  };

  const subtotal = lines.reduce((acc, l) => acc + l.qty * l.costPrice, 0);
  const tax = lines.reduce((acc, l) => acc + (l.qty * l.costPrice) * (l.taxPercent / 100), 0);
  const total = subtotal + tax - discount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.some(l => !l.name || l.qty <= 0)) {
      toast.error("Please fill all item names and ensure quantity > 0");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const p = await purchasesStore.add({
        supplierName,
        supplierInvoice,
        paymentStatus: "paid",
        paymentMethod: "cash",
        amountPaid: total,
        subtotal,
        tax,
        discount,
        total,
        items: lines,
      });
      toast.success("Purchase added successfully!");
      navigate({ to: "/purchases/" + p.id });
    } catch (err: any) {
      toast.error(err.message || "Failed to add purchase");
      setIsSubmitting(false);
    }
  };

  const filteredProducts = productSearch 
    ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    : [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0 text-muted-foreground hover:text-foreground">
          <Link to="/purchases"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add Purchase</h1>
          <p className="text-sm text-muted-foreground mt-1">Record a new purchase and update inventory</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-5 border-border/60 shadow-soft">
          <h3 className="font-semibold mb-4">Supplier Details</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Supplier Name</Label>
              <Input placeholder="Enter supplier name" value={supplierName} onChange={e => setSupplierName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Supplier Invoice No.</Label>
              <Input placeholder="Invoice number" value={supplierInvoice} onChange={e => setSupplierInvoice(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card className="p-5 border-border/60 shadow-soft overflow-visible">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Items</h3>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4 mr-2" /> Add Item
            </Button>
          </div>
          
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <th className="pb-2 font-medium w-64">Product Name</th>
                  <th className="pb-2 font-medium w-24">Qty</th>
                  <th className="pb-2 font-medium w-24">Free Qty</th>
                  <th className="pb-2 font-medium w-28">Cost Price</th>
                  <th className="pb-2 font-medium w-24">Tax %</th>
                  <th className="pb-2 font-medium w-24">MRP</th>
                  <th className="pb-2 font-medium w-28">Batch</th>
                  <th className="pb-2 font-medium w-36">Expiry</th>
                  <th className="pb-2 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td className="py-2 pr-2 relative">
                      <Input 
                        placeholder="Item name" 
                        value={line.name} 
                        onChange={e => {
                          updateLine(index, "name", e.target.value);
                          updateLine(index, "productId", ""); // reset link
                          setProductSearch(e.target.value);
                        }} 
                        onFocus={() => {
                          setActiveLine(index);
                          setProductSearch(line.name);
                        }}
                      />
                      {activeLine === index && filteredProducts.length > 0 && (
                        <div className="absolute z-50 top-full left-0 mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
                          {filteredProducts.map(p => (
                            <div 
                              key={p.id} 
                              className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                              onMouseDown={() => selectProduct(index, p)}
                            >
                              {p.name} <span className="text-muted-foreground text-xs">({p.stock} in stock)</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-2"><Input type="number" min="1" value={line.qty || ""} onChange={e => updateLine(index, "qty", parseInt(e.target.value) || 0)} /></td>
                    <td className="py-2 pr-2"><Input type="number" min="0" value={line.freeQty || ""} onChange={e => updateLine(index, "freeQty", parseInt(e.target.value) || 0)} /></td>
                    <td className="py-2 pr-2"><Input type="number" step="0.01" value={line.costPrice || ""} onChange={e => updateLine(index, "costPrice", parseFloat(e.target.value) || 0)} /></td>
                    <td className="py-2 pr-2"><Input type="number" step="0.01" value={line.taxPercent || ""} onChange={e => updateLine(index, "taxPercent", parseFloat(e.target.value) || 0)} /></td>
                    <td className="py-2 pr-2"><Input type="number" step="0.01" value={line.mrp || ""} onChange={e => updateLine(index, "mrp", parseFloat(e.target.value) || 0)} /></td>
                    <td className="py-2 pr-2"><Input placeholder="Batch" value={line.batch} onChange={e => updateLine(index, "batch", e.target.value)} /></td>
                    <td className="py-2 pr-2"><Input type="date" value={line.expiry} onChange={e => updateLine(index, "expiry", e.target.value)} /></td>
                    <td className="py-2 text-right">
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(index)} className="text-rose-500" disabled={lines.length === 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex justify-end">
          <Card className="w-full sm:w-80 p-5 border-border/60 shadow-soft space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-medium">{formatMoney(tax)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Discount</span>
              <Input 
                type="number" 
                step="0.01"
                className="w-24 h-8 text-right" 
                value={discount || ""} 
                onChange={e => setDiscount(parseFloat(e.target.value) || 0)} 
              />
            </div>
            <div className="flex justify-between text-lg font-bold pt-3 border-t border-border mt-3">
              <span>Total</span>
              <span className="text-primary">{formatMoney(total)}</span>
            </div>
            <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Purchase"}
            </Button>
          </Card>
        </div>
      </form>
    </div>
  );
}
`;
fs.writeFileSync(path.join(srcDir, '_app.purchases.new.tsx'), purchasesNew);

console.log("Files generated");
