/** Path to $30M company valuation — the north star. */

export const VALUATION_TARGET = 30_000_000; // $30M
export const SAAS_MULTIPLE = 10; // conservative SaaS ARR multiple
export const ARR_TARGET = VALUATION_TARGET / SAAS_MULTIPLE; // $3M ARR
export const MRR_TARGET = ARR_TARGET / 12; // $250K MRR
export const AVG_REVENUE_PER_CUSTOMER = 500; // blended $/month
export const CUSTOMERS_FOR_30M = Math.ceil(MRR_TARGET / AVG_REVENUE_PER_CUSTOMER); // ~500

export interface CompanyProgress {
  mrr: number;
  customers: number;
  arr: number;
  estimatedValuation: number;
  percentToTarget: number;
  aiActionsTotal: number;
}

const PROGRESS_KEY = "operatoros_company_progress";

const DEFAULT: CompanyProgress = {
  mrr: 12_400,
  customers: 24,
  arr: 148_800,
  estimatedValuation: 1_488_000,
  percentToTarget: 4.96,
  aiActionsTotal: 127,
};

export function getCompanyProgress(): CompanyProgress {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

export function recordGrowth(tasksCompleted: number) {
  const p = getCompanyProgress();
  const customerGain = Math.random() > 0.7 ? 1 : 0;
  const mrrGain = customerGain * (99 + Math.floor(Math.random() * 400));

  const customers = p.customers + customerGain;
  const mrr = p.mrr + mrrGain + tasksCompleted * 12;
  const arr = mrr * 12;
  const estimatedValuation = arr * SAAS_MULTIPLE;
  const percentToTarget = Math.min(100, (estimatedValuation / VALUATION_TARGET) * 100);

  const updated: CompanyProgress = {
    mrr,
    customers,
    arr,
    estimatedValuation,
    percentToTarget,
    aiActionsTotal: p.aiActionsTotal + tasksCompleted,
  };

  localStorage.setItem(PROGRESS_KEY, JSON.stringify(updated));
  return updated;
}

export const MILESTONES = [
  { label: "Product-market fit", mrr: 10_000, customers: 20, valuation: 1_200_000 },
  { label: "Repeatable sales", mrr: 50_000, customers: 100, valuation: 6_000_000 },
  { label: "Scale engine", mrr: 150_000, customers: 300, valuation: 18_000_000 },
  { label: "$30M company", mrr: MRR_TARGET, customers: CUSTOMERS_FOR_30M, valuation: VALUATION_TARGET },
];

export function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
