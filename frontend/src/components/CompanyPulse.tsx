"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Users, DollarSign, Zap, Activity } from "lucide-react";
import { getMetrics } from "@/lib/api";
import { formatMoney, metricsToPulse, type CompanyMetrics } from "@/lib/business-metrics";
import { getEmptyPulse } from "@/lib/business-metrics";

export function CompanyPulse() {
  const [metrics, setMetrics] = useState<CompanyMetrics | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const m = await getMetrics();
        setMetrics(metricsToPulse(m));
      } catch {
        setMetrics(getEmptyPulse());
      }
    })();
  }, []);

  if (!metrics) return null;

  const hasData = metrics.stripeConnected || metrics.aiActionsTotal > 0;

  return (
    <section className="rounded-3xl overflow-hidden border border-white/10">
      <div className="bg-surface/80 px-6 py-5 border-b border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-gold text-xs font-bold uppercase tracking-[0.2em] mb-1">Company pulse</p>
            <h2 className="text-2xl font-black text-white">Your business right now</h2>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className={`w-2 h-2 rounded-full ${hasData ? "bg-success animate-pulse" : "bg-warning"}`} />
            <span className={hasData ? "text-success" : "text-warning"}>
              {hasData ? "Live data" : "Connect Stripe for revenue"}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 bg-black/40">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat icon={DollarSign} label="Stripe balance" value={metrics.stripeConnected ? formatMoney(metrics.mrr) : "—"} />
          <Stat icon={Users} label="Customers" value={metrics.stripeConnected ? String(metrics.customers) : "—"} />
          <Stat icon={TrendingUp} label="Annual run rate" value={metrics.stripeConnected ? formatMoney(metrics.arr) : "—"} />
          <Stat icon={Zap} label="Actions today" value={String(metrics.aiActionsTotal)} highlight />
        </div>

        {!hasData && (
          <p className="text-center text-sm text-text-2 mt-4">
            <Link href="/dashboard/integrations/" className="text-gold hover:underline">
              Connect Stripe, Slack, or n8n
            </Link>
            {" "}to see live metrics and execute commands
          </p>
        )}

        {hasData && (
          <p className="text-center text-sm text-text-2 mt-4 flex items-center justify-center gap-2">
            <Activity size={14} className="text-gold" />
            Data from {metrics.dataSource === "stripe" ? "Stripe" : "your commands today"}
          </p>
        )}
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
