import { Target, TrendingUp, Users, Zap } from "lucide-react";
import { CUSTOMERS_FOR_30M, MRR_TARGET, VALUATION_TARGET } from "@/lib/valuation";

export function ValuationSection() {
  return (
    <section id="vision" className="py-20 px-6 border-t border-border">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-accent text-sm font-medium uppercase tracking-widest mb-3">
            The $30M path
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Build a company, not an app
          </h2>
          <p className="text-text-2 max-w-2xl mx-auto">
            A $30M SaaS company needs ~$3M ARR. That&apos;s {CUSTOMERS_FOR_30M} customers paying $500/month.
            OperatorOS is the engine that gets you there — one command at a time.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            {
              icon: Users,
              title: `${CUSTOMERS_FOR_30M} paying customers`,
              desc: "At $499/mo Business plan. Each small business gets an AI COO they can't live without.",
            },
            {
              icon: TrendingUp,
              title: `$${(MRR_TARGET / 1000).toFixed(0)}K MRR`,
              desc: "Monthly recurring revenue. Compounds every month. Churn is the enemy — retention is the moat.",
            },
            {
              icon: Target,
              title: `$${(VALUATION_TARGET / 1_000_000).toFixed(0)}M valuation`,
              desc: "10× ARR multiple. Standard for growing B2B SaaS with strong retention and defensibility.",
            },
          ].map((item) => (
            <div key={item.title} className="p-6 rounded-2xl bg-surface border border-border text-center">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <item.icon size={22} className="text-accent" />
              </div>
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-text-2">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="p-6 rounded-2xl bg-surface-2 border border-border">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Zap size={18} className="text-accent" />
            What makes OperatorOS worth $30M (not another AI wrapper)
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-text-2">
            {[
              "Autonomous execution — it DOES the work, not just suggests",
              "Monthly recurring revenue — businesses pay because it saves time & money",
              "Defensible integrations — n8n, MCP, Stripe, Slack become the moat",
              "Compounding AI memory — gets smarter every month per customer",
              "Repeatable sales — one painful problem: running a business alone",
              "Global expansion — Kuwait (KIB/WEYAY) → Gulf → worldwide",
            ].map((point) => (
              <div key={point} className="flex items-start gap-2">
                <span className="text-success mt-0.5">✓</span>
                {point}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
