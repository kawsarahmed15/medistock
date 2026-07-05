import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
    if (lines.some(l => !l.productId)) {
      toast.error("Please select an existing product from the dropdown for all items.");
      return;
    }
    if (lines.some(l => l.qty <= 0)) {
      toast.error("Please ensure quantity is greater than 0 for all items.");
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
          
          <div className="overflow-x-auto pb-48">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <th className="pb-2 font-medium min-w-[250px]">Product Name</th>
                  <th className="pb-2 font-medium min-w-[80px]">Qty</th>
                  <th className="pb-2 font-medium min-w-[90px]">Free Qty</th>
                  <th className="pb-2 font-medium min-w-[100px]">Cost Price</th>
                  <th className="pb-2 font-medium min-w-[80px]">Tax %</th>
                  <th className="pb-2 font-medium min-w-[90px]">MRP</th>
                  <th className="pb-2 font-medium min-w-[120px]">Batch</th>
                  <th className="pb-2 font-medium min-w-[140px]">Expiry</th>
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
                      {activeLine === index && productSearch && (
                        <div className="absolute z-50 top-full left-0 mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
                          {filteredProducts.length > 0 ? (
                            filteredProducts.map(p => (
                              <div 
                                key={p.id} 
                                className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                                onMouseDown={() => selectProduct(index, p)}
                              >
                                {p.name} <span className="text-muted-foreground text-xs">({p.stock} in stock)</span>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                              Product not found.<br/>
                              <Link to="/inventory" className="text-primary hover:underline">Add it to Inventory first.</Link>
                            </div>
                          )}
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
