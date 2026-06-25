import { Link, useLocation } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { cn } from "@/lib/utils";

/**
 * Floating cart button shown on Sell & Inventory pages so the user can
 * jump to the cart instantly after adding products (Marg-style F4 flow).
 */
export function CartFab() {
  const { count, total } = useCart();
  const location = useLocation();
  const showOn = ["/sell", "/inventory"].some((p) => location.pathname.startsWith(p));
  if (!showOn || count === 0) return null;

  return (
    <Link
      to="/cart"
      preload="intent"
      aria-label={`Open cart with ${count} items`}
      className={cn(
        "fixed z-40 bottom-5 right-5 sm:bottom-7 sm:right-7",
        "inline-flex items-center gap-2 pl-4 pr-5 py-3 rounded-full",
        "bg-gradient-primary text-primary-foreground shadow-glow",
        "hover:scale-105 active:scale-95 transition-transform duration-200",
        "animate-fade-in",
      )}
    >
      <span className="relative">
        <ShoppingBag className="h-5 w-5" />
        <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-background text-foreground text-[10px] font-bold flex items-center justify-center shadow">
          {count}
        </span>
      </span>
      <span className="text-sm font-medium tabular-nums">
        Go to cart · ₹{total.toFixed(0)}
      </span>
    </Link>
  );
}
