import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Pill, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
      toast.success("Check your email for the reset link");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
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

        {sent ? (
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold">Check your inbox</h2>
            <p className="text-sm text-muted-foreground">
              We sent a password reset link to <span className="font-medium">{email}</span>. Click
              the link to set a new password.
            </p>
            <Button variant="outline" asChild className="w-full">
              <Link to="/login">
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5" aria-label="Reset password">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Forgot password?</h2>
              <p className="text-sm text-muted-foreground">
                Enter your email and we'll send you a reset link.
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

            <Button type="submit" className="w-full shadow-soft" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              Remembered it?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
