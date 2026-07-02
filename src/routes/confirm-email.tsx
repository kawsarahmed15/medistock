import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/confirm-email")({
  component: ConfirmEmailPage,
});

function ConfirmEmailPage() {
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") || "";
  }, []);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Confirming your new email...");
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token) {
        if (!mounted) return;
        setStatus("error");
        setMessage("Confirmation token is missing.");
        return;
      }

      try {
        const response = await apiRequest<{ message: string }>("/auth/confirm-email-change", {
          method: "POST",
          body: { token },
        });
        if (!mounted) return;
        setStatus("success");
        setMessage(response.message || "Email confirmed successfully.");
        // Log the user out so they can log in with the new email
        await logout();
      } catch (error) {
        if (!mounted) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Could not confirm email.");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [token, logout]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-soft p-6">
      <div className="w-full max-w-sm space-y-5 animate-scale-in bg-card p-8 rounded-2xl shadow-soft border text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center">
            <Pill className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold">MediStock</span>
        </div>

        {status === "loading" ? (
          <div className="text-sm text-muted-foreground">{message}</div>
        ) : status === "success" ? (
          <div className="space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <h1 className="text-2xl font-semibold">Email Confirmed</h1>
            <p className="text-sm text-muted-foreground">
              {message} Please log in with your new email.
            </p>
            <Button asChild className="w-full shadow-soft">
              <Link to="/login">Continue to sign in</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <CircleAlert className="h-10 w-10 text-amber-500 mx-auto" />
            <h1 className="text-2xl font-semibold">Confirmation failed</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Back to Login</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
