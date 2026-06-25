import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, IndianRupee, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { billsStore, type Bill } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { TableSkeleton } from "@/components/loading-skeleton";

type Range = "today" | "7d" | "30d" | "quarter" | "year" | "custom" | "all";
type RevenueSearch = { range?: Range; from?: string; to?: string };

export const Route = createFileRoute("/_app/revenue")({
  validateSearch: (search: Record<string, unknown>): RevenueSearch => {
    const valid: Range[] = ["today", "7d", "30d", "quarter", "year", "custom", "all"];
    const r = search.range as string | undefined;
    return {
      range: valid.includes(r as Range) ? (r as Range) : undefined,
      from: typeof search.from === "string" ? search.from : undefined,
      to: typeof search.to === "string" ? search.to : undefined,
    };
  },
  component: RevenuePage,
});

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);
}

function rangeBounds(range: Range, from?: string, to?: string): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  switch (range) {
    case "today":
      // start already today 00:00
      break;
    case "7d":
      start.setDate(start.getDate() - 6);
      break;
    case "30d":
      start.setDate(start.getDate() - 29);
      break;
    case "quarter":
      start.setDate(start.getDate() - 89);
      break;
    case "year":
      start.setDate(start.getDate() - 364);
      break;
    case "custom": {
      const s = from ? new Date(from) : new Date(0);
      const e = to ? new Date(to) : new Date();
      s.setHours(0, 0, 0, 0);
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    case "all":
    default:
      return { start: new Date(0), end };
  }
  return { start, end };
}

function RevenuePage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const range: Range = search.range ?? "30d";

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    billsStore
      .list()
      .then((b) => {
        if (!cancelled) {
          setBills(b);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBills([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { start, end } = useMemo(
    () => rangeBounds(range, search.from, search.to),
    [range, search.from, search.to],
  );

  const filteredBills = useMemo(
    () =>
      bills.filter((b) => {
        const t = new Date(b.createdAt).getTime();
        return t >= start.getTime() && t <= end.getTime();
      }),
    [bills, start, end],
  );

  const stats = useMemo(() => {
    const totalRevenue = filteredBills.reduce((s, b) => s + b.total, 0);
    const totalTax = filteredBills.reduce((s, b) => s + b.tax, 0);
    const avgBill = filteredBills.length ? totalRevenue / filteredBills.length : 0;
    const cost = filteredBills.reduce(
      (s, b) =>
        s + b.items.reduce((is, it) => is + (it.costPrice ?? 0) * it.qty, 0),
      0,
    );
    const profit = filteredBills.reduce((s, b) => s + b.subtotal, 0) - cost;
    const cash = filteredBills
      .filter((b) => b.paymentMethod === "cash")
      .reduce((s, b) => s + b.total, 0);
    const online = filteredBills
      .filter((b) => b.paymentMethod === "online")
      .reduce((s, b) => s + b.total, 0);
    return { totalRevenue, totalTax, avgBill, profit, cash, online };
  }, [filteredBills]);

  // For "today" we'll render an hourly chart instead of daily.
  const isToday = range === "today";

  const dailyData = useMemo(() => {
    if (isToday) {
      const hours: { date: string; label: string; revenue: number; bills: number }[] = [];
      for (let h = 0; h < 24; h++) {
        hours.push({
          date: String(h),
          label: `${String(h).padStart(2, "0")}:00`,
          revenue: 0,
          bills: 0,
        });
      }
      for (const b of filteredBills) {
        const h = new Date(b.createdAt).getHours();
        hours[h].revenue += b.total;
        hours[h].bills += 1;
      }
      return hours;
    }
    const days: { date: string; label: string; revenue: number; bills: number }[] = [];
    const dayMs = 1000 * 60 * 60 * 24;
    const totalDays = Math.min(
      90,
      Math.max(1, Math.ceil((end.getTime() - start.getTime()) / dayMs) + 1),
    );
    const base = new Date(end);
    base.setHours(0, 0, 0, 0);
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({
        date: key,
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        revenue: 0,
        bills: 0,
      });
    }
    const map = new Map(days.map((d) => [d.date, d]));
    for (const b of filteredBills) {
      const key = new Date(b.createdAt).toISOString().slice(0, 10);
      const row = map.get(key);
      if (row) {
        row.revenue += b.total;
        row.bills += 1;
      }
    }
    return days;
  }, [filteredBills, start, end, isToday]);

  // Monthly revenue across the range (last 24 months max)
  const monthlyData = useMemo(() => {
    const months: { key: string; label: string; revenue: number }[] = [];
    const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    const cur = new Date(startMonth);
    while (cur.getTime() <= endMonth.getTime() && months.length < 24) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        key,
        label: cur.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
        revenue: 0,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    const map = new Map(months.map((m) => [m.key, m]));
    for (const b of filteredBills) {
      const d = new Date(b.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const row = map.get(key);
      if (row) row.revenue += b.total;
    }
    return months;
  }, [filteredBills, start, end]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; qty: number }>();
    for (const b of filteredBills) {
      for (const it of b.items) {
        const cur = map.get(it.productId) ?? { name: it.name, revenue: 0, qty: 0 };
        cur.revenue += it.price * it.qty;
        cur.qty += it.qty;
        map.set(it.productId, cur);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredBills]);

  // Modern, cool palette tied into design tokens
  const PIE_COLORS = [
    "var(--color-primary)",
    "#8b5cf6", // violet
    "#06b6d4", // cyan
    "#f59e0b", // amber
    "#ec4899", // pink
  ];

  const setRange = (r: Range) => {
    navigate({
      search: (prev: RevenueSearch) => ({
        ...prev,
        range: r,
        ...(r === "custom" ? {} : { from: undefined, to: undefined }),
      }),
      replace: true,
    });
  };

  const rangeLabel: Record<Range, string> = {
    today: "Today",
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    quarter: "Last 90 days",
    year: "Last 12 months",
    custom: "Custom range",
    all: "All time",
  };

  const tooltipStyle = {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    fontSize: 12,
    color: "var(--color-popover-foreground)",
    boxShadow: "var(--shadow-soft)",
  };

  if (loading && bills.length === 0) return <TableSkeleton cols={4} rows={10} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Revenue analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rangeLabel[range]} ·{" "}
            {start.toLocaleDateString()} – {end.toLocaleDateString()}
          </p>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-4 space-y-4">
          <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="7d">Last 7 days</TabsTrigger>
              <TabsTrigger value="30d">Last 30 days</TabsTrigger>
              <TabsTrigger value="quarter">Last quarter</TabsTrigger>
              <TabsTrigger value="year">Last year</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
              <TabsTrigger value="all">All time</TabsTrigger>
            </TabsList>
          </Tabs>
          {range === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={search.from ?? ""}
                  onChange={(e) =>
                    navigate({
                      search: (prev: RevenueSearch) => ({ ...prev, range: "custom", from: e.target.value }),
                      replace: true,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={search.to ?? ""}
                  onChange={(e) =>
                    navigate({
                      search: (prev: RevenueSearch) => ({ ...prev, range: "custom", to: e.target.value }),
                      replace: true,
                    })
                  }
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total revenue" value={formatMoney(stats.totalRevenue)} icon={IndianRupee} />
        <StatCard label="Estimated profit" value={formatMoney(stats.profit)} icon={Wallet} />
        <StatCard label="Tax collected" value={formatMoney(stats.totalTax)} icon={TrendingUp} />
        <StatCard label="Avg bill value" value={formatMoney(stats.avgBill)} icon={ReceiptText} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="shadow-soft border-l-4 border-l-success">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Cash collection</div>
            <div className="mt-1 text-2xl font-semibold text-success">{formatMoney(stats.cash)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-soft border-l-4 border-l-primary">
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Online collection</div>
            <div className="mt-1 text-2xl font-semibold text-primary">{formatMoney(stats.online)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">
            {isToday ? "Hourly revenue · today" : "Daily revenue"}
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dailyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.5} />
                  <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dailyStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => formatMoney(Number(v))}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="url(#dailyStroke)"
                strokeWidth={2.5}
                fill="url(#dailyGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Monthly revenue</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="monthlyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--color-muted)", opacity: 0.3 }}
                  formatter={(v) => formatMoney(Number(v))}
                />
                <Bar dataKey="revenue" fill="url(#monthlyGrad)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Top 5 products by revenue</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {topProducts.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                No sales in this range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topProducts}
                    dataKey="revenue"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {topProducts.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => formatMoney(Number(v))}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-5">
        <div className="inline-flex h-10 w-10 rounded-xl items-center justify-center bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="mt-4 text-2xl font-semibold">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}
