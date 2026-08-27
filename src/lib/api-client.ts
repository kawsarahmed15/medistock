const TOKEN_KEY = "medistock.auth.token";

function getApiBase() {
  const envBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envBase && envBase.trim()) return envBase.replace(/\/$/, "");
  if (typeof window !== "undefined") return `${window.location.origin}/api`;
  return "/api";
}

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (!token) {
    window.localStorage.removeItem(TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(TOKEN_KEY, token);
}

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
};

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method || "GET";
  const headers = new Headers({
    "Content-Type": "application/json",
  });

  if (options.auth) {
    const token = getAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (typeof window !== "undefined") {
      const sessionId = window.localStorage.getItem("medistock.auth.sessionId");
      if (sessionId) {
        headers.set("X-Session-ID", sessionId);
      }
    }
  }

  const response = await fetch(`${getApiBase()}${path}`, {
    method,
    headers,
    body: options.body == null ? undefined : JSON.stringify(options.body),
  });

  const payload = (await response.json().catch(() => ({}))) as { message?: string } & T;
  if (!response.ok) {
    if (payload.message === "Session has been revoked") {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem("medistock.auth.lastActive");
        window.localStorage.removeItem("medistock.auth.sessionId");
        window.location.href = "/login?revoked=1";
      }
    }
    throw new Error(payload.message || "Request failed");
  }

  return payload;
}
