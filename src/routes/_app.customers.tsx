import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Users, Search, Phone, ShoppingCart, ReceiptText, Calendar } from "lucide-react";
import { customersStore, type Customer } from "@/lib/storage";
import { useCart } from "@/lib/cart-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [period, setPeriod] = useState("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  
  const navigate = useNavigate();
  const cart = useCart();

  useEffect(() => {
    let alive = true;
    let from, to;
    const now = new Date();
    
    if (period === "this_month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    } else if (period === "this_year") {
      from = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      to = new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10);
    } else if (period === "custom") {
      if (!customFrom || !customTo) return;
      from = customFrom;
      to = customTo;
    }

    setCustomers(null);
    customersStore
      .list(from, to)
      .then((c) => alive && setCustomers(c))
      .catch((e) => toast.error((e as Error).message || "Failed to load customers"));
    return () => {
      alive = false;
    };
  }, [period, customFrom, customTo]);

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

  const totalSales = useMemo(() => {
    return filtered.reduce((acc, c) => acc + c.totalSpent, 0);
  }, [filtered]);

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
      </div>
      
      <Card className="shadow-soft">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <div className="text-xs font-medium text-muted-foreground">Search</div>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or phone"
                className="pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5 w-full sm:w-48">
            <div className="text-xs font-medium text-muted-foreground">Period</div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
                <SelectItem value="all_time">All Time</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === "custom" && (
            <div className="flex gap-2 items-end w-full sm:w-auto">
              <div className="space-y-1.5 flex-1 sm:w-36">
                <div className="text-xs font-medium text-muted-foreground">From</div>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5 flex-1 sm:w-36">
                <div className="text-xs font-medium text-muted-foreground">To</div>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {customers === null
              ? "Loading…"
              : `${filtered.length} ${filtered.length === 1 ? "customer" : "customers"}`}
          </CardTitle>
          {customers !== null && (
            <div className="text-sm font-medium">
              Total Sale: <span className="text-primary">{formatMoney(totalSales)}</span>
            </div>
          )}
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
                  ? "No customers found for this period."
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
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => useForNextSale(c)}
                    >
                      <ShoppingCart className="h-3.5 w-3.5" /> Use
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
