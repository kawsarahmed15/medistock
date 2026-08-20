import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiRequest, setAuthToken, getAuthToken } from "./api-client";

export type Session = {
  userId: string;
  name: string;
  email: string;
  pharmacyName?: string;
  pharmacyPhone?: string;
  pharmacyAddress?: string;
  gstNumber?: string;
  drugLicNo?: string;
  billColor?: string;
  signature?: string;
  role?: string;
  accountStatus?: string;
  expiryDays?: number;
  lowStockQty?: number;
  defaultTax?: number;
};

type AuthCtx = {
  session: Session | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    name: string,
    email: string,
    password: string,
    pharmacyName?: string,
    role?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  requestEmailChange: (newEmail: string) => Promise<void>;
  confirmEmailChange: (token: string) => Promise<void>;
  updateSession: (patch: Partial<Session>) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          const res = await apiRequest<{ user: any }>("/auth/me", { auth: true });
          setSession({
            userId: res.user.id,
            name: res.user.name,
            email: res.user.email,
            pharmacyName: res.user.pharmacyName,
            pharmacyPhone: res.user.pharmacyPhone,
            pharmacyAddress: res.user.pharmacyAddress,
            gstNumber: res.user.gstNumber,
            drugLicNo: res.user.drugLicNo,
            billColor: res.user.billColor,
            signature: res.user.signature,
            role: res.user.role,
            accountStatus: res.user.accountStatus,
            expiryDays: res.user.expiryDays,
            lowStockQty: res.user.lowStockQty,
            defaultTax: res.user.defaultTax,
          });
        } catch {
          setAuthToken(null);
        }
      }
      setReady(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (!session) return;

    const INACTIVITY_LIMIT = 60 * 60 * 1000; // 1 hour
    const LAST_ACTIVE_KEY = "medistock.auth.lastActive";

    // Set initial activity timestamp
    localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());

    let lastWrite = Date.now();
    const updateActivity = () => {
      const now = Date.now();
      // Throttle localStorage writes to once every 10 seconds
      if (now - lastWrite > 10000) {
        localStorage.setItem(LAST_ACTIVE_KEY, now.toString());
        lastWrite = now;
      }
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart", "mousedown"];
    events.forEach((event) => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    const interval = setInterval(() => {
      // Sync logout across tabs if token was cleared elsewhere
      const token = getAuthToken();
      if (!token) {
        localStorage.removeItem(LAST_ACTIVE_KEY);
        setSession(null);
        window.location.href = "/login";
        return;
      }

      const lastActiveStr = localStorage.getItem(LAST_ACTIVE_KEY);
      if (lastActiveStr) {
        const lastActive = parseInt(lastActiveStr, 10);
        if (Date.now() - lastActive > INACTIVITY_LIMIT) {
          localStorage.removeItem(LAST_ACTIVE_KEY);
          setAuthToken(null);
          setSession(null);
          window.location.href = "/login?expired=1";
        }
      }
    }, 10000);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, updateActivity);
      });
      clearInterval(interval);
    };
  }, [session]);

  const value: AuthCtx = {
    session,
    ready,
    login: async (email, password) => {
      const res = await apiRequest<{ token: string; user: any }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setAuthToken(res.token);
      setSession({
        userId: res.user.id,
        name: res.user.name,
        email: res.user.email,
        pharmacyName: res.user.pharmacyName,
        pharmacyPhone: res.user.pharmacyPhone,
        pharmacyAddress: res.user.pharmacyAddress,
        gstNumber: res.user.gstNumber,
        drugLicNo: res.user.drugLicNo,
        billColor: res.user.billColor,
        signature: res.user.signature,
        role: res.user.role,
        accountStatus: res.user.accountStatus,
        expiryDays: res.user.expiryDays,
        lowStockQty: res.user.lowStockQty,
        defaultTax: res.user.defaultTax,
      });
    },
    signup: async (name, email, password, pharmacyName, role) => {
      await apiRequest("/auth/signup", {
        method: "POST",
        body: { name, email, password, pharmacyName, role },
      });
    },
    logout: async () => {
      localStorage.removeItem("medistock.auth.lastActive");
      setAuthToken(null);
      setSession(null);
    },
    requestPasswordReset: async (email) => {
      await apiRequest("/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
    },
    updatePassword: async (currentPassword, newPassword) => {
      await apiRequest("/auth/change-password", {
        method: "POST",
        body: { currentPassword, newPassword },
        auth: true,
      });
    },
    requestEmailChange: async (newEmail) => {
      await apiRequest("/auth/request-email-change", {
        method: "POST",
        body: { newEmail },
        auth: true,
      });
    },
    confirmEmailChange: async (token) => {
      await apiRequest("/auth/confirm-email-change", {
        method: "POST",
        body: { token },
      });
    },
    updateSession: (patch: Partial<Session>) => {
      if (session) setSession({ ...session, ...patch });
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
