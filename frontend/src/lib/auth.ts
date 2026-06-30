import type { User, Plan } from "./types";

const USER_KEY = "operatoros_user";
const SESSION_KEY = "operatoros_session";

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
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_KEY);
}

export function login(email: string, _password: string): User {
  const existing = getSession();
  if (existing?.email === email) return existing;

  const user: User = {
    id: `user_${Date.now()}`,
    email,
    name: email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    company: "My Company",
    plan: "business",
    onboarded: true,
    createdAt: new Date().toISOString(),
  };
  setSession(user);
  return user;
}

export function signup(email: string, name: string, company: string): User {
  const user: User = {
    id: `user_${Date.now()}`,
    email,
    name,
    company,
    plan: "starter",
    onboarded: false,
    createdAt: new Date().toISOString(),
  };
  setSession(user);
  return user;
}

export function updateUser(patch: Partial<User>) {
  const user = getSession();
  if (!user) return null;
  const updated = { ...user, ...patch };
  setSession(updated);
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
