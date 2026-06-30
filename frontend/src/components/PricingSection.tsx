import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

const PLANS = [
  {
    name: "Starter",
    price: 99,
    desc: "For solo founders and small teams getting started.",
    features: [
      "Voice & text commands",
      "Marketing automation",
      "Customer reply bot",
      "Basic analytics",
      "50 AI actions/day",
    ],
    cta: "Start Starter",
    highlighted: false,
  },
  {
    name: "Business",
    price: 499,
    desc: "For growing companies that need a real COO.",
    features: [
      "Everything in Starter",
      "Full company operations",
      "Hiring & HR automation",
      "Slack & email integration",
      "Unlimited AI actions",
      "Priority support",
    ],
    cta: "Start Business",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: 5000,
    desc: "For organizations running at scale.",
    features: [
      "Everything in Business",
      "Custom AI training",
      "Dedicated success manager",
      "SSO & compliance",
      "API & MCP access",
      "SLA guarantee",
    ],
    cta: "Contact sales",
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 px-6 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Simple pricing. Massive ROI.</h2>
          <p className="text-text-2">
            Businesses pay monthly because it saves them time and money.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`p-8 rounded-2xl border flex flex-col ${
                plan.highlighted
                  ? "bg-accent/5 border-accent/40 glow-accent"
                  : "bg-surface border-border"
              }`}
            >
              {plan.highlighted && (
                <span className="text-xs font-medium text-accent mb-4">Most popular</span>
              )}
              <h3 className="text-xl font-semibold">{plan.name}</h3>
              <div className="mt-4 mb-2">
                <span className="text-4xl font-bold">${plan.price.toLocaleString()}</span>
                <span className="text-text-3">/month</span>
              </div>
              <p className="text-sm text-text-2 mb-6">{plan.desc}</p>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-text-2">
                    <Check size={16} className="text-success shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link href="/dashboard">
                <Button
                  variant={plan.highlighted ? "primary" : "secondary"}
                  className="w-full"
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-text-3 mt-8">
          10,000 customers × $500/month ≈ $5M/month revenue. KIB or WEYAY payments coming soon.
        </p>
      </div>
    </section>
  );
}
