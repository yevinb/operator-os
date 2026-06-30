"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Target, Users, DollarSign, Zap } from "lucide-react";
import {
  getCompanyProgress,
  VALUATION_TARGET,
  CUSTOMERS_FOR_30M,
  MILESTONES,
  formatMoney,
  type CompanyProgress,
} from "@/lib/valuation";

export function ValuationPath() {
  const [progress, setProgress] = useState<CompanyProgress | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setProgress(getCompanyProgress());
    const interval = setInterval(() => {
      setProgress(getCompanyProgress());
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!progress) return null;

  return (
    <section className={`rounded-3xl overflow-hidden border-2 border-gold/40 transition-all duration-500 ${pulse ? "glow-gold" : ""}`}>
      {/* Header band */}
      <div className="bg-gradient-to-r from-gold/20 via-amber-500/10 to-blue-500/20 px-6 py-5 border-b border-gold/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-gold text-xs font-black uppercase tracking-[0.25em] mb-1">
              ★ North Star
            </p>
            <h2 className="text-2xl md:text-3xl font-black text-white">
              Path to <span className="gradient-gold">$30 Million</span>
            </h2>
          </div>
          <div className="text-right">
            <p className={`text-5xl font-black text-gold animate-count`}>
              {progress.percentToTarget.toFixed(1)}%
            </p>
            <p className="text-xs text-text-3">of $30M target</p>
          </div>
        </div>
      </div>

      <div className="p-6 bg-surface/80">
        {/* Progress bar */}
        <div className="h-4 rounded-full bg-black/50 overflow-hidden mb-6 border border-white/10">
          <div
            className="h-full rounded-full progress-shine transition-all duration-1000"
            style={{ width: `${Math.max(3, progress.percentToTarget)}%` }}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Stat icon={DollarSign} label="MRR" value={formatMoney(progress.mrr)} target={formatMoney(250_000)} />
          <Stat icon={Users} label="Customers" value={String(progress.customers)} target={String(CUSTOMERS_FOR_30M)} />
          <Stat icon={TrendingUp} label="ARR" value={formatMoney(progress.arr)} target={formatMoney(3_000_000)} />
          <Stat icon={Target} label="Valuation" value={formatMoney(progress.estimatedValuation)} target="$30M" highlight />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {MILESTONES.map((m) => {
            const reached = progress.estimatedValuation >= m.valuation;
            return (
              <div
                key={m.label}
                className={`p-3 rounded-xl text-center border ${
                  reached
                    ? "border-success/50 bg-success/10"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <p className={`text-xs font-bold ${reached ? "text-success" : "text-text-3"}`}>
                  {reached ? "✓ " : "○ "}{m.label}
                </p>
                <p className="text-sm font-black mt-1">{formatMoney(m.valuation)}</p>
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-text-2 mt-4 flex items-center justify-center gap-2">
          <Zap size={14} className="text-gold" />
          Run commands below — each one grows your company value
        </p>
      </div>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  target,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  target: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-4 rounded-xl border ${highlight ? "border-gold/40 bg-gold/5" : "border-white/10 bg-black/30"}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-gold" />
        <span className="text-xs text-text-3">{label}</span>
      </div>
      <p className={`text-xl font-black ${highlight ? "text-gold" : "text-white"}`}>{value}</p>
      <p className="text-xs text-text-3">→ {target}</p>
    </div>
  );
}
