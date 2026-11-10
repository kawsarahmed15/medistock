import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import {
  Package,
  ReceiptText,
  ShoppingCart,
  ShoppingBag,
  AlertTriangle,
  IndianRupee,
  TrendingUp,
  Clock,
  Truck,
  Users,
  CreditCard,
  BookOpen,
  Settings,
  UserCheck,
  RotateCw,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { productsStore, billsStore, type Product, type Bill } from "@/lib/storage";
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
  const [hideAmounts, setHideAmounts] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const { session } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();

  const expiryDays = session?.expiryDays ?? 60;
  const lowStockQty = session?.lowStockQty ?? 10;
  const isEmployee = Boolean(session?.isEmployee);

  const loadData = () => {
    setLoading(true);
    Promise.all([productsStore.list(), billsStore.list()])
      .then(([p, b]) => {
        setProducts(p);
        setBills(b);
        setLoading(false);
      })
      .catch(() => {
        setProducts([]);
        setBills([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const completedBills = useMemo(
    () => bills.filter((b) => b.status === "completed" || !b.status),
    [bills],
  );
  const pendingBills = useMemo(() => bills.filter((b) => b.status === "pending"), [bills]);

  // Today's range: midnight today to 23:59:59.999 today
  const todayBills = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const todayEnd = todayStart + 86400000;
    return completedBills.filter((b) => {
      const t = new Date(b.createdAt).getTime();
      return t >= todayStart && t < todayEnd;
    });
  }, [completedBills]);

  const todaySalesTotal = useMemo(
    () => todayBills.reduce((sum, b) => sum + (b.total || 0), 0),
    [todayBills],
  );

  const todayCashTotal = useMemo(
    () =>
      todayBills
        .filter((b) => b.paymentMethod === "cash" || !b.paymentMethod)
        .reduce((sum, b) => sum + (b.total || 0), 0),
    [todayBills],
  );

  const todayUpiTotal = useMemo(
    () =>
      todayBills
        .filter((b) => b.paymentMethod === "upi")
        .reduce((sum, b) => sum + (b.total || 0), 0),
    [todayBills],
  );

  const avgBillValue = todayBills.length > 0 ? Math.round(todaySalesTotal / todayBills.length) : 0;

  const lowStock = useMemo(
    () => products.filter((p) => (p.stock || 0) <= lowStockQty),
    [products, lowStockQty],
  );

  const expiringSoon = useMemo(() => {
    return products
      .filter((p) => {
        if (!p.expiry) return false;
        const d = new Date(p.expiry).getTime();
        const days = (d - Date.now()) / (1000 * 60 * 60 * 24);
        return days <= expiryDays && days >= 0;
      })
      .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime());
  }, [products, expiryDays]);

  const expired = useMemo(() => {
    return products.filter((p) => p.expiry && new Date(p.expiry).getTime() < Date.now());
  }, [products]);

  // Reference groups & menu items matching https://medistock.docslot.in/#/
  const menuGroups = useMemo(() => {
    if (isEmployee) {
      return [
        {
          key: "BILLING",
          label: "Billing",
          items: [
            {
              num: "1",
              hotkey: "S",
              title: "Sale",
              path: "/cart",
              desc: "Counter billing, patient khata, barcode search",
              icon: ShoppingBag,
              iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
              badge: count > 0 ? `${count} in Cart` : undefined,
            },
            {
              num: "2",
              hotkey: "N",
              title: "New Sale",
              path: "/new-sale",
              desc: "Start fresh patient sale or prescription entry",
              icon: ShoppingCart,
              iconBg:
                "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
            },
          ],
        },
        {
          key: "BOOKS_ACCOUNTS",
          label: "Books & Accounts",
          items: [
            {
              num: "4",
              hotkey: "B",
              title: "Sale Book",
              path: "/bills",
              desc: "My submitted bills and approval status",
              icon: ReceiptText,
              iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
            },
          ],
        },
        {
          key: "STOCK_SETUP",
          label: "Stock & Setup",
          items: [
            {
              num: "8",
              hotkey: "I",
              title: "Inventory",
              path: "/inventory",
              desc: "Stock, batches, expiry and prices",
              icon: Package,
              iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
              badge: `${products.length} Items`,
            },
          ],
        },
      ];
    }

    return [
      {
        key: "BILLING",
        label: "Billing",
        items: [
          {
            num: "1",
            hotkey: "S",
            title: "Sale",
            path: "/cart",
            desc: "Counter billing, patient khata, barcode search",
            icon: ShoppingBag,
            iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
            badge: count > 0 ? `${count} in Cart` : undefined,
          },
          {
            num: "2",
            hotkey: "P",
            title: "Purchase Bill",
            path: "/purchases/new",
            desc: "Supplier invoice with batch and expiry",
            icon: Truck,
            iconBg:
              "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          },
          {
            num: "3",
            hotkey: "C",
            title: "Purchases",
            path: "/purchases",
            desc: "Goods receipt note and purchase bills",
            icon: Package,
            iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          },
        ],
      },
      {
        key: "BOOKS_ACCOUNTS",
        label: "Books & Accounts",
        items: [
          {
            num: "4",
            hotkey: "B",
            title: "Sale Book",
            path: "/bills",
            desc: "Sales register, invoices and receipts",
            icon: ReceiptText,
            iconBg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
            badge: pendingBills.length > 0 ? `${pendingBills.length} pending` : undefined,
          },
          {
            num: "5",
            hotkey: "K",
            title: "Credit Sales",
            path: "/credit",
            desc: "Customer dues, khata ledger and settlements",
            icon: CreditCard,
            iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
          },
          {
            num: "6",
            hotkey: "L",
            title: "Ledger",
            path: "/ledger",
            desc: "Customer khata and supplier statements",
            icon: BookOpen,
            iconBg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
          },
          {
            num: "7",
            hotkey: "R",
            title: "Reports",
            path: "/revenue",
            desc: "Schedule H1 register, sales and profit",
            icon: TrendingUp,
            iconBg: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
          },
          {
            num: "U",
            hotkey: "U",
            title: "Customers",
            path: "/customers",
            desc: "Patient directory and outstanding balances",
            icon: Users,
            iconBg: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
          },
        ],
      },
      {
        key: "STOCK_SETUP",
        label: "Stock & Setup",
        items: [
          {
            num: "8",
            hotkey: "I",
            title: "Inventory",
            path: "/inventory",
            desc: "Stock, batches, expiry and reorder levels",
            icon: Package,
            iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
            badge: lowStock.length > 0 ? `${lowStock.length} low` : undefined,
          },
          {
            num: "M",
            hotkey: "M",
            title: "Employees",
            path: "/employees",
            desc: "Staff accounts, cashier mode and permissions",
            icon: UserCheck,
            iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
          },
          {
            num: "0",
            hotkey: "T",
            title: "Settings",
            path: "/settings",
            desc: "Printer, store profile, GSTIN and backup",
            icon: Settings,
            iconBg: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
          },
        ],
      },
    ];
  }, [isEmployee, count, products.length, pendingBills.length, lowStock.length]);

  const flatItems = useMemo(() => menuGroups.flatMap((g) => g.items), [menuGroups]);
  const activeItem = flatItems[selectedIdx] || flatItems[0];

  // Hotkey navigation matching reference
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "F5") {
        e.preventDefault();
        loadData();
        return;
      }

      // Hotkey by Number (1-9, 0)
      const matchNum = flatItems.find((item) => item.num === e.key);
      if (matchNum) {
        e.preventDefault();
        navigate({ to: matchNum.path });
        return;
      }

      // Hotkey by Letter (S, P, C, B, K, L, R, U, I, M, T)
      if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
        const keyUpper = e.key.toUpperCase();
        const matchHotkey = flatItems.find((item) => item.hotkey.toUpperCase() === keyUpper);
        if (matchHotkey) {
          e.preventDefault();
          navigate({ to: matchHotkey.path });
          return;
        }
      }

      // Arrow navigation
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedIdx((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedIdx((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setSelectedIdx(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setSelectedIdx(flatItems.length - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatItems[selectedIdx];
        if (item) navigate({ to: item.path });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flatItems, selectedIdx, navigate]);

  const hasIssues = lowStock.length > 0 || expiringSoon.length > 0 || pendingBills.length > 0;

  if (loading && products.length === 0 && bills.length === 0) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="-m-2 sm:-m-3 h-[calc(100vh-44px)] flex flex-col justify-between overflow-hidden bg-gradient-soft select-none animate-fade-in">
      {/* ── Main Content Area ── */}
      <main className="flex-1 overflow-hidden px-4 sm:px-6 py-3 flex flex-col lg:flex-row gap-5 items-stretch min-h-0">
        {/* Left Section: Menu Cards Grid (58-60% width) */}
        <section className="w-full lg:w-[58%] xl:w-[60%] flex flex-col justify-between overflow-y-auto no-scrollbar pr-1">
          <div className="space-y-3.5">
            {menuGroups.map((group) => {
              const items = group.items;
              if (items.length === 0) return null;

              return (
                <div key={group.key} className="space-y-1.5">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                    {group.label}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {items.map((item) => {
                      const itemIdx = flatItems.findIndex((x) => x.path === item.path);
                      const isSelected = itemIdx === selectedIdx;
                      const Icon = item.icon;

                      return (
                        <div
                          key={item.path}
                          tabIndex={0}
                          role="button"
                          aria-label={`${item.title}, hotkey ${item.hotkey}`}
                          onClick={() => {
                            setSelectedIdx(itemIdx);
                            navigate({ to: item.path });
                          }}
                          onMouseEnter={() => setSelectedIdx(itemIdx)}
                          className={`min-h-[58px] rounded-xl p-2.5 sm:p-3 border transition-smooth cursor-pointer flex items-center justify-between text-left outline-none ${
                            isSelected
                              ? "border-primary bg-primary/10 shadow-soft ring-2 ring-primary/25"
                              : "border-border/70 bg-card/75 backdrop-blur-xs hover:border-primary/50 hover:bg-card/95 hover:shadow-soft shadow-xs"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border transition-transform duration-200 ${
                                isSelected ? "scale-105 shadow-xs" : ""
                              } ${item.iconBg || "bg-muted text-muted-foreground border-border"}`}
                            >
                              <Icon className="w-4.5 h-4.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-bold text-sm leading-tight transition-colors ${
                                    isSelected ? "text-primary" : "text-foreground"
                                  }`}
                                >
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 shrink-0">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-1">
                                {item.desc}
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 pl-1">
                            <kbd
                              className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded font-mono font-bold text-xs border transition-colors ${
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                  : "bg-muted/80 text-foreground border-border/80"
                              }`}
                            >
                              {item.hotkey}
                            </kbd>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Item Description bar */}
          {activeItem && (
            <div className="mt-3 py-2 px-3.5 rounded-xl bg-card/80 backdrop-blur-xs border border-border/80 shadow-soft flex items-center gap-2 text-xs text-muted-foreground shrink-0">
              <span className="font-bold text-primary">{activeItem.title}:</span>
              <span className="text-foreground truncate">{activeItem.desc}</span>
            </div>
          )}
        </section>

        {/* Right Section: Today & Needs Attention panels (40-42% width) */}
        <section className="hidden lg:flex w-[42%] xl:w-[40%] min-w-[340px] flex-col gap-3 justify-between overflow-y-auto no-scrollbar">
          {/* ── Today Card (QN) ── */}
          <div className="rounded-2xl border border-border/80 bg-card/75 backdrop-blur-xs shadow-soft p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground tracking-tight">Today</span>
                <span className="text-[11px] text-muted-foreground font-mono">Updated live</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setHideAmounts(!hideAmounts)}
                  title={hideAmounts ? "Show Amounts" : "Hide Amounts"}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {hideAmounts ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={loadData}
                  title="Refresh Today's Data (F5)"
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="pt-3 space-y-3">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Sales
                </span>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-foreground mt-0.5 tracking-tight">
                  {hideAmounts ? "₹ ••••••" : formatMoney(todaySalesTotal)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50 text-xs">
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60">
                  <div className="text-muted-foreground text-[11px]">Cash Collection</div>
                  <div className="font-bold font-mono text-foreground mt-0.5">
                    {hideAmounts ? "₹ •••" : formatMoney(todayCashTotal)}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60">
                  <div className="text-muted-foreground text-[11px]">UPI / Online</div>
                  <div className="font-bold font-mono text-foreground mt-0.5">
                    {hideAmounts ? "₹ •••" : formatMoney(todayUpiTotal)}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60">
                  <div className="text-muted-foreground text-[11px]">Total Bills</div>
                  <div className="font-bold font-mono text-foreground mt-0.5">
                    {todayBills.length} sales
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60">
                  <div className="text-muted-foreground text-[11px]">Average Bill</div>
                  <div className="font-bold font-mono text-foreground mt-0.5">
                    {hideAmounts ? "₹ •••" : formatMoney(avgBillValue)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Needs Attention Card (qN) ── */}
          <div className="rounded-2xl border border-border/80 bg-card/75 backdrop-blur-xs shadow-soft p-4 flex flex-col justify-between flex-1">
            <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground tracking-tight">
                  Needs Attention
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    hasIssues
                      ? "bg-warning/20 text-warning-foreground border border-warning/30"
                      : "bg-success/15 text-success border border-success/30"
                  }`}
                >
                  {hasIssues ? "Action items" : "Healthy"}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                {lowStock.length + expiringSoon.length + pendingBills.length} alerts
              </span>
            </div>

            <div className="py-2 space-y-2 flex-1 overflow-y-auto no-scrollbar">
              {lowStock.length > 0 && (
                <div
                  onClick={() => navigate({ to: "/inventory" })}
                  className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 transition-smooth cursor-pointer flex items-center justify-between text-amber-900 dark:text-amber-200"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-tight">Low Stock Medicines</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {lowStock.length} items below minimum reorder level
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30 shrink-0">
                    Open →
                  </span>
                </div>
              )}

              {expiringSoon.length > 0 && (
                <div
                  onClick={() => navigate({ to: "/inventory" })}
                  className="p-2.5 rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/15 transition-smooth cursor-pointer flex items-center justify-between text-orange-900 dark:text-orange-200"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-orange-500/20 text-orange-600 dark:text-orange-400 shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-tight">Near Expiry Alert</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {expiringSoon.length} items expiring within {expiryDays} days
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-500/20 px-2 py-0.5 rounded-lg border border-orange-500/30 shrink-0">
                    Open →
                  </span>
                </div>
              )}

              {pendingBills.length > 0 && (
                <div
                  onClick={() => navigate({ to: "/bills" })}
                  className="p-2.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/15 transition-smooth cursor-pointer flex items-center justify-between text-foreground"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-primary/20 text-primary shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-tight">Pending Bill Approvals</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {pendingBills.length} employee bills awaiting review
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-primary bg-primary/20 px-2 py-0.5 rounded-lg border border-primary/30 shrink-0">
                    Review →
                  </span>
                </div>
              )}

              {!hasIssues && (
                <div className="h-full flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 text-success mb-1" />
                  <div className="text-xs font-semibold text-foreground">All Systems Healthy</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    No low stock, near-expiry or pending approval issues.
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ── Bottom Shortcut Footer Bar (ya) matching reference ── */}
      <footer className="h-7.5 bg-card/85 backdrop-blur-md border-t border-border/80 px-4 flex items-center justify-between text-[11px] text-muted-foreground shrink-0 select-none shadow-xs">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="font-semibold text-foreground">Shortcuts:</span>
          <span className="flex items-center gap-1">
            <kbd className="bg-muted border border-border px-1.5 py-0.5 rounded font-mono font-bold text-[9px] text-foreground">
              F1
            </kbd>
            <span>Help</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-muted border border-border px-1.5 py-0.5 rounded font-mono font-bold text-[9px] text-foreground">
              F5
            </kbd>
            <span>Refresh</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-muted border border-border px-1.5 py-0.5 rounded font-mono font-bold text-[9px] text-foreground">
              Enter
            </kbd>
            <span>Open</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-muted border border-border px-1.5 py-0.5 rounded font-mono font-bold text-[9px] text-foreground">
              1-9
            </kbd>
            <span>Quick Jump</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-muted border border-border px-1.5 py-0.5 rounded font-mono font-bold text-[9px] text-foreground">
              Esc
            </kbd>
            <span>Menu</span>
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground shrink-0">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="font-medium text-foreground">MediStock ERP · Ready</span>
        </div>
      </footer>
    </div>
  );
}
