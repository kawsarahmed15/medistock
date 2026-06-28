import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Users, Search, Phone, ShoppingCart, ReceiptText } from "lucide-react";
import { customersStore, type Customer } from "@/lib/storage";
import { useCart } from "@/lib/cart-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/customers")({
  component: CustomersPage,
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

function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const cart = useCart();

  useEffect(() => {
    let alive = true;
    customersStore
      .list()
      .then((c) => alive && setCustomers(c))
      .catch((e) => toast.error((e as Error).message || "Failed to load customers"));
    return () => {
      alive = false;
    };
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

  const useForNextSale = (c: Customer) => {
    cart.setCustomer({
      name: c.name,
      phone: c.phone,
      address: c.address ?? "",
      notes: c.notes ?? "",
      prescriptionRef: "",
      prescriptionPhoto: "",
    });
    cart.setCustomerSubmitted(true);
    toast.success(`Selected ${c.name || c.phone} for next sale`);
    navigate({ to: "/sell" });
  };

  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");
  const [submittingPayment, setSubmittingPayment] = useState(false);

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
      // Reload customers
      const updated = await customersStore.list();
      setCustomers(updated);
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Customers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-saved from your past bills. Pick one to pre-fill the next sale.
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
              : `${filtered.length} ${filtered.length === 1 ? "customer" : "customers"}`}
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
                {customers.length === 0
                  ? "No customers yet — they'll appear here after you generate bills with customer details."
                  : "No matches for your search."}
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((c) => (
                <li
                  key={`${c.phone}-${c.name}`}
                  className="flex flex-wrap items-center gap-3 py-3 animate-fade-in"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {c.name || (
                        <span className="text-muted-foreground italic">No name</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                      {c.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {c.phone}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <ReceiptText className="h-3 w-3" /> {c.visits}{" "}
                        {c.visits === 1 ? "visit" : "visits"}
                      </span>
                      <span>· Last {formatDate(c.lastVisit)}</span>
                    </div>
                  </div>
                  <div className="text-right tabular-nums font-medium min-w-[120px]">
                    <div className="text-sm">Total: {formatMoney(c.totalSpent)}</div>
                    {c.totalCredit > 0 && (
                      <div className="text-xs mt-1 space-y-0.5">
                        <div className="flex justify-between gap-3 text-muted-foreground">
                          <span>Credit:</span> <span>{formatMoney(c.totalCredit)}</span>
                        </div>
                        <div className="flex justify-between gap-3 text-muted-foreground">
                          <span>Paid:</span> <span>{formatMoney(c.totalPaid)}</span>
                        </div>
                        <div className="flex justify-between gap-3 font-semibold text-destructive mt-0.5">
                          <span>Balance:</span> <span>{formatMoney(c.balance)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => useForNextSale(c)}
                    >
                      <ShoppingCart className="h-3.5 w-3.5" /> Use
                    </Button>
                    {c.balance > 0 && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => setPaymentCustomer(c)}
                      >
                        Receive Pay
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
