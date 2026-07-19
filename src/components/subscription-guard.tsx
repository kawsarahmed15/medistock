import { type ReactNode, useState, useCallback } from "react";
import { useSubscription, type SubscriptionPlan } from "@/lib/subscription-context";
import { apiRequest } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Crown, Clock, AlertTriangle, Check, Sparkles, Shield, CreditCard, Zap } from "lucide-react";
import { toast } from "sonner";

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

function TrialBanner({ daysRemaining, trialEndsAt }: { daysRemaining: number; trialEndsAt: string | null }) {
  const endDate = trialEndsAt ? new Date(trialEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-amber-400/10 to-orange-500/10 border-b border-amber-500/20">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmNTllMGIiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptMC00di0yaDJ2MmgtMnptLTQgMHYtMmgydjJoLTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
      <div className="relative flex items-center justify-center gap-3 px-4 py-2.5">
        <Clock className="h-4 w-4 text-amber-500 shrink-0 animate-pulse" />
        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
          <span className="font-bold">{daysRemaining} day{daysRemaining !== 1 ? "s" : ""}</span> remaining in your free trial
          {endDate && <span className="text-amber-600/80 dark:text-amber-400/80"> · Ends {endDate}</span>}
        </p>
        <a
          href="/subscription"
          className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white transition-all hover:bg-amber-600 hover:scale-105 active:scale-95 shadow-sm"
        >
          <Crown className="h-3 w-3" />
          Upgrade Now
        </a>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  isPopular,
  onSubscribe,
  isLoading,
}: {
  plan: SubscriptionPlan;
  isPopular: boolean;
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
      className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${
        isPopular
          ? "border-emerald-500/50 bg-gradient-to-b from-emerald-500/5 to-emerald-600/10 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/20"
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
        disabled={isLoading}
        className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
          isPopular
            ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:from-emerald-600 hover:to-emerald-700"
            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
        }`}
      >
        {isLoading ? (
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
            Subscribe Now
          </span>
        )}
      </button>
    </div>
  );
}

function SubscriptionRequiredScreen() {
  const { plans, refreshSubscription } = useSubscription();
  const { session } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

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
        // Verify payment
        try {
          const verifyRes = await apiRequest<{ success: boolean; message: string }>("/subscription/verify-payment", {
            method: "POST",
            body: { orderId: res.orderId },
            auth: true,
          });

          if (verifyRes.success) {
            toast.success("Subscription activated! Welcome to MediStock.");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 mb-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Subscription Required
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-xl mx-auto">
            Your subscription has expired or is not active. Choose a plan below to continue using MediStock.
          </p>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 mb-10 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-emerald-500" /> Secure Payments
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-500" /> Instant Activation
          </span>
          <span className="flex items-center gap-1.5">
            <CreditCard className="h-4 w-4 text-blue-500" /> UPI, Cards & Netbanking
          </span>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, index) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isPopular={index === 1}
              onSubscribe={handleSubscribe}
              isLoading={loadingPlan === plan.id}
            />
          ))}
        </div>

        {plans.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No subscription plans available. Please contact support.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ExpiryBanner({ daysRemaining, endsAt }: { daysRemaining: number; endsAt: string | null }) {
  const endDate = endsAt ? new Date(endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-rose-500/10 via-rose-400/10 to-red-500/10 border-b border-rose-500/20">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNlMTFkNDgiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djJoLTJ2LTJoMnptMC00di0yaDJ2MmgtMnptLTQgMHYtMmgydjJoLTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
      <div className="relative flex items-center justify-center gap-3 px-4 py-2.5">
        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 animate-pulse" />
        <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
          <span className="font-bold">Your subscription is expiring in {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}</span>
          {endDate && <span className="text-rose-600/80 dark:text-rose-400/80"> · Expires {endDate}</span>}
        </p>
        <a
          href="/subscription"
          className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold text-white transition-all hover:bg-rose-600 hover:scale-105 active:scale-95 shadow-sm"
        >
          <Crown className="h-3 w-3" />
          Renew Now
        </a>
      </div>
    </div>
  );
}

export function SubscriptionGuard({ children }: { children: ReactNode }) {
  const { status, daysRemaining, subscription, loading } = useSubscription();

  // Don't block while loading
  if (loading || status === "loading") {
    return <>{children}</>;
  }

  // Active subscription — render normally, warning banner if expiring in <= 10 days
  if (status === "active") {
    if (daysRemaining <= 10) {
      return (
        <>
          <ExpiryBanner daysRemaining={daysRemaining} endsAt={subscription?.endsAt || null} />
          {children}
        </>
      );
    }
    return <>{children}</>;
  }

  // Trial — show banner + render children
  if (status === "trial") {
    return (
      <>
        <TrialBanner daysRemaining={daysRemaining} trialEndsAt={subscription?.trialEndsAt || null} />
        {children}
      </>
    );
  }

  // Expired, cancelled, or no subscription — show subscription page
  return <SubscriptionRequiredScreen />;
}
