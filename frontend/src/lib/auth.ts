import type { Plan, User } from "./types";
import { apiFetch } from "./api";
import { initApiConfig } from "./api-config";
import { syncUserToProfile } from "./business-context";

const USER_KEY = "operatoros_user";
const SESSION_KEY = "operatoros_session";
const TOKEN_KEY = "operatoros_token";
const ONBOARDED_EMAILS_KEY = "nexa_onboarded_emails";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getSession(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(user: User) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  syncUserToProfile(user);
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

function getOnboardedEmails(): string[] {
  if (typeof window === "undefined") return [];
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

/** If this Google/email user finished onboarding before, restore server flag. */
export async function restoreOnboardingIfKnown(user: User): Promise<User> {
  if (user.onboarded || !hasCompletedOnboardingLocally(user.email)) return user;
  const restored = await updateUser({ onboarded: true });
  return restored || { ...user, onboarded: true };
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

/** Validate JWT against backend — clears stale sessions after Railway DB resets. */
export async function validateSession(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;
  try {
    await initApiConfig();
    const data = await apiFetch<Record<string, unknown>>("/api/v1/auth/me");
    const user = mapApiUser(data);
    setSession(user);
    return restoreOnboardingIfKnown(user);
  } catch {
    clearSession();
    return null;
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

export async function login(email: string, password: string): Promise<User> {
  await initApiConfig();
  try {
    const data = await apiFetch<{ token: string; user: Record<string, unknown> }>(
      "/api/v1/auth/login",
      { method: "POST", body: JSON.stringify({ email: email.trim(), password }) }
    );
    setToken(data.token);
    const user = mapApiUser(data.user);
    setSession(user);
    return user;
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Login failed");
  }
}

export async function signup(email: string, name: string, company: string, password: string): Promise<User> {
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
    setToken(data.token);
    const user = mapApiUser(data.user);
    setSession(user);
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
