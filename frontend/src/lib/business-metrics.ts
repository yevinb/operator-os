/** Real company metrics from the API — no fake inflation. */

import type { BusinessMetrics } from "./types";
import { EMPTY_METRICS } from "./demo";

export interface CompanyMetrics {
  mrr: number;
  customers: number;
  arr: number;
  aiActionsTotal: number;
  stripeConnected: boolean;
  dataSource: string;
}

export function metricsToPulse(m: BusinessMetrics): CompanyMetrics {
  return {
    mrr: m.revenue,
    customers: m.customers,
    arr: m.revenue * 12,
    aiActionsTotal: m.aiActionsToday,
    stripeConnected: m.stripeConnected ?? false,
    dataSource: m.dataSource ?? "none",
  };
}

export function getEmptyPulse(): CompanyMetrics {
  const p = metricsToPulse(EMPTY_METRICS);
  return p;
}

export function recordActivity(completedTasks: number): number {
  return completedTasks;
}

export function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
