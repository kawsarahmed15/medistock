import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import { toast } from "sonner";
import { ArrowLeft, Package, History, ArrowDownToLine, ArrowUpFromLine, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/inventory_/$id")({
  component: ProductDetails,
});

function ProductDetails() {
  const { id } = useParams({ from: "/_app/inventory_/$id" });
  const [product, setProduct] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stock action dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"stock_in" | "stock_out" | "purchase">("stock_in");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    try {
      const pRes = await apiRequest(`/products/${id}`, { auth: true });
      setProduct(pRes);
      
      const hRes = await apiRequest(`/products/${id}/history`, { auth: true });
      setHistory(hRes);
    } catch (err) {
      toast.error("Failed to load product details");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  const handleStockAction = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) return toast.error("Quantity must be greater than 0");

    setSubmitting(true);
    try {
      await apiRequest(`/products/${id}/stock`, {
        method: "POST",
        body: { action: actionType, quantity: qty, notes },
        auth: true,
      });
      toast.success("Stock updated successfully");
      setDialogOpen(false);
      setQuantity("");
      setNotes("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update stock");
    } finally {
      setSubmitting(false);
    }
  };

  const openAction = (type: "stock_in" | "stock_out" | "purchase") => {
    setActionType(type);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center mt-12">
        <h2 className="text-2xl font-bold">Product not found</h2>
        <Link to="/inventory" className="text-primary hover:underline mt-4 inline-block">
          Return to Inventory
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/inventory">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <p className="text-sm text-muted-foreground">{product.category}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Current Stock
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{product.stock}</div>
              <div className="mt-6 flex flex-col gap-2">
                <Button onClick={() => openAction("purchase")} variant="default" className="w-full gap-2">
                  <ShoppingCart className="w-4 h-4" /> Add Purchase
                </Button>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Button onClick={() => openAction("stock_in")} variant="outline" className="gap-2">
                    <ArrowDownToLine className="w-4 h-4 text-emerald-500" /> Stock In
                  </Button>
                  <Button onClick={() => openAction("stock_out")} variant="outline" className="gap-2">
                    <ArrowUpFromLine className="w-4 h-4 text-rose-500" /> Stock Out
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price (MRP)</span>
                <span className="font-medium">₹{Number(product.price).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost Price</span>
                <span className="font-medium">₹{Number(product.cost_price || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax (GST)</span>
                <span className="font-medium">{Number(product.tax_percent || 0).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expiry</span>
                <span className="font-medium">{new Date(product.expiry).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Timeline History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No history recorded for this product yet.
                </div>
              ) : (
                <div className="relative border-l border-border ml-3 space-y-6 pb-4">
                  {history.map((record: any) => (
                    <div key={record.id} className="relative pl-6">
                      <div className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-background ${
                        record.action === 'sale' || record.action === 'stock_out' ? 'bg-rose-500' : 'bg-emerald-500'
                      }`} />
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <span className="font-medium capitalize text-sm">
                            {record.action.replace('_', ' ')}
                          </span>
                          <span className={`ml-2 text-xs font-bold ${record.quantity > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {record.quantity > 0 ? '+' : ''}{record.quantity}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(record.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Balance after: {record.balance}
                        {record.notes && <p className="mt-1 text-foreground italic">"{record.notes}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              {actionType.replace("_", " ")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStockAction} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input 
                type="number" 
                min="1" 
                value={quantity} 
                onChange={(e) => setQuantity(e.target.value)} 
                required 
                placeholder="Enter quantity..."
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder={actionType === "purchase" ? "Invoice #, Supplier info..." : "Reason for adjustment..."}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>Confirm</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
