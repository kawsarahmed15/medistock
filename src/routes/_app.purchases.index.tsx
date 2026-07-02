import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
