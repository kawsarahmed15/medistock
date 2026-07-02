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
