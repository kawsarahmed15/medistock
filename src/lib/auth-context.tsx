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
  isEmployee?: boolean;
  employeeId?: string;
  employeeName?: string;
  hasEmployeePassword?: boolean;
  isEmployeeEnabled?: boolean;
  accountStatus?: string;
  expiryDays?: number;
  lowStockQty?: number;
  defaultTax?: number;
};

type AuthCtx = {
  session: Session | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<Session>;
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
  setEmployeePassword: (password: string, isEnabled?: boolean) => Promise<void>;
  toggleEmployeeStatus: (isEnabled: boolean) => Promise<void>;
  removeEmployeePassword: () => Promise<void>;
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
            isEmployee: Boolean(res.user.isEmployee),
            employeeId: res.user.employeeId,
            employeeName: res.user.employeeName,
            hasEmployeePassword: Boolean(res.user.hasEmployeePassword),
            isEmployeeEnabled: Boolean(res.user.isEmployeeEnabled),
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

    // Session registration
    const generateUUID = () => {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
      return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };

    const getOrCreateDeviceId = () => {
      let deviceId = localStorage.getItem("medistock.auth.deviceId");
      if (!deviceId) {
        deviceId = generateUUID();
        localStorage.setItem("medistock.auth.deviceId", deviceId);
      }
      return deviceId;
    };

    let sessionId = localStorage.getItem("medistock.auth.sessionId");
    if (!sessionId) {
      sessionId = generateUUID();
      localStorage.setItem("medistock.auth.sessionId", sessionId);
    }

    const handleLogout = () => {
      localStorage.removeItem(LAST_ACTIVE_KEY);
      localStorage.removeItem("medistock.auth.sessionId");
      setAuthToken(null);
      setSession(null);
      window.location.href = "/login?revoked=1";
    };

    let lastUserActivity = Date.now();

    const registerSession = async () => {
      try {
        const ua = navigator.userAgent;
        let os = "Unknown OS";
        let browser = "Unknown Browser";

        if (ua.indexOf("Win") !== -1) os = "Windows";
        else if (ua.indexOf("Mac") !== -1) os = "macOS";
        else if (ua.indexOf("Linux") !== -1) os = "Linux";
        else if (ua.indexOf("Android") !== -1) os = "Android";
        else if (ua.indexOf("like Mac") !== -1) os = "iOS";

        if (ua.indexOf("Firefox") !== -1) browser = "Firefox";
        else if (ua.indexOf("SamsungBrowser") !== -1) browser = "Samsung Internet";
        else if (ua.indexOf("Opera") !== -1 || ua.indexOf("OPR") !== -1) browser = "Opera";
        else if (ua.indexOf("Edge") !== -1 || ua.indexOf("Edg") !== -1) browser = "Edge";
        else if (ua.indexOf("Chrome") !== -1) browser = "Chrome";
        else if (ua.indexOf("Safari") !== -1) browser = "Safari";

        const isUserActive = (Date.now() - lastUserActivity) < 2 * 60 * 1000;

        await apiRequest("/auth/session", {
          method: "POST",
          body: {
            sessionId,
            deviceId: getOrCreateDeviceId(),
            deviceOs: os,
            deviceBrowser: browser,
            isUserActive,
          },
          auth: true,
        });
      } catch (err: any) {
        console.error("Failed to register session:", err);
        if (err instanceof Error && err.message === "Session has been revoked") {
          handleLogout();
        }
      }
    };

    registerSession();
    let lastServerCheckin = Date.now();

    // Set initial activity timestamp
    localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());

    let lastWrite = Date.now();
    const updateActivity = () => {
      const now = Date.now();
      lastUserActivity = now;
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
        } else if (Date.now() - lastServerCheckin > 30 * 1000) {
          registerSession();
          lastServerCheckin = Date.now();
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
      const generateUUID = () => {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
          return crypto.randomUUID();
        }
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      };
      const sessionId = generateUUID();
      localStorage.setItem("medistock.auth.sessionId", sessionId);

      let deviceId = localStorage.getItem("medistock.auth.deviceId");
      if (!deviceId) {
        deviceId = generateUUID();
        localStorage.setItem("medistock.auth.deviceId", deviceId);
      }

      const ua = navigator.userAgent;
      let os = "Unknown OS";
      let browser = "Unknown Browser";

      if (ua.indexOf("Win") !== -1) os = "Windows";
      else if (ua.indexOf("Mac") !== -1) os = "macOS";
      else if (ua.indexOf("Linux") !== -1) os = "Linux";
      else if (ua.indexOf("Android") !== -1) os = "Android";
      else if (ua.indexOf("like Mac") !== -1) os = "iOS";

      if (ua.indexOf("Firefox") !== -1) browser = "Firefox";
      else if (ua.indexOf("SamsungBrowser") !== -1) browser = "Samsung Internet";
      else if (ua.indexOf("Opera") !== -1 || ua.indexOf("OPR") !== -1) browser = "Opera";
      else if (ua.indexOf("Edge") !== -1 || ua.indexOf("Edg") !== -1) browser = "Edge";
      else if (ua.indexOf("Chrome") !== -1) browser = "Chrome";
      else if (ua.indexOf("Safari") !== -1) browser = "Safari";

      const res = await apiRequest<{ token: string; user: any }>("/auth/login", {
        method: "POST",
        body: {
          email,
          password,
          sessionId,
          deviceId,
          deviceOs: os,
          deviceBrowser: browser,
        },
      });
      setAuthToken(res.token);
      const newSession: Session = {
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
        isEmployee: Boolean(res.user.isEmployee),
        employeeId: res.user.employeeId,
        employeeName: res.user.employeeName,
        hasEmployeePassword: Boolean(res.user.hasEmployeePassword),
        isEmployeeEnabled: Boolean(res.user.isEmployeeEnabled),
        accountStatus: res.user.accountStatus,
        expiryDays: res.user.expiryDays,
        lowStockQty: res.user.lowStockQty,
        defaultTax: res.user.defaultTax,
      };
      setSession(newSession);
      return newSession;
    },
    signup: async (name, email, password, pharmacyName, role) => {
      await apiRequest("/auth/signup", {
        method: "POST",
        body: { name, email, password, pharmacyName, role },
      });
    },
    logout: async () => {
      const sessionId = localStorage.getItem("medistock.auth.sessionId");
      if (sessionId) {
        try {
          await apiRequest(`/auth/sessions/${sessionId}`, { method: "DELETE", auth: true });
        } catch (err) {
          console.error("Failed to delete session on logout:", err);
        }
      }
      localStorage.removeItem("medistock.auth.lastActive");
      localStorage.removeItem("medistock.auth.sessionId");
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
    setEmployeePassword: async (password, isEnabled = true) => {
      await apiRequest("/auth/employee-password", {
        method: "POST",
        body: { employeePassword: password, isEnabled },
        auth: true,
      });
      if (session) {
        setSession({ ...session, hasEmployeePassword: true, isEmployeeEnabled: isEnabled });
      }
    },
    toggleEmployeeStatus: async (isEnabled) => {
      await apiRequest("/auth/employee-status", {
        method: "PATCH",
        body: { isEnabled },
        auth: true,
      });
      if (session) {
        setSession({ ...session, isEmployeeEnabled: isEnabled });
      }
    },
    removeEmployeePassword: async () => {
      await apiRequest("/auth/employee-password", {
        method: "DELETE",
        auth: true,
      });
      if (session) {
        setSession({ ...session, hasEmployeePassword: false, isEmployeeEnabled: false });
      }
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
