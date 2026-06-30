import type { BusinessContext, User } from "./types";
import { getSession } from "./auth";

const PROFILE_KEY = "operatoros_business_profile";

export function getBusinessContext(): BusinessContext {
  const user = getSession();
  if (typeof window === "undefined") {
    return { company: "", industry: "", goal: "", market: "" };
  }
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    return {
      company: user?.company || stored.company || "",
      industry: user?.industry || stored.industry || "",
      goal: user?.goal || stored.goal || "",
      market: user?.market || stored.market || "",
      description: user?.description || stored.description || "",
      website: user?.website || stored.website || "",
      connectedIntegrations: stored.connectedIntegrations || [],
    };
  } catch {
    return {
      company: user?.company || "",
      industry: user?.industry || "",
      goal: user?.goal || "",
      market: user?.market || "",
    };
  }
}

export function saveBusinessProfile(patch: Partial<BusinessContext> & { connectedIntegrations?: string[] }) {
  const current = getBusinessContext();
  const updated = { ...current, ...patch };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
  return updated;
}

export function syncUserToProfile(user: User) {
  saveBusinessProfile({
    company: user.company,
    industry: user.industry || "",
    goal: user.goal || "",
    market: user.market || "",
    description: user.description || "",
    website: user.website || "",
  });
}
