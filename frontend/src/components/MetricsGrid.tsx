"use client";

import {
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Zap,
  BarChart3,
} from "lucide-react";
import type { BusinessMetrics } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MetricsGridProps {
  metrics: BusinessMetrics;
}

function MetricCard({
  label,
  value,
  change,
  icon: Icon,
  format = "number",
}: {
  label: string;
  value: number;
  change: number;
  icon: React.ElementType;
  format?: "number" | "currency" | "percent";
}) {
  const formatted =
    format === "currency"
      ? `$${value.toLocaleString()}`
      : format === "percent"
        ? `${value}%`
        : value.toLocaleString();

  const isPositive = change >= 0;

  return (
    <div className="p-5 rounded-2xl bg-surface border border-border hover:border-accent/20 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-text-2">{label}</span>
        <div className="p-2 rounded-lg bg-surface-2">
          <Icon size={16} className="text-accent" />
        </div>
      </div>
      <div className="text-2xl font-semibold text-text mb-1">{formatted}</div>
      <div
        className={cn(
          "flex items-center gap-1 text-sm",
          isPositive ? "text-success" : "text-danger"
        )}
      >
        {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        <span>
          {isPositive ? "+" : ""}
          {change}%
        </span>
        <span className="text-text-3">vs last month</span>
      </div>
    </div>
  );
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <MetricCard
        label="Revenue (MTD)"
        value={metrics.revenue}
        change={metrics.revenueChange}
        icon={BarChart3}
        format="currency"
      />
      <MetricCard
        label="Customers"
        value={metrics.customers}
        change={metrics.customersChange}
        icon={Users}
      />
      <MetricCard
        label="Conversion Rate"
        value={metrics.conversionRate}
        change={metrics.conversionChange}
        icon={Target}
        format="percent"
      />
      <div className="p-5 rounded-2xl bg-surface border border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-text-2">Active Campaigns</span>
          <div className="p-2 rounded-lg bg-surface-2">
            <Zap size={16} className="text-warning" />
          </div>
        </div>
        <div className="text-2xl font-semibold text-text">{metrics.activeCampaigns}</div>
        <div className="text-sm text-text-3 mt-1">Running autonomously</div>
      </div>
      <div className="p-5 rounded-2xl bg-surface border border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-text-2">AI Actions Today</span>
          <div className="p-2 rounded-lg bg-surface-2">
            <Zap size={16} className="text-accent" />
          </div>
        </div>
        <div className="text-2xl font-semibold text-text">{metrics.aiActionsToday}</div>
        <div className="text-sm text-success mt-1">+23% vs yesterday</div>
      </div>
      <div className="p-5 rounded-2xl bg-surface border border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-text-2">Pending Tasks</span>
          <div className="p-2 rounded-lg bg-surface-2">
            <Target size={16} className="text-text-2" />
          </div>
        </div>
        <div className="text-2xl font-semibold text-text">{metrics.pendingTasks}</div>
        <div className="text-sm text-text-3 mt-1">In queue</div>
      </div>
    </div>
  );
}
