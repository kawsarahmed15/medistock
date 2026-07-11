import { useState, useEffect } from "react";
import { Link, useLocation } from "@tanstack/react-router";
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
  Crown,
} from "lucide-react";
import { UserProfileDialog } from "@/components/user-profile-dialog";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/global-search";
import { CartFab } from "@/components/cart-fab";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/sell", label: "Sell", icon: ShoppingCart },
  { to: "/cart", label: "Cart", icon: ShoppingBag },
  { to: "/bills", label: "Bills", icon: ReceiptText },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/purchases", label: "Purchases", icon: Truck },
  { to: "/credit", label: "Credit", icon: CreditCard },
  { to: "/subscription", label: "Subscription", icon: Crown },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { count } = useCart();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeFocusIndex, setActiveFocusIndex] = useState(0);

  useEffect(() => {
    const activeIdx = nav.findIndex((item) => location.pathname.startsWith(item.to));
    if (activeIdx !== -1) {
      setActiveFocusIndex(activeIdx);
    } else {
      setActiveFocusIndex(0);
    }
  }, [location.pathname]);

  const handleSidebarKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowRight") {
      const mainContainer = document.getElementById("main-content-wrapper");
      if (mainContainer) {
        const focusableElements = Array.from(
          mainContainer.querySelectorAll<HTMLElement>(
            'a, button, input, select, textarea, [tabindex]'
          )
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
      e.currentTarget.querySelectorAll<HTMLElement>(".sidebar-focus-item")
    );
    if (focusable.length === 0) return;

    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    let nextIndex = 0;

    if (e.key === "ArrowDown") {
      nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % focusable.length;
    } else if (e.key === "ArrowUp") {
      nextIndex = currentIndex === -1 ? focusable.length - 1 : (currentIndex - 1 + focusable.length) % focusable.length;
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

  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 768px)");
    const onChange = () => setIsDesktop(mql.matches);
    setIsDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const sidebarBody = (onNavigate?: () => void) => (
    <aside
      onKeyDown={handleSidebarKeyDown}
      className="h-full flex flex-col border-r border-sidebar-border bg-sidebar shadow-soft overflow-hidden print:hidden"
    >
      <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow shrink-0">
          <Pill className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sidebar-foreground leading-tight truncate">
            MediStock
          </div>
          <div className="text-[11px] text-muted-foreground truncate">Pharmacy Suite</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map(({ to, label, icon: Icon }, idx) => {
          const active = location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              preload="intent"
              onClick={onNavigate}
              tabIndex={activeFocusIndex === idx ? 0 : -1}
              onFocus={() => setActiveFocusIndex(idx)}
              className={cn(
                "sidebar-focus-item flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{label}</span>
              {to === "/cart" && count > 0 && (
                <span className="rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 shrink-0">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-1">
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            setProfileOpen(true);
          }}
          tabIndex={activeFocusIndex === 10 ? 0 : -1}
          onFocus={() => setActiveFocusIndex(10)}
          className="sidebar-focus-item w-full text-left rounded-lg px-3 py-2 hover:bg-sidebar-accent/60 transition-smooth flex items-center gap-3"
          aria-label="Open profile"
        >
          <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-sm font-semibold shadow-glow shrink-0">
            {(session?.name || session?.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-sidebar-foreground truncate">
              {session?.name}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">{session?.email}</div>
          </div>
          <UserCog className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
        {session?.role === "superadmin" && (
          <Link
            to="/admin/dashboard"
            onClick={onNavigate}
            tabIndex={activeFocusIndex === 11 ? 0 : -1}
            onFocus={() => setActiveFocusIndex(11)}
            className="sidebar-focus-item flex w-full justify-start items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-500/10 transition-smooth"
          >
            <ShieldCheck className="h-4 w-4" /> Admin Panel
          </Link>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void logout()}
          tabIndex={activeFocusIndex === (session?.role === "superadmin" ? 12 : 11) ? 0 : -1}
          onFocus={() => setActiveFocusIndex(session?.role === "superadmin" ? 12 : 11)}
          className="sidebar-focus-item w-full justify-start gap-2"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </aside>
  );

  const themeButton = (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label="Toggle theme"
      title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      className="relative overflow-hidden shrink-0 border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-smooth"
    >
      <Sun
        className={cn(
          "h-4 w-4 absolute transition-all duration-500",
          theme === "light" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
        )}
      />
      <Moon
        className={cn(
          "h-4 w-4 absolute transition-all duration-500",
          theme === "dark" ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0",
        )}
      />
    </Button>
  );

  const sellButton = (
    <Link
      to="/sell"
      preload="intent"
      title="New sale (F2)"
      className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-medium shadow-soft hover:shadow-glow hover:scale-[1.03] transition-smooth shrink-0"
    >
      <ShoppingCart className="h-4 w-4" />
      <span className="hidden xs:inline sm:inline">New sale</span>
    </Link>
  );

  const main = (
    <div
      id="main"
      onKeyDown={handleMainKeyDown}
      className="h-full flex flex-col min-w-0 bg-gradient-soft print:block print:h-auto"
    >
      <header className="h-14 flex items-center gap-2 sm:gap-3 md:gap-4 px-3 sm:px-4 md:px-8 border-b border-border bg-background/70 backdrop-blur-md sticky top-0 z-10 print:hidden">
        {/* Mobile hamburger -> opens sidebar sheet */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 max-w-[80vw]">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {sidebarBody(() => setMobileNavOpen(false))}
          </SheetContent>
        </Sheet>

        {/* Global search — left side, fills available space on mobile */}
        <div className="flex-1 min-w-0 max-w-md animate-fade-in">
          <GlobalSearch />
        </div>

        <div className="hidden md:flex flex-1" />

        {sellButton}

        {themeButton}
      </header>

      <main className="flex-1 overflow-auto px-3 sm:px-4 md:px-8 py-5 sm:py-6 md:py-8 animate-fade-in print:p-0 print:overflow-visible">
        {children}
      </main>
      <div className="print:hidden">
        <CartFab />
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-gradient-soft overflow-hidden print:h-auto print:overflow-visible">
      {!isDesktop ? (
        <div className="md:hidden h-full print:h-auto">{main}</div>
      ) : (
        <div className="hidden md:block h-full print:block print:h-auto">
          <ResizablePanelGroup
            orientation="horizontal"
            id="medistock-shell"
            className="h-full print:h-auto print:block"
          >
            <ResizablePanel
              id="sidebar"
              defaultSize={"256px" as any}
              minSize={"180px" as any}
              maxSize={"480px" as any}
              className="h-full print:hidden"
            >
              {sidebarBody()}
            </ResizablePanel>
            <ResizableHandle className="pointer-events-none opacity-0 print:hidden" />
            <ResizablePanel id="main" className="h-full print:h-auto">
              {main}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}

      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
