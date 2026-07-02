import { createFileRoute, Link } from "@tanstack/react-router";
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
                      {item.batch ? `B: ${item.batch}` : ""} {item.expiry ? `E: ${item.expiry}` : ""}
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
