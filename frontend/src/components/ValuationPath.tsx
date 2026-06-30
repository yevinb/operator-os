"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Target, Users, DollarSign } from "lucide-react";
import {
  getCompanyProgress,
  VALUATION_TARGET,
  CUSTOMERS_FOR_30M,
  MILESTONES,
  formatMoney,
  type CompanyProgress,
} from "@/lib/valuation";
import { cn } from "@/lib/utils";

export function ValuationPath() {
  const [progress, setProgress] = useState<CompanyProgress | null>(null);

  useEffect(() => {
    setProgress(getCompanyProgress());
    const interval = setInterval(() => setProgress(getCompanyProgress()), 2000);
    return () => clearInterval(interval);
  }, []);

  if (!progress) return null;

  const nextMilestone = MILESTONES.find((m) => progress.mrr < m.mrr) ?? MILESTONES[MILESTONES.length - 1];

  return (
    <section className="p-6 rounded-2xl bg-gradient-to-br from-accent/10 via-surface to-surface border border-accent/20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs text-accent uppercase tracking-widest font-medium mb-1">
            North star
          </p>
          <h2 className="text-xl font-bold">Path to $30M company</h2>
          <p className="text-sm text-text-2 mt-1">
            Every command your AI runs compounds toward real business value.
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-accent">{progress.percentToTarget.toFixed(1)}%</p>
          <p className="text-xs text-text-3">of $30M target</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-3 rounded-full bg-surface-2 overflow-hidden mb-6">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-bright transition-all duration-700"
          style={{ width: `${Math.max(2, progress.percentToTarget)}%` }}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat icon={DollarSign} label="MRR" value={formatMoney(progress.mrr)} sub={`Target: ${formatMoney(250_000)}`} />
        <Stat icon={Users} label="Customers" value={String(progress.customers)} sub={`Target: ${CUSTOMERS_FOR_30M}`} />
        <Stat icon={TrendingUp} label="ARR" value={formatMoney(progress.arr)} sub="Annual recurring" />
        <Stat icon={Target} label="Est. valuation" value={formatMoney(progress.estimatedValuation)} sub={`Goal: $30M`} />
      </div>

      {/* Milestones */}
      <div className="grid md:grid-cols-4 gap-2">
        {MILESTONES.map((m) => {
          const reached = progress.estimatedValuation >= m.valuation;
          return (
            <div
              key={m.label}
              className={cn(
                "p-3 rounded-xl border text-center",
                reached ? "border-success/40 bg-success/5" : "border-border bg-surface/50"
              )}
            >
              <p className={cn("text-xs font-medium", reached ? "text-success" : "text-text-3")}>
                {reached ? "✓ " : ""}{m.label}
              </p>
              <p className="text-sm font-semibold mt-1">{formatMoney(m.valuation)}</p>
              <p className="text-xs text-text-3">{m.customers} customers</p>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-text-3 mt-4 text-center">
        Next milestone: <span className="text-text-2">{nextMilestone.label}</span> at {formatMoney(nextMilestone.mrr)} MRR
        · {CUSTOMERS_FOR_30M} customers × $500/mo = $30M company
      </p>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-surface/80 border border-border">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-accent" />
        <span className="text-xs text-text-3">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-text-3">{sub}</p>
    </div>
  );
}
