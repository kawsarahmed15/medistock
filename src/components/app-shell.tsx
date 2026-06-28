import { useState } from "react";
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
} from "lucide-react";
import { UserProfileDialog } from "@/components/user-profile-dialog";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/global-search";
import { CartFab } from "@/components/cart-fab";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/sell", label: "Sell", icon: ShoppingCart },
  { to: "/cart", label: "Cart", icon: ShoppingBag },
  { to: "/bills", label: "Bills", icon: ReceiptText },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/credit", label: "Credit", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { count } = useCart();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const sidebarBody = (onNavigate?: () => void) => (
    <aside className="h-full flex flex-col border-r border-sidebar-border bg-sidebar shadow-soft overflow-hidden print:hidden">
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
        {nav.map(({ to, label, icon: Icon }) => {
          const active = location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              preload="intent"
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth",
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
          className="w-full text-left rounded-lg px-3 py-2 hover:bg-sidebar-accent/60 transition-smooth flex items-center gap-3"
          aria-label="Open profile"
        >
          <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-sm font-semibold shadow-glow shrink-0">
            {(session?.name || session?.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-sidebar-foreground truncate">
              {session?.name}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {session?.email}
            </div>
          </div>
          <UserCog className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
        {session?.role === "superadmin" && (
          <Link
            to="/admin/dashboard"
            onClick={onNavigate}
            className="flex w-full justify-start items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-500/10 transition-smooth"
          >
            <ShieldCheck className="h-4 w-4" /> Admin Panel
          </Link>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void logout()}
          className="w-full justify-start gap-2"
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
          theme === "light"
            ? "rotate-0 scale-100 opacity-100"
            : "-rotate-90 scale-0 opacity-0",
        )}
      />
      <Moon
        className={cn(
          "h-4 w-4 absolute transition-all duration-500",
          theme === "dark"
            ? "rotate-0 scale-100 opacity-100"
            : "rotate-90 scale-0 opacity-0",
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
    <div className="h-full flex flex-col min-w-0 bg-gradient-soft">
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
    <div className="h-screen w-full bg-gradient-soft overflow-hidden">
      {/* Mobile / tablet: single column, nav lives in the hamburger sheet */}
      <div className="md:hidden h-full">{main}</div>

      {/* Desktop: resizable two-pane */}
      <div className="hidden md:block h-full">
        <ResizablePanelGroup orientation="horizontal" id="medistock-shell" className="h-full">
          <ResizablePanel
            id="sidebar"
            defaultSize="256px"
            minSize="180px"
            maxSize="480px"
            className="h-full"
          >
            {sidebarBody()}
          </ResizablePanel>
          <ResizableHandle className="pointer-events-none opacity-0" />
          <ResizablePanel id="main" className="h-full">
            {main}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
