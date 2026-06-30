import type { Plan } from "./types";

/** Stripe Payment Link URLs — set in .env.local to accept real payments. */
const CHECKOUT: Record<Plan, string> = {
  starter: process.env.NEXT_PUBLIC_STRIPE_STARTER_URL ?? "",
  business: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_URL ?? "",
  enterprise: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_URL ?? "",
};

export function getCheckoutUrl(plan: Plan): string | null {
  const url = CHECKOUT[plan]?.trim();
  return url || null;
}

export function startCheckout(plan: Plan): "redirect" | "contact" {
  const url = getCheckoutUrl(plan);
  if (url) {
    window.open(url, "_blank", "noopener,noreferrer");
    return "redirect";
  }
  if (plan === "enterprise") {
    window.location.href = "mailto:sales@nexa.com?subject=Nexa%20Enterprise";
    return "contact";
  }
  return "contact";
}

export function paymentsConfigured(): boolean {
  return Object.values(CHECKOUT).some((url) => url.trim().length > 0);
}
