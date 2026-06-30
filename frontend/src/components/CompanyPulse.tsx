"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Users, DollarSign, Zap, Activity } from "lucide-react";
import { getCompanyMetrics, formatMoney, type CompanyMetrics } from "@/lib/business-metrics";

export function CompanyPulse() {
  const [metrics, setMetrics] = useState<CompanyMetrics | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setMetrics(getCompanyMetrics());
    const interval = setInterval(() => {
      setMetrics(getCompanyMetrics());
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!metrics) return null;

  return (
    <section className={`rounded-3xl overflow-hidden border border-white/10 transition-all duration-500 ${pulse ? "border-gold/40" : ""}`}>
      <div className="bg-surface/80 px-6 py-5 border-b border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-gold text-xs font-bold uppercase tracking-[0.2em] mb-1">
              Company pulse
            </p>
            <h2 className="text-2xl font-black text-white">Your business right now</h2>
          </div>
          <div className="flex items-center gap-2 text-success text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            AI COO active
          </div>
        </div>
      </div>

      <div className="p-6 bg-black/40">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat icon={DollarSign} label="Monthly revenue" value={formatMoney(metrics.mrr)} />
          <Stat icon={Users} label="Customers" value={String(metrics.customers)} />
          <Stat icon={TrendingUp} label="Annual run rate" value={formatMoney(metrics.arr)} />
          <Stat icon={Zap} label="AI actions" value={String(metrics.aiActionsTotal)} highlight />
        </div>

        <p className="text-center text-sm text-text-2 mt-4 flex items-center justify-center gap-2">
          <Activity size={14} className="text-gold" />
          Every command below runs real operations across your business
        </p>
      </div>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-4 rounded-xl border ${highlight ? "border-gold/40 bg-gold/5" : "border-white/10 bg-black/30"}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-gold" />
        <span className="text-xs text-text-3">{label}</span>
      </div>
      <p className={`text-xl font-black ${highlight ? "text-gold" : "text-white"}`}>{value}</p>
    </div>
  );
}
