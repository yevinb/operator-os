import type { Plan, User } from "./types";
import { apiFetch } from "./api";
import { initApiConfig } from "./api-config";
import { syncUserToProfile } from "./business-context";

const USER_KEY = "operatoros_user";
const SESSION_KEY = "operatoros_session";
const TOKEN_KEY = "operatoros_token";

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
  };
}

export async function login(email: string, password: string): Promise<User> {
  await initApiConfig();
  try {
    const data = await apiFetch<{ token: string; user: Record<string, unknown> }>(
      "/api/v1/auth/login",
      { method: "POST", body: JSON.stringify({ email, password: password || "demo123" }) }
    );
    setToken(data.token);
    const user = mapApiUser(data.user);
    setSession(user);
    return user;
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Login failed");
  }
}

export async function signup(email: string, name: string, company: string, password = ""): Promise<User> {
  await initApiConfig();
  try {
    const data = await apiFetch<{ token: string; user: Record<string, unknown> }>(
      "/api/v1/auth/signup",
      { method: "POST", body: JSON.stringify({ email, name, company, password: password || "demo123" }) }
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
    features: ["Voice & text commands", "Marketing automation", "Customer replies", "50 AI actions/day"],
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
