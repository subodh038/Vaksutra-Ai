/**
 * lib/auth.ts — Auth helpers for VakSutra AI
 *
 * Wraps the backend /auth/* endpoints and manages JWT storage.
 * Tokens are stored in localStorage under well-known keys.
 */

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const KEYS = {
  access:  "access_token",
  refresh: "refresh_token",
  email:   "user_email",
  userId:  "user_id",
  name:    "user_name",
} as const;

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id:    string;
  email: string;
  name?: string;
}

export interface AuthTokens {
  access_token:  string;
  refresh_token: string;
  user_id:       string;
  email:         string;
  name?:         string;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

export function saveTokens(tokens: AuthTokens): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEYS.access,  tokens.access_token);
  localStorage.setItem(KEYS.refresh, tokens.refresh_token);
  localStorage.setItem(KEYS.email,   tokens.email);
  localStorage.setItem(KEYS.userId,  tokens.user_id);
  if (tokens.name) {
    localStorage.setItem(KEYS.name, tokens.name);
  } else {
    localStorage.removeItem(KEYS.name);
  }
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEYS.access);
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const id    = localStorage.getItem(KEYS.userId);
  const email = localStorage.getItem(KEYS.email);
  const name  = localStorage.getItem(KEYS.name);
  if (!id || !email) return null;
  return { id, email, name: name || undefined };
}

export function isLoggedIn(): boolean {
  return !!getAccessToken();
}

// ── Auth headers ──────────────────────────────────────────────────────────────

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function signup(
  email: string,
  password: string,
  name?: string,
  ref?: string
): Promise<AuthTokens> {
  const res = await fetch(`${API}/auth/signup`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ email, password, name, ref }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Signup failed." }));
    throw new Error(err.detail || "Signup failed.");
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const res = await fetch(`${API}/auth/login`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Invalid email or password." }));
    throw new Error(err.detail || "Invalid email or password.");
  }
  return res.json();
}

export async function logout(): Promise<void> {
  const token = getAccessToken();
  if (token) {
    // Best-effort server-side invalidation
    fetch(`${API}/auth/logout`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  clearTokens();
}

// ── OAuth helpers ─────────────────────────────────────────────────────────────

export function signInWithGoogle(): void {
  if (typeof window === "undefined") return;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dsdzwsblfzwllwddbhit.supabase.co";
  const redirectTo = encodeURIComponent(window.location.origin);
  window.location.href = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
}

export async function handleOAuthCallback(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash;
  if (!hash || !hash.includes("access_token")) return false;

  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token") || "";

  if (!accessToken) return false;

  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      saveTokens({
        access_token: accessToken,
        refresh_token: refreshToken,
        user_id: data.user_id,
        email: data.email,
        name: data.name || data.email?.split("@")[0],
      });
      window.history.replaceState(null, "", window.location.pathname);
      return true;
    }
  } catch (e) {
    console.error("OAuth callback processing failed:", e);
  }
  return false;
}

// ── Data fetchers (authenticated) ─────────────────────────────────────────────

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/**
 * Fired (instead of a hard page reload) when the refresh token is missing or
 * dead. The app listens for this and shows the login screen gracefully —
 * in-progress recordings and reports survive because nothing unmounts.
 */
export const SESSION_EXPIRED_EVENT = "vaksutra:session-expired";

function notifySessionExpired(): void {
  if (typeof window === "undefined") return;
  clearTokens();
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  let res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...authHeaders(),
    },
  });

  if (res.status === 401) {
    if (typeof window === "undefined") return res;

    const refreshToken = localStorage.getItem(KEYS.refresh);
    if (!refreshToken) {
      notifySessionExpired();
      return res;
    }

    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = fetch(`${API}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken })
      }).then(async r => {
        if (!r.ok) {
          notifySessionExpired();
          return null;
        }
        const tokens: AuthTokens = await r.json();
        saveTokens(tokens);
        return tokens.access_token;
      }).catch(() => {
        notifySessionExpired();
        return null;
      }).finally(() => {
        isRefreshing = false;
        refreshPromise = null; // allow a fresh refresh attempt on the next 401
      });
    }

    const newAccessToken = await refreshPromise;
    if (newAccessToken) {
      // Retry the original request with the new token
      res = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${newAccessToken}`,
        },
      });
      // If even the fresh token is rejected, the session is truly dead —
      // surface expiry instead of returning an opaque 401 response.
      if (res.status === 401) {
        notifySessionExpired();
      }
    } else {
      return res;
    }
  }

  return res;
}

export async function fetchSessions(limit = 20) {
  const res = await fetchWithAuth(`${API}/sessions?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch sessions.");
  return res.json();
}

export async function fetchProfile() {
  const res = await fetchWithAuth(`${API}/profile`);
  if (!res.ok) throw new Error("Failed to fetch profile.");
  return res.json();
}

