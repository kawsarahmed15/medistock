import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api-client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const t = url.searchParams.get("token");
      if (t) {
        setToken(t);
        setHasToken(true);
      }
    }
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await apiRequest("/auth/reset-password", {
        method: "POST",
        body: { token, newPassword: password },
      });
      toast.success("Password updated — please sign in");
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-soft p-6">
      <div className="w-full max-w-sm space-y-5 animate-scale-in bg-card p-8 rounded-2xl shadow-soft border">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center">
            <Pill className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold">MediStock</span>
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Set a new password</h2>
          <p className="text-sm text-muted-foreground">
            {hasToken
              ? "Choose a strong password you haven't used before."
              : "Waiting for the reset link to be verified…"}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              disabled={!hasToken}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={!hasToken}
            />
          </div>

          <Button
            type="submit"
            className="w-full shadow-soft"
            disabled={loading || !hasToken}
          >
            {loading ? "Updating…" : "Update password"}
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            <Link to="/login" className="text-primary font-medium hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
