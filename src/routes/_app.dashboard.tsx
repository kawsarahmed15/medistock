import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Package,
  ReceiptText,
  ShoppingCart,
  AlertTriangle,
  IndianRupee,
  TrendingUp,
} from "lucide-react";
import { productsStore, billsStore, type Product, type Bill } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { DashboardSkeleton } from "@/components/loading-skeleton";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);
}

function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();
  const expiryDays = session?.expiryDays ?? 60;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([productsStore.list(), billsStore.list()])
      .then(([p, b]) => {
        if (cancelled) return;
        setProducts(p);
        setBills(b);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setProducts([]);
        setBills([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Month-to-date: strictly bounded to the current calendar month
  const { monthStart, monthEnd } = useMemo(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    return { monthStart: start, monthEnd: end };
  }, []);

  const billsThisMonth = useMemo(
    () =>
      bills.filter((b) => {
        const t = new Date(b.createdAt).getTime();
        return t >= monthStart && t <= monthEnd;
      }),
    [bills, monthStart, monthEnd],
  );

  const totalSales = billsThisMonth.reduce((s, b) => s + b.total, 0);

  // Stock value = buying price × quantity (fallback to selling price if no cost set)
  const stockValue = products.reduce((s, p) => s + (p.costPrice ?? p.price) * p.stock, 0);

  const lowStock = products.filter((p) => p.stock <= 10);

  const expiringSoon = products
    .filter((p) => {
      const d = new Date(p.expiry).getTime();
      const days = (d - Date.now()) / (1000 * 60 * 60 * 24);
      return days <= expiryDays && days >= 0;
    })
    .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime());

  const expired = products.filter((p) => new Date(p.expiry).getTime() < Date.now());

  // Last 14 days revenue trend for the dashboard graph
  const trendData = useMemo(() => {
    const days: { label: string; key: string; revenue: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        revenue: 0,
      });
    }
    const map = new Map(days.map((d) => [d.key, d]));
    for (const b of bills) {
      const k = new Date(b.createdAt).toISOString().slice(0, 10);
      const row = map.get(k);
      if (row) row.revenue += b.total;
    }
    return days;
  }, [bills]);

  const trendDelta = useMemo(() => {
    const half = Math.floor(trendData.length / 2);
    const first = trendData.slice(0, half).reduce((s, d) => s + d.revenue, 0);
    const second = trendData.slice(half).reduce((s, d) => s + d.revenue, 0);
    if (first === 0) return second > 0 ? 100 : 0;
    return ((second - first) / first) * 100;
  }, [trendData]);

  if (loading) return <DashboardSkeleton />;

  const stats: Array<{
    label: string;
    value: string | number;
    icon: typeof Package;
    tint: string;
    to: string;
    search?: Record<string, string | number>;
  }> = [
    {
      label: "Products",
      value: products.length,
      icon: Package,
      tint: "bg-primary/10 text-primary",
      to: "/inventory",
    },
    {
      label: "Stock value",
      value: formatMoney(stockValue),
      icon: IndianRupee,
      tint: "bg-primary/10 text-primary",
      to: "/inventory",
    },
    {
      label: "Bills this month",
      value: billsThisMonth.length,
      icon: ReceiptText,
      tint: "bg-accent text-accent-foreground",
      to: "/bills",
      search: { range: "month" },
    },
    {
      label: "Revenue this month",
      value: formatMoney(totalSales),
      icon: IndianRupee,
      tint: "bg-success/15 text-success",
      to: "/revenue",
      search: { range: "month" },
    },
    {
      label: "Low stock",
      value: lowStock.length,
      icon: AlertTriangle,
      tint: "bg-warning/20 text-warning-foreground",
      to: "/inventory",
      search: { filter: "low" },
    },
    {
      label: "Expiring soon",
      value: expiringSoon.length,
      icon: AlertTriangle,
      tint: "bg-destructive/10 text-destructive",
      to: "/inventory",
      search: { filter: "expiring" },
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of your pharmacy at a glance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/inventory" search={{ add: 1 }}>
              Add product
            </Link>
          </Button>
          <Button asChild className="shadow-soft">
            <Link to="/sell">
              <ShoppingCart className="h-4 w-4" /> New sale
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((s, i) => (
          <Link key={s.label} to={s.to} search={s.search ?? {}} className="block group">
            <Card
              className="shadow-soft border-border/60 animate-fade-in transition-smooth hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40 cursor-pointer h-full"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <CardContent className="p-5">
                <div
                  className={`inline-flex h-10 w-10 rounded-xl items-center justify-center ${s.tint}`}
                >
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="mt-4 text-2xl font-semibold">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1 group-hover:text-foreground transition-smooth">
                  {s.label}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="shadow-soft animate-fade-in">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Revenue trend</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Last 14 days · see if your sales are trending up or down.
            </p>
          </div>
          <div
            className={
              "inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full " +
              (trendDelta >= 0
                ? "bg-success/15 text-success"
                : "bg-destructive/10 text-destructive")
            }
          >
            <TrendingUp className={"h-3.5 w-3.5 " + (trendDelta < 0 ? "rotate-180" : "")} />
            {trendDelta >= 0 ? "+" : ""}
            {trendDelta.toFixed(1)}%
          </div>
        </CardHeader>
        <CardContent className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--color-popover-foreground)",
                }}
                formatter={(v) => formatMoney(Number(v))}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#rev)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="shadow-soft animate-fade-in">
          <CardHeader>
            <CardTitle className="text-base">Recent bills</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bills.length === 0 ? (
              <EmptyHint label="No bills yet. Make your first sale." to="/sell" cta="Open sell" />
            ) : (
              bills.slice(0, 5).map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-smooth"
                >
                  <div>
                    <div className="font-medium text-sm">{b.number}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(b.createdAt).toLocaleString()} · {b.items.length} items
                    </div>
                  </div>
                  <div className="text-sm font-semibold">{formatMoney(b.total)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Expiring soon</CardTitle>
            <span className="text-xs text-muted-foreground">Next 60 days</span>
          </CardHeader>
          <CardContent className="space-y-2">
            {expired.length === 0 && expiringSoon.length === 0 ? (
              <p className="text-sm text-muted-foreground">No products expiring soon.</p>
            ) : (
              <>
                {expired.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-smooth"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Batch {p.batch ?? "—"} · {p.stock} in stock
                      </div>
                    </div>
                    <span className="text-destructive bg-destructive/10 px-2 py-0.5 rounded-md text-xs font-medium shrink-0">
                      Expired {new Date(p.expiry).toLocaleDateString()}
                    </span>
                  </div>
                ))}
                {expiringSoon.slice(0, 6).map((p) => {
                  const days = Math.max(
                    0,
                    Math.ceil((new Date(p.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
                  );
                  const urgent = days <= 14;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-smooth"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Batch {p.batch ?? "—"} · {p.stock} in stock
                        </div>
                      </div>
                      <span
                        className={
                          urgent
                            ? "text-destructive bg-destructive/10 px-2 py-0.5 rounded-md text-xs font-medium shrink-0"
                            : "text-warning-foreground bg-warning/30 px-2 py-0.5 rounded-md text-xs font-medium shrink-0"
                        }
                      >
                        {days}d · {new Date(p.expiry).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })}
                {lowStock.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-border/60 space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Low stock</div>
                    {lowStock.slice(0, 3).map((p) => (
                      <div key={p.id} className="flex justify-between text-sm">
                        <span className="truncate">{p.name}</span>
                        <span className="text-warning-foreground bg-warning/30 px-2 py-0.5 rounded-md text-xs">
                          {p.stock} left
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyHint({ label, to, cta }: { label: string; to: string; cta: string }) {
  return (
    <div className="text-center py-6 space-y-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Button asChild size="sm">
        <Link to={to}>{cta}</Link>
      </Button>
    </div>
  );
}
