import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CreditCard, Search, Phone, History } from "lucide-react";
import { customersStore, type Customer } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/credit")({
  component: CreditPage,
});

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function CreditPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [q, setQ] = useState("");

  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<any[] | null>(null);

  const loadData = () => {
    customersStore
      .list() // Load all time to get accurate credit balances
      .then((c) => setCustomers(c.filter(cust => cust.balance > 0)))
      .catch((e) => toast.error((e as Error).message || "Failed to load credit customers"));
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    if (!customers) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.phone.toLowerCase().includes(needle),
    );
  }, [customers, q]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomer) return;
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setSubmittingPayment(true);
    try {
      await customersStore.addPayment({
        phone: paymentCustomer.phone,
        name: paymentCustomer.name,
        amount,
        method: paymentMethod,
      });
      toast.success("Payment recorded");
      setPaymentCustomer(null);
      setPaymentAmount("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const loadHistory = async (c: Customer) => {
    setHistoryCustomer(c);
    setHistory(null);
    try {
      const data = await customersStore.getCreditHistory(c.phone);
      setHistory(data);
    } catch (err: any) {
      toast.error("Failed to load history");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" /> Credit Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage customers with active credit balances.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or phone"
            className="pl-8"
          />
        </div>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">
            {customers === null
              ? "Loading…"
              : `${filtered.length} customers with balance`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customers === null ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-sm text-muted-foreground">
                No active credit balances found.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((c) => (
                <li
                  key={`${c.phone}-${c.name}`}
                  className="flex flex-wrap items-center gap-3 py-4 animate-fade-in"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {c.name || <span className="text-muted-foreground italic">No name</span>}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                      {c.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {c.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right tabular-nums font-medium min-w-[120px]">
                    <div className="text-xs mt-1 space-y-0.5">
                      <div className="flex justify-between gap-3 text-muted-foreground">
                        <span>Total Credit:</span> <span>{formatMoney(c.totalCredit)}</span>
                      </div>
                      <div className="flex justify-between gap-3 text-muted-foreground">
                        <span>Total Paid:</span> <span>{formatMoney(c.totalPaid)}</span>
                      </div>
                      <div className="flex justify-between gap-3 font-semibold text-destructive mt-0.5">
                        <span>Balance:</span> <span>{formatMoney(c.balance)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 w-28">
                    <Button size="sm" variant="outline" onClick={() => loadHistory(c)}>
                      <History className="h-3.5 w-3.5 mr-1" /> History
                    </Button>
                    <Button size="sm" variant="default" onClick={() => setPaymentCustomer(c)}>
                      Receive Pay
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={!!paymentCustomer} onOpenChange={(v) => !v && setPaymentCustomer(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Receive Payment</DialogTitle>
            <DialogDescription>
              Record a payment for {paymentCustomer?.name || paymentCustomer?.phone}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePay} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="pl-7"
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={paymentMethod === "cash" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setPaymentMethod("cash")}
                >
                  Cash
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === "online" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setPaymentMethod("online")}
                >
                  Online
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setPaymentCustomer(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingPayment}>
                {submittingPayment ? "Saving..." : "Save Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyCustomer} onOpenChange={(v) => !v && setHistoryCustomer(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Credit History</DialogTitle>
            <DialogDescription>
              {historyCustomer?.name || historyCustomer?.phone}
            </DialogDescription>
          </DialogHeader>
          
          {!history ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No history found.
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell>{formatDate(h.created_at)}</TableCell>
                      <TableCell>
                        {h.type === 'bill' ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/10">Credit Bill</Badge>
                            <span className="text-xs text-muted-foreground">{h.number}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-emerald-600 border-emerald-600/20 bg-emerald-600/10">Payment</Badge>
                            <span className="text-xs text-muted-foreground capitalize">{h.method}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {h.type === 'bill' ? <span className="text-destructive">-{formatMoney(h.amount)}</span> : <span className="text-emerald-600">+{formatMoney(h.amount)}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
