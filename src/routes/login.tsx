import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login, session, ready } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && session) navigate({ to: "/dashboard" });
  }, [ready, session, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-gradient-soft">
      <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Pill className="h-5 w-5" />
          </div>
          <span className="font-semibold text-lg">MediStock</span>
        </div>
        <div className="space-y-3 animate-fade-in">
          <h1 className="text-4xl font-bold leading-tight">
            Run your pharmacy with calm, modern tools.
          </h1>
          <p className="text-primary-foreground/85 max-w-sm">
            Manage stock, expiries, and instant billing — all from one gentle, focused interface.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/70">
          © {new Date().getFullYear()} MediStock
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-sm space-y-5 animate-scale-in"
          aria-label="Sign in"
        >
          <div className="md:hidden flex items-center gap-2 mb-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Pill className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">MediStock</span>
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to continue to your dashboard.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@pharmacy.com"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                to="/forgot-password"
                className="text-xs text-primary font-medium hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" className="w-full shadow-soft" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            New here?{" "}
            <Link to="/signup" className="text-primary font-medium hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
