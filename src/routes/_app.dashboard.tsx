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
              badge: count > 0 ? `${count} in Cart` : undefined,
            },
            {
              num: "2",
              hotkey: "N",
              title: "New Sale",
              path: "/new-sale",
              desc: "Start fresh patient sale or prescription entry",
              icon: ShoppingCart,
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
            badge: count > 0 ? `${count} in Cart` : undefined,
          },
          {
            num: "2",
            hotkey: "P",
            title: "Purchase Bill",
            path: "/purchases/new",
            desc: "Supplier invoice with batch and expiry",
            icon: Truck,
          },
          {
            num: "3",
            hotkey: "C",
            title: "Purchases",
            path: "/purchases",
            desc: "Goods receipt note and purchase bills",
            icon: Package,
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
            badge: pendingBills.length > 0 ? `${pendingBills.length} pending` : undefined,
          },
          {
            num: "5",
            hotkey: "K",
            title: "Credit Sales",
            path: "/credit",
            desc: "Customer dues, khata ledger and settlements",
            icon: CreditCard,
          },
          {
            num: "6",
            hotkey: "L",
            title: "Ledger",
            path: "/ledger",
            desc: "Customer khata and supplier statements",
            icon: BookOpen,
          },
          {
            num: "7",
            hotkey: "R",
            title: "Reports",
            path: "/revenue",
            desc: "Schedule H1 register, sales and profit",
            icon: TrendingUp,
          },
          {
            num: "U",
            hotkey: "U",
            title: "Customers",
            path: "/customers",
            desc: "Patient directory and outstanding balances",
            icon: Users,
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
            badge: lowStock.length > 0 ? `${lowStock.length} low` : undefined,
          },
          {
            num: "M",
            hotkey: "M",
            title: "Employees",
            path: "/employees",
            desc: "Staff accounts, cashier mode and permissions",
            icon: UserCheck,
          },
          {
            num: "0",
            hotkey: "T",
            title: "Settings",
            path: "/settings",
            desc: "Printer, store profile, GSTIN and backup",
            icon: Settings,
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
    <div className="-m-2 sm:-m-3 h-[calc(100vh-40px)] flex flex-col justify-between overflow-hidden bg-slate-50 select-none">
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
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
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
                          className={`min-h-[56px] rounded-lg p-2.5 border transition-all cursor-pointer flex items-center justify-between text-left outline-none ${
                            isSelected
                              ? "border-blue-500 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/30"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 shadow-xs"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                                isSelected
                                  ? "bg-blue-100 text-blue-700 border-blue-200 shadow-xs"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-slate-900 leading-tight">
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 leading-snug line-clamp-1">
                                {item.desc}
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 pl-1">
                            <kbd
                              className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded font-mono font-bold text-xs border transition-colors ${
                                isSelected
                                  ? "bg-blue-600 text-white border-blue-700 shadow-xs"
                                  : "bg-slate-100 text-slate-700 border-slate-300"
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
            <div className="mt-3 py-1.5 px-3 rounded bg-slate-100/90 border border-slate-200 flex items-center gap-2 text-xs text-slate-700 shrink-0">
              <span className="font-bold text-slate-900">{activeItem.title}:</span>
              <span className="text-slate-600 truncate">{activeItem.desc}</span>
            </div>
          )}
        </section>

        {/* Right Section: Today & Needs Attention panels (40-42% width) */}
        <section className="hidden lg:flex w-[42%] xl:w-[40%] min-w-[340px] flex-col gap-3 justify-between overflow-y-auto no-scrollbar">
          {/* ── Today Card (QN) ── */}
          <div className="clean-card rounded-xl p-4 bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900 tracking-tight">Today</span>
                <span className="text-[11px] text-slate-400 font-mono">Updated just now</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setHideAmounts(!hideAmounts)}
                  title={hideAmounts ? "Show Amounts" : "Hide Amounts"}
                  className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  {hideAmounts ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={loadData}
                  title="Refresh Today's Data (F5)"
                  className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="pt-3 space-y-3">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Sales
                </span>
                <div className="text-2xl font-bold font-mono text-slate-900 mt-0.5">
                  {hideAmounts ? "₹ ••••••" : formatMoney(todaySalesTotal)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-xs">
                <div className="p-2 rounded bg-slate-50 border border-slate-100">
                  <div className="text-slate-500 text-[11px]">Cash Collection</div>
                  <div className="font-bold font-mono text-slate-800 mt-0.5">
                    {hideAmounts ? "₹ •••" : formatMoney(todayCashTotal)}
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-50 border border-slate-100">
                  <div className="text-slate-500 text-[11px]">UPI / Online</div>
                  <div className="font-bold font-mono text-slate-800 mt-0.5">
                    {hideAmounts ? "₹ •••" : formatMoney(todayUpiTotal)}
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-50 border border-slate-100">
                  <div className="text-slate-500 text-[11px]">Total Bills</div>
                  <div className="font-bold font-mono text-slate-800 mt-0.5">
                    {todayBills.length} sales
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-50 border border-slate-100">
                  <div className="text-slate-500 text-[11px]">Average Bill</div>
                  <div className="font-bold font-mono text-slate-800 mt-0.5">
                    {hideAmounts ? "₹ •••" : formatMoney(avgBillValue)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Needs Attention Card (qN) ── */}
          <div className="clean-card rounded-xl p-4 bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between flex-1">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900 tracking-tight">
                  Needs Attention
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                    hasIssues
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  {hasIssues ? "Action items" : "Healthy"}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {lowStock.length + expiringSoon.length + pendingBills.length} alerts
              </span>
            </div>

            <div className="py-2 space-y-2 flex-1 overflow-y-auto no-scrollbar">
              {lowStock.length > 0 && (
                <div
                  onClick={() => navigate({ to: "/inventory" })}
                  className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/70 hover:bg-amber-100/70 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-amber-600 font-bold text-xs">⚠️</span>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Low Stock Medicines</div>
                      <div className="text-[11px] text-slate-600">
                        {lowStock.length} items below minimum reorder level
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                    Open →
                  </span>
                </div>
              )}

              {expiringSoon.length > 0 && (
                <div
                  onClick={() => navigate({ to: "/inventory" })}
                  className="p-2.5 rounded-lg border border-orange-200 bg-orange-50/70 hover:bg-orange-100/70 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-orange-600 font-bold text-xs">⏰</span>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Near Expiry Alert</div>
                      <div className="text-[11px] text-slate-600">
                        {expiringSoon.length} items expiring within {expiryDays} days
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-orange-800 bg-orange-100 px-2 py-0.5 rounded border border-orange-200">
                    Open →
                  </span>
                </div>
              )}

              {pendingBills.length > 0 && (
                <div
                  onClick={() => navigate({ to: "/bills" })}
                  className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 font-bold text-xs">⏳</span>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Pending Bill Approvals</div>
                      <div className="text-[11px] text-slate-600">
                        {pendingBills.length} employee bills awaiting review
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                    Review →
                  </span>
                </div>
              )}

              {!hasIssues && (
                <div className="h-full flex flex-col items-center justify-center py-6 text-center text-slate-500">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-1" />
                  <div className="text-xs font-semibold text-slate-800">All Systems Healthy</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    No low stock, near-expiry or pending approval issues.
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ── Bottom Shortcut Footer Bar (ya) matching reference ── */}
      <footer className="h-7 bg-white border-t border-slate-200 px-4 flex items-center justify-between text-[11px] text-slate-600 shrink-0 select-none shadow-xs">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="font-semibold text-slate-700">Shortcuts:</span>
          <span className="flex items-center gap-1">
            <kbd className="bg-slate-100 border border-slate-300 px-1 rounded font-mono font-bold text-[9px]">
              F1
            </kbd>
            <span>Help</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-slate-100 border border-slate-300 px-1 rounded font-mono font-bold text-[9px]">
              F5
            </kbd>
            <span>Refresh</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-slate-100 border border-slate-300 px-1 rounded font-mono font-bold text-[9px]">
              Enter
            </kbd>
            <span>Open</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-slate-100 border border-slate-300 px-1 rounded font-mono font-bold text-[9px]">
              1-9
            </kbd>
            <span>Quick Jump</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-slate-100 border border-slate-300 px-1 rounded font-mono font-bold text-[9px]">
              Esc
            </kbd>
            <span>Menu</span>
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>MediStock ERP · Ready</span>
        </div>
      </footer>
    </div>
  );
}
