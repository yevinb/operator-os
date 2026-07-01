"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getActivePlan } from "@/lib/api";
import { TaskList } from "@/components/TaskList";
import type { ActivePlan } from "@/lib/types";

export default function PlanPage() {
  const [plan, setPlan] = useState<ActivePlan | null>(null);

  useEffect(() => {
    getActivePlan().then(setPlan).catch(() => setPlan({ active: false }));
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-text-2 hover:text-gold">
        <ArrowLeft size={16} /> Command Center
      </Link>

      <div>
        <p className="text-xs font-bold text-gold uppercase tracking-wider mb-1">Marketing plan</p>
        <h1 className="text-2xl font-black">Here&apos;s your plan. Nexa is executing it.</h1>
      </div>

      {!plan?.active ? (
        <div className="card-premium rounded-2xl p-8 text-center text-text-2">
          <p>No active plan yet. Go to Command Center and give Nexa one outcome.</p>
          <Link href="/dashboard" className="inline-block mt-4 text-gold font-semibold">Open Command Center →</Link>
        </div>
      ) : (
        <>
          <div className="card-premium rounded-2xl p-6 border border-gold/30">
            <p className="text-lg font-semibold text-white mb-2">&ldquo;{plan.command}&rdquo;</p>
            <p className="text-text-2 text-sm mb-4">{plan.summary}</p>
            <p className="text-success text-sm font-bold">{plan.executed_count ?? 0} actions executed live</p>
          </div>

          {plan.marketing_plan && (
            <pre className="card-premium rounded-2xl p-6 text-sm text-text-2 whitespace-pre-wrap border border-white/10">
              {plan.marketing_plan}
            </pre>
          )}

          {plan.tasks && plan.tasks.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-text-2 uppercase mb-3">Execution tasks</h2>
              <TaskList tasks={plan.tasks} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
