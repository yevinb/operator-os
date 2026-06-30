"use client";

import { useState } from "react";
import { Check, CreditCard } from "lucide-react";
import { getSession, setPlan, PLANS } from "@/lib/auth";
import { startCheckout, paymentsConfigured, getCheckoutUrl } from "@/lib/payments";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/types";

export default function BillingPage() {
  const user = getSession();
  const [currentPlan, setCurrentPlan] = useState(user?.plan ?? "starter");
  const [notice, setNotice] = useState<string | null>(null);

  const selectPlan = (planId: Plan) => {
    if (currentPlan === planId) return;

    const result = startCheckout(planId);
    if (result === "redirect") {
      setPlan(planId);
      setCurrentPlan(planId);
      setNotice("Checkout opened in a new tab. Your plan updates when payment completes.");
    } else if (getCheckoutUrl(planId)) {
      setNotice("Could not open checkout. Please try again.");
    } else {
      setNotice(
        planId === "enterprise"
          ? "Enterprise: email sales@operatoros.com to get started."
          : "Online checkout coming soon. Contact hello@operatoros.com to subscribe."
      );
    }
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Billing</h1>
      <p className="text-text-2 text-sm mb-4">
        Current plan: <span className="text-accent capitalize font-medium">{currentPlan}</span>
        <span className="ml-2 text-warning text-xs font-medium">· Free during beta</span>
      </p>
      <p className="text-sm text-text-3 mb-8">All features are unlocked. Billing activates when Stripe checkout is configured.</p>

      {notice && (
        <div className="mb-6 p-4 rounded-xl bg-accent/10 border border-accent/30 text-accent text-sm">
          {notice}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6 mb-10">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              "p-6 rounded-2xl border flex flex-col",
              currentPlan === plan.id
                ? "bg-accent/5 border-accent glow-accent"
                : "bg-surface border-border",
              "popular" in plan && plan.popular && currentPlan !== plan.id && "border-accent/20"
            )}
          >
            {"popular" in plan && plan.popular && (
              <span className="text-xs text-accent font-medium mb-2">Most popular</span>
            )}
            <h3 className="text-xl font-semibold">{plan.name}</h3>
            <div className="mt-3 mb-2">
              <span className="text-4xl font-bold">${plan.price}</span>
              <span className="text-text-3">/mo</span>
            </div>
            <p className="text-sm text-text-2 mb-5">{plan.desc}</p>
            <ul className="space-y-2 mb-6 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-text-2">
                  <Check size={14} className="text-success shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              variant={currentPlan === plan.id ? "secondary" : "primary"}
              className="w-full"
              onClick={() => selectPlan(plan.id)}
              disabled={currentPlan === plan.id}
            >
              {currentPlan === plan.id
                ? "Current plan"
                : getCheckoutUrl(plan.id)
                  ? `Subscribe — $${plan.price}/mo`
                  : `Upgrade to ${plan.name}`}
            </Button>
          </div>
        ))}
      </div>

      <div className="p-6 rounded-2xl bg-surface border border-border">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard size={20} className="text-accent" />
          <h3 className="font-semibold">Payment methods</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-surface-2 border border-border">
            <p className="font-medium">Card (Stripe)</p>
            <p className="text-sm text-text-3 mt-1">
              {paymentsConfigured() ? "Available at checkout" : "Configure Stripe links to go live"}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-surface-2 border border-border">
            <p className="font-medium">KIB & WEYAY</p>
            <p className="text-sm text-text-3 mt-1">Kuwait & Gulf local payments — on roadmap</p>
          </div>
        </div>
      </div>
    </div>
  );
}
