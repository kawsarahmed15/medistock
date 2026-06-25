import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && !session) {
      navigate({ to: "/login" });
    }
  }, [ready, session, navigate]);

  if (!ready || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-soft">
        <div className="text-sm text-muted-foreground animate-pulse">Loading…</div>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
      <KeyboardShortcuts />
    </AppShell>
  );
}
