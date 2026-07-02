import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCart } from "@/lib/cart-context";
import { billsStore, productsStore } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

const SHORTCUTS = [
  { keys: "F1", label: "Dashboard" },
  { keys: "F2", label: "New sale" },
  { keys: "F3", label: "Inventory" },
  { keys: "F4", label: "Cart" },
  { keys: "F5", label: "Bills" },
  { keys: "F6", label: "Customers" },
  { keys: "F7", label: "Revenue" },
  { keys: "Alt + C", label: "Open cart" },
  { keys: "Alt + N", label: "New bill (Clear cart)" },
  { keys: "Alt + A", label: "Add new product" },
  { keys: "F9", label: "Checkout (generate bill from cart)" },
  { keys: "↑ ↓ / J K", label: "Move between bills (on Bills page)" },
  { keys: "Enter", label: "Open focused bill" },
  { keys: "D", label: "Download focused bill PDF" },
  { keys: "/", label: "Focus the global search" },
  { keys: "?", label: "Show this cheatsheet" },
  { keys: "Esc", label: "Close popups" },
];

function isTypingTarget(t: EventTarget | null) {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}

export function KeyboardShortcuts() {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const cart = useCart();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const go = (to: string) => {
        e.preventDefault();
        navigate({ to });
      };
      if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        e.stopPropagation();
        if (cart.items.length > 0) {
          if (
            !window.confirm(
              "You have a pending bill. Are you sure you want to clear it and start a new one?",
            )
          ) {
            return;
          }
        }
        cart.clear();
        if (routerState.location.pathname !== "/sell") {
          navigate({ to: "/sell" }).then(() => {
            setTimeout(() => window.dispatchEvent(new CustomEvent("trigger-new-bill")), 100);
          });
        } else {
          window.dispatchEvent(new CustomEvent("trigger-new-bill"));
        }
        return;
      }

      if (e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        e.stopPropagation();
        if (routerState.location.pathname !== "/cart") {
          navigate({ to: "/cart" });
        }
        return;
      }

      if (e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        e.stopPropagation();
        if (!routerState.location.pathname.startsWith("/inventory")) {
          navigate({ to: "/inventory" }).then(() => {
            window.dispatchEvent(new CustomEvent("trigger-add-product"));
          });
        } else {
          window.dispatchEvent(new CustomEvent("trigger-add-product"));
        }
        return;
      }

      // Always allow F-keys / ? except when typing
      if (isTypingTarget(e.target) && e.key !== "Escape") return;

      switch (e.key) {
        case "F1":
          return go("/dashboard");
        case "F2":
          return go("/sell");
        case "F3":
          return go("/inventory");
        case "F4":
          return go("/cart");
        case "F5":
          return go("/bills");
        case "F6":
          return go("/customers");
        case "F7":
          return go("/revenue");
        case "/": {
          if (e.shiftKey) {
            e.preventDefault();
            setOpen((v) => !v);
            return;
          }
          // Focus the global search
          e.preventDefault();
          const input = document.querySelector<HTMLInputElement>(
            'input[type="search"], input[placeholder*="Search" i]',
          );
          input?.focus();
          return;
        }
        case "?":
          e.preventDefault();
          setOpen((v) => !v);
          return;
        case "Escape":
          if (open) setOpen(false);
          return;
        case "F9": {
          e.preventDefault();
          if (cart.items.length === 0) {
            toast.error("Cart is empty");
            return;
          }
          try {
            const bill = await billsStore.add({
              customerName: cart.customer.name || undefined,
              customerPhone: cart.customer.phone || undefined,
              customerNotes: cart.customer.notes || undefined,
              cashier: session?.name,
              paymentMethod: cart.paymentMethod,
              items: cart.items.map((i) => ({
                productId: i.product.id,
                name: i.product.name,
                price: i.product.price,
                costPrice: i.product.costPrice,
                qty: i.qty,
                taxPercent: i.product.taxPercent ?? 0,
              })),
              subtotal: cart.subtotal,
              tax: cart.tax,
              total: cart.total,
            });
            await Promise.all(
              cart.items.map((i) => productsStore.decrementStock(i.product.id, i.qty)),
            );
            cart.clear();
            toast.success(`Bill ${bill.number} generated`);
            navigate({ to: "/bills/$id", params: { id: bill.id } });
          } catch (err) {
            toast.error((err as Error).message || "Failed to generate bill");
          }
          return;
        }
        default:
          return;
      }
    };
    const openHandler = () => setOpen(true);

    window.addEventListener("keydown", handler);
    window.addEventListener("open-shortcuts", openHandler);

    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("open-shortcuts", openHandler);
    };
  }, [navigate, cart, open, routerState.location.pathname]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" /> Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>Marg-style quick keys for fast billing.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y rounded-lg border">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between px-3 py-2.5 text-sm">
              <span>{s.label}</span>
              <kbd className="rounded-md border bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Tip: shortcuts are disabled while typing in inputs.
        </p>
      </DialogContent>
    </Dialog>
  );
}
