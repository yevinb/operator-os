"use client";

import Link from "next/link";
import {
  TrendingUp,
  Users,
  Target,
  Zap,
  BarChart3,
} from "lucide-react";
import type { BusinessMetrics } from "@/lib/types";

interface MetricsGridProps {
  metrics: BusinessMetrics;
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  emptyHint,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  emptyHint?: string;
}) {
  return (
    <div className="p-5 rounded-2xl bg-surface border border-border hover:border-accent/20 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-text-2">{label}</span>
        <div className="p-2 rounded-lg bg-surface-2">
          <Icon size={16} className="text-accent" />
        </div>
      </div>
      <div className="text-2xl font-semibold text-text mb-1">{value}</div>
      {sub && <div className="text-sm text-text-3">{sub}</div>}
      {emptyHint && (
        <Link href="/dashboard/integrations/" className="text-xs text-accent hover:underline mt-1 inline-block">
          {emptyHint}
        </Link>
      )}
    </div>
  );
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  const hasStripe = metrics.stripeConnected;
  const hasActivity = metrics.aiActionsToday > 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <MetricCard
        label="Stripe balance"
        value={hasStripe ? `$${metrics.revenue.toLocaleString()}` : "—"}
        sub={hasStripe ? "Live from Stripe" : undefined}
        icon={BarChart3}
        emptyHint={!hasStripe ? "Connect Stripe →" : undefined}
      />
      <MetricCard
        label="Customers"
        value={hasStripe ? metrics.customers.toLocaleString() : "—"}
        sub={hasStripe ? "From Stripe" : undefined}
        icon={Users}
        emptyHint={!hasStripe ? "Connect Stripe →" : undefined}
      />
      <MetricCard
        label="Ad integrations"
        value={String(metrics.activeCampaigns)}
        sub={metrics.activeCampaigns ? "Meta and/or Google Ads connected" : "Connect ads tools"}
        icon={Target}
      />
      <MetricCard
        label="Actions executed today"
        value={String(metrics.aiActionsToday)}
        sub={hasActivity ? "Real API calls" : "Run a command to start"}
        icon={Zap}
      />
      <MetricCard
        label="Planned actions"
        value={String(metrics.pendingTasks)}
        sub="Need more integrations"
        icon={TrendingUp}
      />
      <MetricCard
        label="Data source"
        value={metrics.dataSource === "stripe" ? "Stripe" : metrics.dataSource === "commands" ? "Commands" : "None"}
        sub="No fake numbers"
        icon={BarChart3}
      />
    </div>
  );
}
