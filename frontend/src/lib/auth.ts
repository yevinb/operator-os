import type { Plan, User } from "./types";
import { apiFetch } from "./api";
import { initApiConfig } from "./api-config";
import { syncUserToProfile } from "./business-context";

const USER_KEY = "operatoros_user";
const SESSION_KEY = "operatoros_session";
const TOKEN_KEY = "operatoros_token";
const REMEMBER_KEY = "operatoros_remember_me";
const ONBOARDED_EMAILS_KEY = "nexa_onboarded_emails";

function isBrowser() {
  return typeof window !== "undefined";
}

/** Default true — stay signed in across browser restarts. */
export function getRememberMe(): boolean {
  if (!isBrowser()) return true;
  return localStorage.getItem(REMEMBER_KEY) !== "0";
}

export function setRememberMe(remember: boolean) {
  if (!isBrowser()) return;
  localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
}

function pickStorage(remember?: boolean): Storage {
  const usePersistent = remember ?? getRememberMe();
  return usePersistent ? localStorage : sessionStorage;
}

function clearAuthStorage() {
  if (!isBrowser()) return;
  for (const store of [localStorage, sessionStorage]) {
    store.removeItem(TOKEN_KEY);
    store.removeItem(SESSION_KEY);
    store.removeItem(USER_KEY);
  }
}

export function getToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, remember?: boolean) {
  if (!isBrowser()) return;
  if (remember !== undefined) setRememberMe(remember);
  clearAuthStorage();
  pickStorage(remember).setItem(TOKEN_KEY, token);
}

export function getSession(): User | null {
  if (!isBrowser()) return null;
  try {
    const raw =
      localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(user: User, remember?: boolean) {
  if (!isBrowser()) return;
  if (remember !== undefined) setRememberMe(remember);
  const store = pickStorage(remember);
  const json = JSON.stringify(user);
  store.setItem(SESSION_KEY, json);
  store.setItem(USER_KEY, json);
  syncUserToProfile(user);
}

export function persistAuth(token: string, user: User, remember = true) {
  setRememberMe(remember);
  clearAuthStorage();
  const store = pickStorage(remember);
  store.setItem(TOKEN_KEY, token);
  const json = JSON.stringify(user);
  store.setItem(SESSION_KEY, json);
  store.setItem(USER_KEY, json);
  syncUserToProfile(user);
}

export function clearSession() {
  clearAuthStorage();
}

function getOnboardedEmails(): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(ONBOARDED_EMAILS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markEmailOnboarded(email: string) {
  const key = email.toLowerCase().trim();
  if (!key) return;
  const list = getOnboardedEmails();
  if (!list.includes(key)) {
    localStorage.setItem(ONBOARDED_EMAILS_KEY, JSON.stringify([...list, key]));
  }
}

export function hasCompletedOnboardingLocally(email: string): boolean {
  return getOnboardedEmails().includes(email.toLowerCase().trim());
}

/** Restore onboarded flag from local memory or ensure Google users skip the wizard. */
export async function restoreOnboardingIfKnown(user: User): Promise<User> {
  if (user.onboarded) return user;
  if (!hasCompletedOnboardingLocally(user.email)) return user;
  const restored = await updateUser({ onboarded: true });
  const merged = restored || { ...user, onboarded: true };
  setSession(merged);
  return merged;
}

export function isAuthError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("not authenticated") ||
    m.includes("invalid token") ||
    m.includes("user not found") ||
    m.includes("session expired")
  );
}

/** Validate JWT against backend — clears session only on real auth failure. */
export async function validateSession(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;

  const cached = getSession();

  try {
    await initApiConfig();
    const base = (await import("./api-config")).getApiUrlSync();
    const res = await fetch(`${base}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      clearSession();
      return null;
    }

    if (!res.ok) {
      return cached;
    }

    const data = await res.json();
    const user = mapApiUser(data as Record<string, unknown>);
    setSession(user);
    return restoreOnboardingIfKnown(user);
  } catch {
    return cached;
  }
}

function mapApiUser(data: Record<string, unknown>): User {
  return {
    id: String(data.id),
    email: String(data.email),
    name: String(data.name),
    company: String(data.company),
    plan: (data.plan as Plan) || "starter",
    onboarded: Boolean(data.onboarded),
    createdAt: new Date().toISOString(),
    industry: String(data.industry || ""),
    goal: String(data.goal || ""),
    market: String(data.market || ""),
    niche_mode: String(data.niche_mode || "general"),
  };
}

export async function login(
  email: string,
  password: string,
  rememberMe = true
): Promise<User> {
  await initApiConfig();
  try {
    const data = await apiFetch<{ token: string; user: Record<string, unknown> }>(
      "/api/v1/auth/login",
      { method: "POST", body: JSON.stringify({ email: email.trim(), password }) }
    );
    const user = mapApiUser(data.user);
    persistAuth(data.token, user, rememberMe);
    return user;
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Login failed");
  }
}

export async function signup(
  email: string,
  name: string,
  company: string,
  password: string,
  rememberMe = true
): Promise<User> {
  await initApiConfig();
  try {
    const data = await apiFetch<{ token: string; user: Record<string, unknown> }>(
      "/api/v1/auth/signup",
      {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          company: company.trim(),
          password,
        }),
      }
    );
    const user = mapApiUser(data.user);
    persistAuth(data.token, user, rememberMe);
    return user;
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Signup failed");
  }
}

export async function updateUser(patch: Partial<User>) {
  const user = getSession();
  if (!user) return null;
  const updated = { ...user, ...patch };
  setSession(updated);

  if (getToken()) {
    try {
      await initApiConfig();
      await apiFetch("/api/v1/profile", {
        method: "PATCH",
        body: JSON.stringify({
          company: patch.company ?? updated.company,
          industry: patch.industry ?? updated.industry,
          goal: patch.goal ?? updated.goal,
          market: patch.market ?? updated.market,
          description: patch.description,
          website: patch.website,
          onboarded: patch.onboarded ?? updated.onboarded,
          plan: patch.plan ?? updated.plan,
          niche_mode: patch.niche_mode ?? updated.niche_mode,
        }),
      });
    } catch {
      // profile saved locally
    }
  }

  return updated;
}

export function setPlan(plan: Plan) {
  return updateUser({ plan });
}

export const PLANS = [
  {
    id: "starter" as Plan,
    name: "Starter",
    price: 99,
    desc: "Solo founders getting started.",
    features: ["Text commands", "12 integrations", "Stripe, Slack, n8n", "Real API execution"],
  },
  {
    id: "business" as Plan,
    name: "Business",
    price: 499,
    desc: "Growing companies that need a real COO.",
    features: ["Full company operations", "Hiring & HR", "Slack integration", "Unlimited AI actions", "Priority support"],
    popular: true,
  },
  {
    id: "enterprise" as Plan,
    name: "Enterprise",
    price: 5000,
    desc: "Organizations at scale.",
    features: ["Custom AI training", "Dedicated manager", "SSO & compliance", "API & MCP access", "SLA"],
  },
];
