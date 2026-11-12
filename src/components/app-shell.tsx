import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ShoppingBag,
  ReceiptText,
  Users,
  LogOut,
  Pill,
  Moon,
  Sun,
  Menu,
  UserCog,
  Settings,
  ShieldCheck,
  CreditCard,
  Truck,
  BookOpen,
  Bell,
  UserCheck,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutGrid,
} from "lucide-react";
import { UserProfileDialog } from "@/components/user-profile-dialog";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/global-search";
import { CartFab } from "@/components/cart-fab";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api-client";
import { getNotifications, addNotification, NotificationItem } from "@/lib/notifications";
import { getBusinessModule } from "@/features";
import { toast } from "sonner";

const employeeNav = [
  { to: "/inventory", label: "Inventory (Stock)", icon: Package },
  { to: "/new-sale", label: "New Sale", icon: ShoppingCart },
  { to: "/cart", label: "Cart", icon: ShoppingBag },
  { to: "/bills", label: "My Bills", icon: ReceiptText },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { count } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeFocusIndex, setActiveFocusIndex] = useState(0);

  const [liveTime, setLiveTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setLiveTime(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      );
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const getPageTitle = (path: string) => {
    if (path.startsWith("/cart")) return "Sale / Cart";
    if (path.startsWith("/new-sale")) return "New Sale";
    if (path.startsWith("/inventory")) return "Inventory (Stock)";
    if (path.startsWith("/bills")) return "Sale Book (Bills)";
    if (path.startsWith("/purchases/new")) return "Purchase Bill";
    if (path.startsWith("/purchases")) return "Purchases";
    if (path.startsWith("/credit")) return "Credit Sales";
    if (path.startsWith("/ledger")) return "Ledger";
    if (path.startsWith("/revenue")) return "Reports & Dashboard";
    if (path.startsWith("/customers")) return "Customers";
    if (path.startsWith("/employees")) return "Employees";
    if (path.startsWith("/settings")) return "Settings";
    if (path.startsWith("/notifications")) return "Notifications";
    return "Medistock";
  };

  useEffect(() => {
    const handleNavKey = (e: KeyboardEvent) => {
      // F10 key jumps directly to Main Menu / Dashboard
      if (e.key === "F10" && location.pathname !== "/dashboard") {
        if (e.defaultPrevented) return;
        const hasOpenDialog = Boolean(
          document.querySelector(
            '[role="dialog"], [role="alertdialog"], [data-radix-portal] [data-state="open"]'
          )
        );
        if (hasOpenDialog) return;
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        e.preventDefault();
        navigate({ to: "/dashboard" });
        return;
      }

      // Escape is used as a BACK BUTTON (navigates back one page in history)
      if (e.key === "Escape") {
        if (e.defaultPrevented) return;

        // If a modal, dialog, or sheet is open, allow it to close naturally
        const hasOpenDialog = Boolean(
          document.querySelector(
            '[role="dialog"], [role="alertdialog"], [data-radix-portal] [data-state="open"]'
          )
        );
        if (hasOpenDialog) return;

        // If mobile sidebar drawer is open, close it first
        if (mobileNavOpen) {
          e.preventDefault();
          setMobileNavOpen(false);
          return;
        }

        // If already on the main dashboard, Esc should not navigate away from the app
        if (location.pathname === "/dashboard") {
          return;
        }

        // If an input/textarea/select is focused, blur it
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }

        e.preventDefault();

        // Check if we can go back in the current session history
        const canGoBack = Boolean(
          typeof window !== "undefined" &&
            (window.history.state?.__TSR_index > 0 ||
              (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)))
        );

        if (canGoBack) {
          router.history.back();
        } else {
          // Contextual single-page fallback when opened directly
          const path = location.pathname;
          if (path.startsWith("/bills/")) {
            navigate({ to: "/bills" });
          } else if (path.startsWith("/purchases/")) {
            navigate({ to: "/purchases" });
          } else if (path.startsWith("/inventory/")) {
            navigate({ to: "/inventory" });
          } else {
            navigate({ to: "/dashboard" });
          }
        }
      }
    };
    window.addEventListener("keydown", handleNavKey);
    return () => window.removeEventListener("keydown", handleNavKey);
  }, [location.pathname, navigate, mobileNavOpen, router]);

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setMobileNavOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [isAdminDevice, setIsAdminDevice] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pendingBillsCount, setPendingBillsCount] = useState(0);

  const isEmployee = Boolean(session?.isEmployee);
  const businessModule = getBusinessModule(session?.role);
  const moduleNav = businessModule.navigation;

  const dynamicNav = isEmployee
    ? [...employeeNav]
    : [
        ...moduleNav.slice(0, 10),
        ...(isAdminDevice ? [{ to: "/notifications", label: "Notifications", icon: Bell }] : []),
        moduleNav[10] || { to: "/settings", label: "Settings", icon: Settings },
      ];

  const checkPendingBills = async () => {
    try {
      const res = await apiRequest<{ count: number }>("/bills/pending-count", { auth: true });
      setPendingBillsCount(res.count || 0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    checkPendingBills();
    const interval = setInterval(checkPendingBills, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setNotifications(getNotifications());
    const handleChanges = () => {
      setNotifications(getNotifications());
    };
    window.addEventListener("medistock.notifications_changed", handleChanges);
    return () => window.removeEventListener("medistock.notifications_changed", handleChanges);
  }, []);

  useEffect(() => {
    const mySessId = window.localStorage.getItem("medistock.auth.sessionId");
    if (!mySessId) return;

    const pollSessions = async () => {
      try {
        const data = await apiRequest<any[]>("/auth/sessions", { auth: true });
        const currentSession = data.find((s) => s.sessionId === mySessId);
        const currentIsAdmin = currentSession?.isAdmin === 1;
        setIsAdminDevice(currentIsAdmin);

        if (currentIsAdmin) {
          const seenDevicesStr = window.localStorage.getItem("medistock.seen_devices");
          const isFirstLoad = seenDevicesStr === null;
          const seenDevices: string[] = seenDevicesStr ? JSON.parse(seenDevicesStr) : [];

          let updatedSeen = isFirstLoad ? data.map((s) => s.deviceId) : [...seenDevices];
          let addedAny = isFirstLoad;

          if (!isFirstLoad) {
            data.forEach((s) => {
              if (s.status === "active" && s.sessionId !== mySessId) {
                if (!seenDevices.includes(s.deviceId)) {
                  addNotification(
                    "Security Alert: New Login",
                    `${s.deviceBrowser || "Browser"} on ${s.deviceOs || "OS"} logged in.`,
                  );
                  updatedSeen.push(s.deviceId);
                  addedAny = true;

                  toast.info("Security Alert: New device logged in!", {
                    description: `${s.deviceBrowser || "Browser"} on ${s.deviceOs || "OS"}`,
                  });
                }
              }
            });
          }

          if (addedAny) {
            window.localStorage.setItem("medistock.seen_devices", JSON.stringify(updatedSeen));
          }
        }
      } catch (err) {
        console.error("Failed to poll sessions in AppShell:", err);
      }
    };

    pollSessions();
    const interval = setInterval(pollSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const activeIdx = dynamicNav.findIndex((item) => location.pathname.startsWith(item.to));
    if (activeIdx !== -1) {
      setActiveFocusIndex(activeIdx);
    } else {
      setActiveFocusIndex(0);
    }
  }, [location.pathname, isAdminDevice]);

  const handleSidebarKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowRight") {
      const mainContainer = document.getElementById("main-content-wrapper");
      if (mainContainer) {
        const focusableElements = Array.from(
          mainContainer.querySelectorAll<HTMLElement>(
            "a, button, input, select, textarea, [tabindex]",
          ),
        ).filter((el) => {
          const tabIndexAttr = el.getAttribute("tabindex");
          const isNotTabbable = tabIndexAttr === "-1" || el.hasAttribute("disabled");
          const style = window.getComputedStyle(el);
          const isVisible = style.display !== "none" && style.visibility !== "hidden";
          return !isNotTabbable && isVisible;
        });

        if (focusableElements.length > 0) {
          e.preventDefault();
          focusableElements[0].focus();
        }
      }
      return;
    }

    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

    const focusable = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>(".sidebar-focus-item"),
    );
    if (focusable.length === 0) return;

    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    let nextIndex = 0;

    if (e.key === "ArrowDown") {
      nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % focusable.length;
    } else if (e.key === "ArrowUp") {
      nextIndex =
        currentIndex === -1
          ? focusable.length - 1
          : (currentIndex - 1 + focusable.length) % focusable.length;
    }

    e.preventDefault();
    focusable[nextIndex]?.focus();
    setActiveFocusIndex(nextIndex);
  };

  const handleMainKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowLeft") {
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      const activeSidebarItem = (document.querySelector(".sidebar-focus-item[tabindex='0']") ||
        document.querySelector(".sidebar-focus-item")) as HTMLElement;
      if (activeSidebarItem) {
        e.preventDefault();
        activeSidebarItem.focus();
      }
    }
  };

  const sidebarBody = (onNavigate?: () => void, collapsed: boolean = false) => (
    <aside
      onKeyDown={handleSidebarKeyDown}
      className={cn(
        "h-full flex flex-col bg-sidebar shadow-soft overflow-hidden print:hidden select-none",
        collapsed ? "items-center" : "",
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border transition-all duration-300",
          collapsed ? "justify-center p-3 w-full" : "gap-2.5 px-4 py-3.5",
        )}
      >
        <Link
          to="/"
          title="MediStock Dashboard"
          className="flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
        >
          <div
            className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center shadow-glow shrink-0 transition-transform hover:scale-105",
              isEmployee
                ? "bg-amber-500 text-white"
                : "bg-gradient-primary text-primary-foreground",
            )}
          >
            <Pill className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold text-sm text-sidebar-foreground leading-tight truncate">
                MediStock
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {isEmployee ? (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    Employee Panel
                  </span>
                ) : (
                  "Pharmacy Suite"
                )}
              </div>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation items */}
      <nav
        className={cn(
          "flex-1 py-3 space-y-1 overflow-y-auto no-scrollbar",
          collapsed ? "px-1.5 w-full" : "px-2.5",
        )}
      >
        {dynamicNav.map(({ to, label, icon: Icon }, idx) => {
          const active = location.pathname.startsWith(to);
          const unreadCount =
            to === "/notifications" ? notifications.filter((n) => n.unread).length : 0;
          return (
            <Link
              key={to}
              to={to}
              preload="intent"
              onClick={onNavigate}
              tabIndex={activeFocusIndex === idx ? 0 : -1}
              onFocus={() => setActiveFocusIndex(idx)}
              title={collapsed ? label : undefined}
              className={cn(
                "sidebar-focus-item relative flex items-center rounded-lg text-sm font-medium transition-smooth group",
                collapsed ? "justify-center h-10 w-full px-0" : "gap-2.5 px-2.5 py-2",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
              {!collapsed && <span className="flex-1 truncate text-xs font-semibold">{label}</span>}

              {/* Badges for expanded mode */}
              {!collapsed && to === "/cart" && count > 0 && (
                <span className="rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 shrink-0">
                  {count}
                </span>
              )}
              {!collapsed && to === "/bills" && pendingBillsCount > 0 && (
                <span
                  className="rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 shrink-0 animate-pulse"
                  title={`${pendingBillsCount} pending bills awaiting approval`}
                >
                  {pendingBillsCount}
                </span>
              )}
              {!collapsed && to === "/notifications" && unreadCount > 0 && (
                <span className="rounded-full bg-rose-500 h-2 w-2 shrink-0 animate-pulse" />
              )}

              {/* Badges for collapsed mini-rail mode */}
              {collapsed && to === "/cart" && count > 0 && (
                <span className="absolute top-1 right-1.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold h-4 min-w-4 px-1 flex items-center justify-center shadow-xs">
                  {count}
                </span>
              )}
              {collapsed && to === "/bills" && pendingBillsCount > 0 && (
                <span className="absolute top-1 right-1.5 rounded-full bg-amber-500 text-white text-[9px] font-bold h-4 min-w-4 px-1 flex items-center justify-center animate-pulse shadow-xs">
                  {pendingBillsCount}
                </span>
              )}
              {collapsed && to === "/notifications" && unreadCount > 0 && (
                <span className="absolute top-1.5 right-2 rounded-full bg-rose-500 h-2 w-2 animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer user profile & actions */}
      <div
        className={cn(
          "border-t border-sidebar-border space-y-1",
          collapsed ? "p-2 w-full flex flex-col items-center" : "p-2.5",
        )}
      >
        <button
          type="button"
          onClick={() => {
            if (!isEmployee) {
              onNavigate?.();
              setProfileOpen(true);
            }
          }}
          tabIndex={activeFocusIndex === 10 ? 0 : -1}
          onFocus={() => setActiveFocusIndex(10)}
          title={collapsed ? `${session?.name || "User"} (${session?.email})` : undefined}
          className={cn(
            "sidebar-focus-item rounded-lg transition-smooth flex items-center",
            collapsed ? "justify-center h-10 w-full p-0" : "w-full text-left px-2.5 py-1.5 gap-2.5",
            isEmployee ? "cursor-default opacity-90" : "hover:bg-sidebar-accent/60",
          )}
          aria-label="User info"
        >
          <div
            className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shadow-glow shrink-0",
              isEmployee
                ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                : "bg-gradient-primary text-primary-foreground",
            )}
          >
            {(session?.name || session?.email || "U").charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-sidebar-foreground truncate flex items-center gap-1.5">
                <span>{session?.name}</span>
                {isEmployee ? (
                  <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold px-1 py-0.2 rounded border border-amber-500/20">
                    Staff
                  </span>
                ) : (
                  <span
                    className={cn(
                      "text-[9px] font-semibold px-1 py-0.2 rounded border",
                      businessModule.badgeClass,
                    )}
                  >
                    {businessModule.shortTitle}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">{session?.email}</div>
            </div>
          )}
          {!collapsed && !isEmployee && (
            <UserCog className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
        </button>

        {!collapsed && session?.role === "superadmin" && !isEmployee && (
          <Link
            to="/admin/dashboard"
            onClick={onNavigate}
            tabIndex={activeFocusIndex === 11 ? 0 : -1}
            onFocus={() => setActiveFocusIndex(11)}
            className="sidebar-focus-item flex w-full justify-start items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 transition-smooth"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" /> Admin Panel
          </Link>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => void logout()}
          tabIndex={
            activeFocusIndex === (session?.role === "superadmin" && !isEmployee ? 12 : 11) ? 0 : -1
          }
          onFocus={() =>
            setActiveFocusIndex(session?.role === "superadmin" && !isEmployee ? 12 : 11)
          }
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "sidebar-focus-item text-xs font-medium text-muted-foreground hover:text-foreground",
            collapsed ? "h-9 w-9 p-0 justify-center" : "w-full justify-start gap-2 h-8 px-2.5",
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </Button>
      </div>
    </aside>
  );

  const themeButton = (
    <Button
      variant="outline"
      size="icon"
      onClick={(e) => toggle(e)}
      aria-label="Toggle theme"
      title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      className="relative overflow-hidden shrink-0 h-8 w-8 border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-300 active:scale-95 shadow-xs"
    >
      <Sun
        className={cn(
          "h-3.5 w-3.5 absolute transition-all duration-300 ease-out text-amber-500",
          theme === "light" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
        )}
      />
      <Moon
        className={cn(
          "h-3.5 w-3.5 absolute transition-all duration-300 ease-out text-sky-400",
          theme === "dark" ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0",
        )}
      />
    </Button>
  );

  const sellButton = (
    <Link
      to="/new-sale"
      preload="intent"
      title="New sale (F2)"
      className="inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg bg-gradient-primary text-primary-foreground text-xs font-semibold shadow-soft hover:shadow-glow hover:scale-[1.02] transition-smooth shrink-0"
    >
      <ShoppingCart className="h-3.5 w-3.5" />
      <span className="hidden xs:inline sm:inline">New sale</span>
    </Link>
  );

  const isDashboard = location.pathname === "/dashboard" || location.pathname === "/dashboard/";

  const main = (
    <div
      id="main"
      onKeyDown={handleMainKeyDown}
      className="h-full flex flex-col min-w-0 bg-gradient-soft print:block print:h-auto"
    >
      <header className="h-10 sm:h-11 bg-background/85 backdrop-blur-md border-b border-border flex items-center justify-between px-3 sm:px-4 shrink-0 shadow-2xs select-none relative z-30">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            title="MediStock Main Menu"
          >
            <div className="w-5 h-5 rounded bg-primary text-primary-foreground flex items-center justify-center font-black text-[11px] shadow-xs">
              M
            </div>
            <span className="font-extrabold text-sm tracking-tight text-foreground">
              Medi<span className="text-primary">stock</span>
            </span>
          </Link>

          <div className="h-4 w-px bg-border shrink-0" />

          {isDashboard ? (
            <div className="flex items-center gap-2 min-w-0 text-xs">
              <span className="font-bold text-foreground tracking-tight truncate max-w-[200px] sm:max-w-[320px]">
                {session?.pharmacyName || "MEDPLUS PHARMACY & SURGICALS"}
              </span>
              <span className="text-muted-foreground/40 shrink-0">·</span>
              <span className="text-[11px] text-muted-foreground font-mono shrink-0 hidden sm:inline truncate max-w-[240px]">
                DL: {session?.drugLicNo || "DL-20B-889900"}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-xs text-foreground tracking-tight truncate">
                {getPageTitle(location.pathname)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div className="px-1.5 py-0.5 rounded bg-muted/80 border border-border text-[11px] font-mono font-medium text-muted-foreground hidden xs:inline-block">
            POS-01
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <span>🕒</span>
            <span className="font-semibold text-foreground">{liveTime}</span>
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Cart Counter badge if items in cart */}
          {count > 0 && location.pathname !== "/cart" && (
            <Link
              to="/cart"
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-xs transition-colors"
              title={`${count} items in Cart`}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>{count}</span>
            </Link>
          )}

          {/* Quick Drawer Menu trigger */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Navigation drawer"
                title="Quick Navigation (Ctrl+B)"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 max-w-[80vw]">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              {sidebarBody(() => setMobileNavOpen(false), false)}
            </SheetContent>
          </Sheet>

          {/* Theme button */}
          {themeButton}

          {/* User Profile / Logout */}
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-1.5 pl-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            title={`${session?.name || "User"} (${session?.email})`}
          >
            <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-[10px]">
              {(session?.name || session?.email || "U").charAt(0).toUpperCase()}
            </div>
            <span className="hidden md:inline font-medium max-w-[90px] truncate text-foreground">
              {session?.name || "User"}
            </span>
          </button>
        </div>
      </header>

      <main
        id="main-content-wrapper"
        className="flex-1 overflow-auto animate-fade-in print:p-0 print:overflow-visible p-2 sm:p-3"
      >
        {children}
      </main>
      <div className="print:hidden">
        <CartFab />
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-gradient-soft overflow-hidden flex flex-col print:h-auto print:overflow-visible">
      {/* Main Workspace Area — gets 100% full width everywhere with zero sidebar */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden print:h-auto print:overflow-visible">
        {main}
      </div>

      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
