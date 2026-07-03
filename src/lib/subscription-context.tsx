import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { apiRequest, getAuthToken } from "./api-client";
import { useAuth } from "./auth-context";

export type SubscriptionPlan = {
  id: string;
  name: string;
  description: string;
  price: number;
  durationDays: number;
  trialDays: number;
  features: string[];
  sortOrder: number;
};

export type SubscriptionInfo = {
  id: string;
  status: "trial" | "active" | "expired" | "cancelled" | "none";
  planId: string;
  planName: string;
  planDescription: string;
  planPrice: number;
  planFeatures: string[];
  durationDays: number;
  startsAt: string;
  endsAt: string;
  trialEndsAt: string | null;
  daysRemaining: number;
  trialDaysRemaining: number;
  createdAt: string;
};

type SubscriptionCtx = {
  subscription: SubscriptionInfo | null;
  status: "loading" | "trial" | "active" | "expired" | "cancelled" | "none";
  plans: SubscriptionPlan[];
  daysRemaining: number;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
  fetchPlans: () => Promise<void>;
};

const Ctx = createContext<SubscriptionCtx | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [status, setStatus] = useState<SubscriptionCtx["status"]>("loading");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysRemaining, setDaysRemaining] = useState(0);

  const fetchSubscription = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setStatus("none");
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const res = await apiRequest<{
        subscription: SubscriptionInfo | null;
        hasSubscription: boolean;
        status: string;
      }>("/subscription/status", { auth: true });

      if (res.subscription) {
        setSubscription(res.subscription);
        setStatus(res.subscription.status as SubscriptionCtx["status"]);
        setDaysRemaining(res.subscription.daysRemaining);
      } else {
        setSubscription(null);
        setStatus("none");
        setDaysRemaining(0);
      }
    } catch {
      setSubscription(null);
      setStatus("none");
      setDaysRemaining(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await apiRequest<{ plans: SubscriptionPlan[] }>("/subscription/plans");
      setPlans(res.plans);
    } catch {
      setPlans([]);
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchSubscription();
      fetchPlans();
    } else {
      setStatus("loading");
      setSubscription(null);
      setLoading(true);
    }
  }, [session, fetchSubscription, fetchPlans]);

  const value: SubscriptionCtx = {
    subscription,
    status,
    plans,
    daysRemaining,
    loading,
    refreshSubscription: fetchSubscription,
    fetchPlans,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSubscription must be used inside SubscriptionProvider");
  return ctx;
}
