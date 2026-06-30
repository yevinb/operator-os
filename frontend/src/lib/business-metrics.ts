/** Tracks the customer's business as the AI COO runs operations. */

export interface CompanyMetrics {
  mrr: number;
  customers: number;
  arr: number;
  aiActionsTotal: number;
}

const METRICS_KEY = "operatoros_company_metrics";

const DEFAULT: CompanyMetrics = {
  mrr: 12_400,
  customers: 24,
  arr: 148_800,
  aiActionsTotal: 127,
};

export function getCompanyMetrics(): CompanyMetrics {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(METRICS_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
}

export function recordActivity(tasksCompleted: number): CompanyMetrics {
  const current = getCompanyMetrics();
  const customerGain = Math.random() > 0.7 ? 1 : 0;
  const mrrGain = customerGain * (99 + Math.floor(Math.random() * 400));

  const customers = current.customers + customerGain;
  const mrr = current.mrr + mrrGain + tasksCompleted * 12;
  const arr = mrr * 12;

  const updated: CompanyMetrics = {
    mrr,
    customers,
    arr,
    aiActionsTotal: current.aiActionsTotal + tasksCompleted,
  };

  localStorage.setItem(METRICS_KEY, JSON.stringify(updated));
  return updated;
}

export function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
