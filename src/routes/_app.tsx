import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { useAuth } from "@/lib/auth-context";
import { SubscriptionProvider } from "@/lib/subscription-context";
import { SubscriptionGuard } from "@/components/subscription-guard";
import { toast } from "sonner";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (ready && !session) {
      navigate({ to: "/login" });
      return;
    }

    if (ready && session?.isEmployee) {
      const p = location.pathname;
      const isAllowed =
        p.startsWith("/sell") ||
        p.startsWith("/cart") ||
        p.startsWith("/inventory") ||
        p.startsWith("/bills");

      if (!isAllowed) {
        toast.error("Employee mode: Restricted to Inventory, Sales, and Bills.");
        navigate({ to: "/sell" });
      }
    }
  }, [ready, session, location.pathname, navigate]);

  if (!ready || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-soft">
        <div className="text-sm text-muted-foreground animate-pulse">Loading…</div>
      </div>
    );
  }

  return (
    <SubscriptionProvider>
      <SubscriptionGuard>
        <AppShell>
          <Outlet />
          <KeyboardShortcuts />
        </AppShell>
      </SubscriptionGuard>
    </SubscriptionProvider>
  );
}
