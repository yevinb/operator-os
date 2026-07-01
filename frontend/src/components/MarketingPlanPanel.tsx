"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { getActivePlan } from "@/lib/api";
import type { ActivePlan as ActivePlanType } from "@/lib/types";

export function MarketingPlanPanel({ refreshKey }: { refreshKey?: number }) {
  const [plan, setPlan] = useState<ActivePlanType | null>(null);

  useEffect(() => {
    getActivePlan().then(setPlan).catch(() => setPlan({ active: false }));
  }, [refreshKey]);

  if (!plan?.active) return null;

  return (
    <div className="card-premium rounded-2xl p-6 border-2 border-gold/30">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <FileText className="text-gold" size={20} />
          <h2 className="font-black text-lg">Active marketing plan</h2>
        </div>
        <Link href="/dashboard/plan" className="text-xs text-gold hover:underline">
          Full plan →
        </Link>
      </div>
      <p className="text-sm text-text-2 mb-2">{plan.summary}</p>
      <p className="text-xs text-success font-bold mb-3">
        {plan.executed_count ?? 0} actions executed · Nexa is running this
      </p>
      {plan.marketing_plan && (
        <pre className="text-xs text-text-2 whitespace-pre-wrap max-h-40 overflow-y-auto bg-black/30 rounded-xl p-4 border border-white/5">
          {plan.marketing_plan.slice(0, 600)}
          {plan.marketing_plan.length > 600 ? "…" : ""}
        </pre>
      )}
    </div>
  );
}
