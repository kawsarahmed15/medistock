import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  IndianRupee,
  ReceiptText,
  TrendingUp,
  Wallet,
  Package,
  AlertTriangle,
  Clock,
  LayoutDashboard,
  BarChart3,
} from "lucide-react";
import { billsStore, customersStore, productsStore, type Bill, type Product } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { ReportsOverviewSkeleton, TableSkeleton } from "@/components/loading-skeleton";
import { cn } from "@/lib/utils";

type Range = "today" | "yesterday" | "7d" | "30d" | "month" | "last_month" | "year" | "custom" | "all";
type RevenueSearch = { range?: Range; from?: string; to?: string };

export const Route = createFileRoute("/_app/revenue")({
  validateSearch: (search: Record<string, unknown>): RevenueSearch => {
    const valid: Range[] = ["today", "yesterday", "7d", "30d", "month", "last_month", "year", "custom", "all"];
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
    case "yesterday":
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      break;
    case "7d":
      start.setDate(start.getDate() - 6);
      break;
    case "30d":
      start.setDate(start.getDate() - 29);
      break;
    case "month":
      start.setDate(1);
      end.setMonth(start.getMonth() + 1, 0); // last day of the month
      end.setHours(23, 59, 59, 999);
      break;
    case "last_month":
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
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
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "financial">("overview");
  const { session } = useAuth();
  const expiryDays = session?.expiryDays ?? 60;
  const lowStockQty = session?.lowStockQty ?? 10;
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const range: Range = search.range ?? "30d";

  const [loading, setLoading] = useState(true);

  const [payments, setPayments] = useState<
    { id?: string; amount: number; method: string; created_at: string; customer_name?: string; customer_phone?: string }[]
  >([]);

  const [detailType, setDetailType] = useState<
    "revenue" | "profit" | "tax" | "cash" | "online" | "credit" | null
  >(null);

  const [monthlyRange, setMonthlyRange] = useState<"6m" | "12m" | "24m">("12m");

  // Keyboard navigation for Reports & Dashboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (inField) return;

      // Tab navigation shortcuts
      if (e.key === "1" || e.key.toLowerCase() === "o") {
        e.preventDefault();
        setActiveTab("overview");
      } else if (e.key === "2" || e.key.toLowerCase() === "f" || e.key.toLowerCase() === "a") {
        e.preventDefault();
        setActiveTab("financial");
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const activeEl = document.activeElement;
        if (activeEl && activeEl.getAttribute("role") === "tab") {
          e.preventDefault();
          const nextTab = activeTab === "overview" ? "financial" : "overview";
          setActiveTab(nextTab);
          const nextId = nextTab === "overview" ? "tab-overview" : "tab-financial";
          document.getElementById(nextId)?.focus();
        }
      } else if (activeTab === "financial") {
        if (e.key.toLowerCase() === "t") {
          e.preventDefault();
          navigate({ search: (prev: RevenueSearch) => ({ ...prev, range: "today" }), replace: true });
        } else if (e.key.toLowerCase() === "y") {
          e.preventDefault();
          navigate({ search: (prev: RevenueSearch) => ({ ...prev, range: "yesterday" }), replace: true });
        } else if (e.key.toLowerCase() === "w") {
          e.preventDefault();
          navigate({ search: (prev: RevenueSearch) => ({ ...prev, range: "7d" }), replace: true });
        } else if (e.key.toLowerCase() === "m") {
          e.preventDefault();
          navigate({ search: (prev: RevenueSearch) => ({ ...prev, range: "30d" }), replace: true });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, navigate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([billsStore.list(), customersStore.getAllPayments(), productsStore.list()])
      .then(([b, p, prod]) => {
        if (!cancelled) {
          setBills(b);
          setPayments(p);
          setProducts(prod);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBills([]);
          setPayments([]);
          setProducts([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const completedBills = useMemo(
    () => bills.filter((b) => b.status === "completed" || !b.status),
    [bills],
  );
  const pendingBills = useMemo(() => bills.filter((b) => b.status === "pending"), [bills]);

  // Month-to-date: strictly bounded to the current calendar month
  const { monthStart, monthEnd } = useMemo(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    return { monthStart: start, monthEnd: end };
  }, []);

  const billsThisMonth = useMemo(
    () =>
      completedBills.filter((b) => {
        const t = new Date(b.createdAt).getTime();
        return t >= monthStart && t <= monthEnd;
      }),
    [completedBills, monthStart, monthEnd],
  );

  const totalSalesThisMonth = useMemo(
    () => billsThisMonth.reduce((s, b) => s + b.total, 0),
    [billsThisMonth],
  );

  // Stock value = sum of rounded (batch purchase price × batch quantity) across all batches
  const stockValue = useMemo(() => {
    return products.reduce((total, p) => {
      if (p.batches && p.batches.length > 0) {
        return (
          total +
          p.batches.reduce(
            (bSum, b) =>
              bSum + Math.round((b.costPrice ?? b.price ?? 0) * (b.stock || 0) * 100) / 100,
            0,
          )
        );
      }
      return total + Math.round((p.costPrice ?? p.price ?? 0) * (p.stock || 0) * 100) / 100;
    }, 0);
  }, [products]);

  const lowStock = useMemo(
    () => products.filter((p) => p.stock <= lowStockQty),
    [products, lowStockQty],
  );

  const expiringSoon = useMemo(
    () =>
      products
        .filter((p) => {
          const d = new Date(p.expiry).getTime();
          const days = (d - Date.now()) / (1000 * 60 * 60 * 24);
          return days <= expiryDays && days >= 0;
        })
        .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime()),
    [products, expiryDays],
  );

  const expired = useMemo(
    () => products.filter((p) => new Date(p.expiry).getTime() < Date.now()),
    [products],
  );

  // Last 14 days revenue trend for the dashboard graph
  const trendData = useMemo(() => {
    const days: { label: string; key: string; revenue: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      days.push({
        key: `${year}-${month}-${day}`,
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        revenue: 0,
      });
    }
    const map = new Map(days.map((d) => [d.key, d]));
    for (const b of completedBills) {
      const d = new Date(b.createdAt);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const k = `${year}-${month}-${day}`;
      const row = map.get(k);
      if (row) row.revenue += b.total;
    }
    return days;
  }, [completedBills]);

  const trendDelta = useMemo(() => {
    const half = Math.floor(trendData.length / 2);
    const first = trendData.slice(0, half).reduce((s, d) => s + d.revenue, 0);
    const second = trendData.slice(half).reduce((s, d) => s + d.revenue, 0);
    if (first === 0) return second > 0 ? 100 : 0;
    return ((second - first) / first) * 100;
  }, [trendData]);

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

  const filteredPayments = useMemo(
    () =>
      payments.filter((p) => {
        const t = new Date(p.created_at).getTime();
        return t >= start.getTime() && t <= end.getTime();
      }),
    [payments, start, end],
  );

  const stats = useMemo(() => {
    // Total Revenue = Sum of subtotals minus discounts (taxable revenue)
    const totalRevenue = filteredBills.reduce((s, b) => s + ((b.subtotal || 0) - (b.discount || 0)), 0);
    const totalTax = filteredBills.reduce((s, b) => s + (b.tax || 0), 0);
    const avgBill = filteredBills.length ? totalRevenue / filteredBills.length : 0;

    // Cost must include free quantities given away
    const cost = filteredBills.reduce(
      (s, b) =>
        s + b.items.reduce((is, it) => is + (it.costPrice ?? 0) * (it.qty + (it.freeQty || 0)), 0),
      0,
    );
    const profit = totalRevenue - cost;

    const cash =
      filteredBills.reduce(
        (s, b) =>
          s +
          (b.paymentMethod === "cash"
            ? b.total || 0
            : b.paymentMethod === "credit" && b.advancePaymentMethod !== "online"
              ? b.advanceAmount || 0
              : 0),
        0,
      ) +
      filteredPayments.reduce((s, p) => s + (p.method === "cash" ? Number(p.amount) || 0 : 0), 0);

    const online =
      filteredBills.reduce(
        (s, b) =>
          s +
          (b.paymentMethod === "online"
            ? b.total || 0
            : b.paymentMethod === "credit" && b.advancePaymentMethod === "online"
              ? b.advanceAmount || 0
              : 0),
        0,
      ) +
      filteredPayments.reduce((s, p) => s + (p.method === "online" ? Number(p.amount) || 0 : 0), 0);

    const pendingCredit =
      filteredBills.reduce(
        (s, b) => s + (b.paymentMethod === "credit" ? (b.total || 0) - (b.advanceAmount || 0) : 0),
        0,
      ) - filteredPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    return { totalRevenue, totalTax, avgBill, profit, cash, online, pendingCredit };
  }, [filteredBills, filteredPayments]);

  const detailData = useMemo(() => {
    if (!detailType) return [];
    if (detailType === "revenue") {
      return filteredBills.map((b) => ({
        id: b.id,
        number: b.number,
        name: b.customerName || "Walk-in Customer",
        date: new Date(b.createdAt).toLocaleDateString(),
        amount: (b.subtotal || 0) - (b.discount || 0),
        detail: `Subtotal: ${formatMoney(b.subtotal || 0)} - Disc: ${formatMoney(b.discount || 0)}`,
      }));
    }
    if (detailType === "profit") {
      return filteredBills.map((b) => {
        const rev = (b.subtotal || 0) - (b.discount || 0);
        const cost = b.items.reduce((s, it) => s + (it.costPrice ?? 0) * (it.qty + (it.freeQty || 0)), 0);
        const profit = rev - cost;
        return {
          id: b.id,
          number: b.number,
          name: b.customerName || "Walk-in Customer",
          date: new Date(b.createdAt).toLocaleDateString(),
          amount: profit,
          detail: `Revenue: ${formatMoney(rev)} - Cost: ${formatMoney(cost)}`,
        };
      });
    }
    if (detailType === "tax") {
      return filteredBills.filter(b => (b.tax || 0) > 0).map((b) => ({
        id: b.id,
        number: b.number,
        name: b.customerName || "Walk-in Customer",
        date: new Date(b.createdAt).toLocaleDateString(),
        amount: b.tax || 0,
        detail: `Taxable: ${formatMoney(b.subtotal || 0)}`,
      }));
    }
    if (detailType === "cash") {
      const items: any[] = [];
      filteredBills.forEach((b) => {
        if (b.paymentMethod === "cash") {
          items.push({
            id: b.id,
            number: b.number,
            name: b.customerName || "Walk-in Customer",
            date: new Date(b.createdAt).toLocaleDateString(),
            amount: b.total || 0,
            detail: "Cash Sale",
          });
        } else if (b.paymentMethod === "credit" && b.advancePaymentMethod !== "online" && b.advanceAmount > 0) {
          items.push({
            id: b.id,
            number: b.number,
            name: b.customerName || "Walk-in Customer",
            date: new Date(b.createdAt).toLocaleDateString(),
            amount: b.advanceAmount,
            detail: "Advance (Cash)",
          });
        }
      });
      filteredPayments.forEach((p) => {
        if (p.method === "cash") {
          items.push({
            id: p.id || Math.random().toString(),
            number: "PAYMENT",
            name: p.customer_name || "Customer",
            date: new Date(p.created_at).toLocaleDateString(),
            amount: p.amount,
            detail: "Customer Payment (Cash)",
          });
        }
      });
      return items;
    }
    if (detailType === "online") {
      const items: any[] = [];
      filteredBills.forEach((b) => {
        if (b.paymentMethod === "online") {
          items.push({
            id: b.id,
            number: b.number,
            name: b.customerName || "Walk-in Customer",
            date: new Date(b.createdAt).toLocaleDateString(),
            amount: b.total || 0,
            detail: "Online Sale",
          });
        } else if (b.paymentMethod === "credit" && b.advancePaymentMethod === "online" && b.advanceAmount > 0) {
          items.push({
            id: b.id,
            number: b.number,
            name: b.customerName || "Walk-in Customer",
            date: new Date(b.createdAt).toLocaleDateString(),
            amount: b.advanceAmount,
            detail: "Advance (Online)",
          });
        }
      });
      filteredPayments.forEach((p) => {
        if (p.method === "online") {
          items.push({
            id: p.id || Math.random().toString(),
            number: "PAYMENT",
            name: p.customer_name || "Customer",
            date: new Date(p.created_at).toLocaleDateString(),
            amount: p.amount,
            detail: "Customer Payment (Online)",
          });
        }
      });
      return items;
    }
    if (detailType === "credit") {
      const customerMap = new Map<string, { name: string; amount: number }>();
      filteredBills.forEach((b) => {
        if (b.paymentMethod === "credit") {
          const name = b.customerName || "Walk-in Customer";
          const phone = b.customerPhone || "";
          const key = phone || name.toLowerCase();
          const existing = customerMap.get(key) || { name, amount: 0 };
          existing.amount += (b.total || 0) - (b.advanceAmount || 0);
          customerMap.set(key, existing);
        }
      });
      filteredPayments.forEach((p) => {
        const name = p.customer_name || "Customer";
        const phone = p.customer_phone || "";
        const key = phone || name.toLowerCase();
        const existing = customerMap.get(key) || { name, amount: 0 };
        existing.amount -= p.amount || 0;
        customerMap.set(key, existing);
      });
      return Array.from(customerMap.values())
        .filter((c) => Math.abs(c.amount) > 0.01)
        .map((c) => ({
          id: c.name,
          number: "CREDIT",
          name: c.name,
          date: "-",
          amount: c.amount,
          detail: "Remaining Credit Balance",
        }));
    }
    return [];
  }, [detailType, filteredBills, filteredPayments]);

  // For "today" or "yesterday" we'll render an hourly chart instead of daily.
  const isHourly = range === "today" || range === "yesterday";

  const dailyData = useMemo(() => {
    if (isHourly) {
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
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const key = `${year}-${month}-${day}`;
      days.push({
        date: key,
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        revenue: 0,
        bills: 0,
      });
    }
    const map = new Map(days.map((d) => [d.date, d]));
    for (const b of filteredBills) {
      const d = new Date(b.createdAt);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const key = `${year}-${month}-${day}`;
      const row = map.get(key);
      if (row) {
        row.revenue += b.total;
        row.bills += 1;
      }
    }
    return days;
  }, [filteredBills, start, end, isHourly]);

  // Monthly revenue across multiple months (6, 12, or 24 months ending at current month)
  const monthlyData = useMemo(() => {
    const monthsCount = monthlyRange === "6m" ? 6 : monthlyRange === "24m" ? 24 : 12;
    const months: { key: string; label: string; revenue: number }[] = [];
    const endDate = new Date();
    const currentYear = endDate.getFullYear();
    const currentMonth = endDate.getMonth();

    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        key,
        label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
        revenue: 0,
      });
    }

    const map = new Map(months.map((m) => [m.key, m]));
    for (const b of bills) {
      const d = new Date(b.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const row = map.get(key);
      if (row) row.revenue += b.total;
    }
    return months;
  }, [bills, monthlyRange]);

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
    yesterday: "Yesterday",
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    month: "This month",
    last_month: "Last month",
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

  const overviewStats: Array<{
    label: string;
    value: string | number;
    icon: any;
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
      value: formatMoney(totalSalesThisMonth),
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

  if (loading && bills.length === 0 && products.length === 0) {
    return activeTab === "overview" ? <ReportsOverviewSkeleton /> : <TableSkeleton cols={4} rows={10} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-1 -ml-2 h-7 text-xs text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.state?.__TSR_index > 0) {
                window.history.back();
              } else {
                navigate({ to: "/dashboard" });
              }
            }}
            title="Back to menu (Esc)"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to menu (Esc)
          </Button>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Reports & Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeTab === "overview"
              ? "Complete overview of pharmacy operations, inventory, stock value, and recent sales."
              : `${rangeLabel[range]} · ${start.toLocaleDateString()} – ${end.toLocaleDateString()}`}
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Reports & Dashboard views"
            className="bg-muted p-1 rounded-lg border border-border flex items-center gap-1 shadow-2xs"
          >
            <button
              type="button"
              role="tab"
              id="tab-overview"
              aria-selected={activeTab === "overview"}
              aria-controls="panel-overview"
              tabIndex={0}
              onClick={() => setActiveTab("overview")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activeTab === "overview"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50",
              )}
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
              <span>Dashboard Overview</span>
              <kbd className="hidden sm:inline-block font-mono text-[9px] px-1 py-0.2 rounded bg-muted/80 text-muted-foreground border border-border">
                1
              </kbd>
            </button>
            <button
              type="button"
              role="tab"
              id="tab-financial"
              aria-selected={activeTab === "financial"}
              aria-controls="panel-financial"
              tabIndex={0}
              onClick={() => setActiveTab("financial")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activeTab === "financial"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50",
              )}
            >
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              <span>Financial Analytics</span>
              <kbd className="hidden sm:inline-block font-mono text-[9px] px-1 py-0.2 rounded bg-muted/80 text-muted-foreground border border-border">
                2
              </kbd>
            </button>
          </div>
        </div>
      </div>

      {/* ─── TAB 1: PREVIOUS DASHBOARD OVERVIEW ─── */}
      {activeTab === "overview" ? (
        <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" className="space-y-4 sm:space-y-5 animate-in fade-in-0 duration-150">
          {pendingBills.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 shadow-soft">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <Clock className="h-4 w-4 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold">
                    {pendingBills.length} Employee Bill{pendingBills.length === 1 ? "" : "s"} Awaiting Approval
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Staff submitted sales invoices that require your review and confirmation before stock is deducted.
                  </p>
                </div>
              </div>
              <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 shadow-xs h-7 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <Link to="/bills" search={{ status: "pending" }}>
                  Review & Approve Bills →
                </Link>
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
            {overviewStats.map((s, i) => (
              <Link
                key={s.label}
                to={s.to}
                search={s.search ?? {}}
                className="block group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Card
                  className="shadow-soft border-border/60 animate-fade-in transition-smooth hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40 cursor-pointer h-full"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <CardContent className="p-3.5">
                    <div
                      className={`inline-flex h-9 w-9 rounded-lg items-center justify-center ${s.tint}`}
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
                    <linearGradient id="revOverview" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" stroke="var(--color-muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
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
                    fill="url(#revOverview)"
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
                  <EmptyHint label="No bills yet. Make your first sale." to="/cart" cta="New sale" />
                ) : (
                  bills.slice(0, 5).map((b) => (
                    <Link
                      key={b.id}
                      to="/bills/$id"
                      params={{ id: b.id }}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-smooth group cursor-pointer block"
                    >
                      <div>
                        <div className="font-medium text-sm group-hover:text-primary transition-colors">{b.number}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(b.createdAt).toLocaleString()} · {b.items.length} items
                        </div>
                      </div>
                      <div className="text-sm font-semibold">{formatMoney(b.total)}</div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="shadow-soft animate-fade-in">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Expiring soon</CardTitle>
                <span className="text-xs text-muted-foreground">Next {expiryDays} days</span>
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
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* ─── TAB 2: FINANCIAL & TAX ANALYTICS ─── */
        <div role="tabpanel" id="panel-financial" aria-labelledby="tab-financial" className="space-y-6 animate-in fade-in-0 duration-150">

      <Card className="shadow-soft">
        <CardContent className="p-4 space-y-4">
          <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="yesterday">Yesterday</TabsTrigger>
              <TabsTrigger value="7d">Last 7 days</TabsTrigger>
              <TabsTrigger value="30d">Last 30 days</TabsTrigger>
              <TabsTrigger value="month">This month</TabsTrigger>
              <TabsTrigger value="last_month">Last month</TabsTrigger>
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
                      search: (prev: RevenueSearch) => ({
                        ...prev,
                        range: "custom",
                        from: e.target.value,
                      }),
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
                      search: (prev: RevenueSearch) => ({
                        ...prev,
                        range: "custom",
                        to: e.target.value,
                      }),
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
        <StatCard
          label="Total revenue"
          value={formatMoney(stats.totalRevenue)}
          icon={IndianRupee}
          onClick={() => setDetailType("revenue")}
        />
        <StatCard
          label="Estimated profit"
          value={formatMoney(stats.profit)}
          icon={Wallet}
          onClick={() => setDetailType("profit")}
        />
        <StatCard
          label="Tax collected"
          value={formatMoney(stats.totalTax)}
          icon={TrendingUp}
          onClick={() => setDetailType("tax")}
        />
        <StatCard label="Avg bill value" value={formatMoney(stats.avgBill)} icon={ReceiptText} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card 
          className="shadow-soft border-l-4 border-l-success cursor-pointer hover:bg-accent/40 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          tabIndex={0}
          role="button"
          aria-label={`Cash collection: ${formatMoney(stats.cash)}. Press Enter to view details.`}
          onClick={() => setDetailType("cash")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setDetailType("cash");
            }
          }}
        >
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Cash collection
            </div>
            <div className="mt-1 text-2xl font-semibold text-success">
              {formatMoney(stats.cash)}
            </div>
          </CardContent>
        </Card>
        <Card 
          className="shadow-soft border-l-4 border-l-primary cursor-pointer hover:bg-accent/40 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          tabIndex={0}
          role="button"
          aria-label={`Online collection: ${formatMoney(stats.online)}. Press Enter to view details.`}
          onClick={() => setDetailType("online")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setDetailType("online");
            }
          }}
        >
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Online collection
            </div>
            <div className="mt-1 text-2xl font-semibold text-primary">
              {formatMoney(stats.online)}
            </div>
          </CardContent>
        </Card>
        <Card 
          className="shadow-soft border-l-4 border-l-amber-500 cursor-pointer hover:bg-accent/40 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          tabIndex={0}
          role="button"
          aria-label={`Pending credit: ${formatMoney(stats.pendingCredit)}. Press Enter to view details.`}
          onClick={() => setDetailType("credit")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setDetailType("credit");
            }
          }}
        >
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Pending credit
            </div>
            <div className="mt-1 text-2xl font-semibold text-amber-500">
              {formatMoney(stats.pendingCredit)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">
            {range === "today" ? "Hourly revenue · today" : range === "yesterday" ? "Hourly revenue · yesterday" : "Daily revenue"}
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
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatMoney(Number(v))} />
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Monthly revenue</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Revenue comparison across months
              </p>
            </div>
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border text-xs">
              <button
                type="button"
                onClick={() => setMonthlyRange("6m")}
                className={`px-2 py-1 rounded-md font-medium transition-colors ${
                  monthlyRange === "6m"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                6M
              </button>
              <button
                type="button"
                onClick={() => setMonthlyRange("12m")}
                className={`px-2 py-1 rounded-md font-medium transition-colors ${
                  monthlyRange === "12m"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                12M
              </button>
              <button
                type="button"
                onClick={() => setMonthlyRange("24m")}
                className={`px-2 py-1 rounded-md font-medium transition-colors ${
                  monthlyRange === "24m"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                24M
              </button>
            </div>
          </CardHeader>
          <CardContent className="h-72 pt-2">
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
                  interval={0}
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
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatMoney(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!detailType} onOpenChange={(v) => !v && setDetailType(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">{detailType} Details</DialogTitle>
            <DialogDescription>
              Detailed breakdown of contributing entries.
            </DialogDescription>
          </DialogHeader>

          {detailType === "credit" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer/Clinic</TableHead>
                  <TableHead className="text-right">Credit Left</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailData.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-right font-bold text-destructive tabular-nums">
                      {formatMoney(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                {detailData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                      No outstanding credit.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Bill / Ref</TableHead>
                  <TableHead>Customer/Clinic</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailData.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{item.date}</TableCell>
                    <TableCell className="font-mono text-xs">{item.number}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.detail}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                {detailData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No transactions found in this period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
        </div>
      )}
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

function StatCard({
  label,
  value,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}) {
  return (
    <Card 
      className={cn(
        "shadow-soft transition-colors",
        onClick && "cursor-pointer hover:bg-accent/40 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
      )}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? "button" : undefined}
      aria-label={onClick ? `${label}: ${value}. Press Enter to view details.` : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
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
