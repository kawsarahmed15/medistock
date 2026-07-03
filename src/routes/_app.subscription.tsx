import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useSubscription, type SubscriptionPlan } from "@/lib/subscription-context";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Crown,
  Check,
  Clock,
  CreditCard,
  Shield,
  Sparkles,
  Zap,
  Calendar,
  Receipt,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Timer,
  AlertCircle,
} from "lucide-react";

declare global {
  interface Window {
    Cashfree?: (config: { mode: string }) => {
      checkout: (config: { paymentSessionId: string; returnUrl?: string }) => Promise<{
        error?: { message: string };
        paymentDetails?: unknown;
      }>;
    };
  }
}

type PaymentRecord = {
  id: string;
  orderId: string;
  paymentId: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  planName: string;
  createdAt: string;
};

export const Route = createFileRoute("/_app/subscription")({
  component: SubscriptionPage,
  validateSearch: (search: Record<string, unknown>) => ({
    order_id: (search.order_id as string) || undefined,
  }),
});

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    active: {
      bg: "bg-emerald-500/10 border-emerald-500/30",
      text: "text-emerald-600 dark:text-emerald-400",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    trial: {
      bg: "bg-amber-500/10 border-amber-500/30",
      text: "text-amber-600 dark:text-amber-400",
      icon: <Timer className="h-3.5 w-3.5" />,
    },
    expired: {
      bg: "bg-red-500/10 border-red-500/30",
      text: "text-red-600 dark:text-red-400",
      icon: <XCircle className="h-3.5 w-3.5" />,
    },
    cancelled: {
      bg: "bg-gray-500/10 border-gray-500/30",
      text: "text-gray-600 dark:text-gray-400",
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
    none: {
      bg: "bg-gray-500/10 border-gray-500/30",
      text: "text-gray-600 dark:text-gray-400",
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
  };

  const v = variants[status] || variants.none;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${v.bg} ${v.text}`}>
      {v.icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    failed: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
    refunded: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colors[status] || colors.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function PlanCard({
  plan,
  isPopular,
  isCurrent,
  onSubscribe,
  isLoading,
}: {
  plan: SubscriptionPlan;
  isPopular: boolean;
  isCurrent: boolean;
  onSubscribe: (planId: string) => void;
  isLoading: boolean;
}) {
  const pricePerMonth = plan.durationDays >= 365
    ? Math.round(plan.price / 12)
    : plan.durationDays >= 90
      ? Math.round(plan.price / 3)
      : plan.price;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-300 hover:scale-[1.02] ${
        isPopular
          ? "border-emerald-500/50 bg-gradient-to-b from-emerald-500/5 to-emerald-600/10 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/20"
          : isCurrent
            ? "border-primary/50 bg-primary/5 shadow-lg ring-1 ring-primary/20"
            : "border-border/50 bg-card/50 shadow-lg hover:border-primary/30"
      }`}
      style={{ backdropFilter: "blur(12px)" }}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-1 text-xs font-bold text-white shadow-lg shadow-emerald-500/25">
            <Sparkles className="h-3 w-3" />
            Most Popular
          </span>
        </div>
      )}

      {isCurrent && (
        <div className="absolute -top-3 right-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-lg">
            <Crown className="h-3 w-3" />
            Current Plan
          </span>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-extrabold text-foreground">₹{plan.price.toLocaleString("en-IN")}</span>
          <span className="text-sm text-muted-foreground">
            / {plan.durationDays >= 365 ? "year" : plan.durationDays >= 90 ? "quarter" : "month"}
          </span>
        </div>
        {plan.durationDays > 30 && (
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            ₹{pricePerMonth}/month
          </p>
        )}
      </div>

      <ul className="mb-6 flex-1 space-y-2.5">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Check className={`h-4 w-4 shrink-0 mt-0.5 ${isPopular ? "text-emerald-500" : "text-primary"}`} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSubscribe(plan.id)}
        disabled={isLoading || isCurrent}
        className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
          isCurrent
            ? "bg-muted text-muted-foreground cursor-default"
            : isPopular
              ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:from-emerald-600 hover:to-emerald-700"
              : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
        }`}
      >
        {isCurrent ? (
          <span className="flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Current Plan
          </span>
        ) : isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <CreditCard className="h-4 w-4" />
            {isCurrent ? "Current Plan" : "Subscribe Now"}
          </span>
        )}
      </button>
    </div>
  );
}

function SubscriptionPage() {
  const { subscription, status, plans, refreshSubscription, loading } = useSubscription();
  const { session } = useAuth();
  const search = useSearch({ from: "/_app/subscription" });
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // Verify payment if returning from Cashfree
  useEffect(() => {
    const orderId = search.order_id;
    if (orderId) {
      (async () => {
        try {
          const res = await apiRequest<{ success: boolean; message: string }>("/subscription/verify-payment", {
            method: "POST",
            body: { orderId },
            auth: true,
          });
          if (res.success) {
            toast.success("Payment successful! Your subscription is now active.");
            await refreshSubscription();
          } else {
            toast.error(res.message || "Payment could not be verified.");
          }
        } catch {
          toast.error("Could not verify payment status.");
        }
        // Clean up URL
        window.history.replaceState({}, "", "/subscription");
      })();
    }
  }, [search.order_id, refreshSubscription]);

  // Fetch payment history
  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest<{ payments: PaymentRecord[] }>("/subscription/payments", { auth: true });
        setPayments(res.payments);
      } catch {
        setPayments([]);
      } finally {
        setLoadingPayments(false);
      }
    })();
  }, []);

  const handleSubscribe = useCallback(async (planId: string) => {
    if (!session) return;
    setLoadingPlan(planId);

    try {
      const res = await apiRequest<{ paymentSessionId: string; orderId: string }>("/subscription/create-order", {
        method: "POST",
        body: { planId },
        auth: true,
      });

      if (!window.Cashfree) {
        toast.error("Payment gateway not loaded. Please refresh the page.");
        return;
      }

      const cashfree = window.Cashfree({ mode: "sandbox" });
      const result = await cashfree.checkout({
        paymentSessionId: res.paymentSessionId,
        returnUrl: `${window.location.origin}/subscription?order_id=${res.orderId}`,
      });

      if (result.error) {
        toast.error(result.error.message || "Payment failed");
      } else {
        try {
          const verifyRes = await apiRequest<{ success: boolean; message: string }>("/subscription/verify-payment", {
            method: "POST",
            body: { orderId: res.orderId },
            auth: true,
          });

          if (verifyRes.success) {
            toast.success("Subscription activated successfully!");
            await refreshSubscription();
          } else {
            toast.error(verifyRes.message || "Payment verification failed");
          }
        } catch {
          toast.error("Could not verify payment. Please check your subscription status.");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to initiate payment";
      toast.error(msg);
    } finally {
      setLoadingPlan(null);
    }
  }, [session, refreshSubscription]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-sm text-muted-foreground animate-pulse">Loading subscription details…</div>
      </div>
    );
  }

  const endsAtFormatted = subscription?.endsAt
    ? new Date(subscription.endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "—";

  const startsAtFormatted = subscription?.startsAt
    ? new Date(subscription.startsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "—";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
          <Crown className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscription</h1>
          <p className="text-sm text-muted-foreground">Manage your MediStock subscription and billing</p>
        </div>
      </div>

      {/* Current Subscription Card */}
      <div className="rounded-2xl border border-border/50 bg-card/50 p-6 shadow-lg" style={{ backdropFilter: "blur(12px)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-lg font-semibold text-foreground">Current Subscription</h2>
              <StatusBadge status={status === "loading" ? "none" : status} />
            </div>
            {subscription ? (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Plan: <span className="font-semibold text-foreground">{subscription.planName}</span>
                </p>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Started: {startsAtFormatted}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Ends: {endsAtFormatted}
                  </span>
                  {subscription.daysRemaining > 0 && (
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <ArrowRight className="h-3.5 w-3.5" />
                      {subscription.daysRemaining} day{subscription.daysRemaining !== 1 ? "s" : ""} remaining
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">You don't have an active subscription.</p>
            )}
          </div>

          {(status === "trial" || status === "expired" || status === "none") && (
            <a
              href="#plans"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:from-emerald-600 hover:to-emerald-700 active:scale-95 shrink-0"
            >
              <Crown className="h-4 w-4" />
              {status === "trial" ? "Upgrade Now" : "Subscribe"}
            </a>
          )}
        </div>
      </div>

      {/* Plans Section */}
      <div id="plans">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-xl font-bold text-foreground">Available Plans</h2>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-emerald-500" /> Secure Payments
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> Instant Activation
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, index) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isPopular={index === 1}
              isCurrent={subscription?.planId === plan.id && (status === "active" || status === "trial")}
              onSubscribe={handleSubscribe}
              isLoading={loadingPlan === plan.id}
            />
          ))}
        </div>
      </div>

      {/* Payment History */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Receipt className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-bold text-foreground">Payment History</h2>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/50 shadow-lg overflow-hidden" style={{ backdropFilter: "blur(12px)" }}>
          {loadingPayments ? (
            <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
              Loading payment history…
            </div>
          ) : payments.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No payments found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Plan</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Method</th>
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Order ID</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border/30 last:border-0 hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{p.planName}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        ₹{p.amount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.paymentMethod || "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{p.orderId || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
