"use client";

import { useState } from "react";
import { Dices } from "lucide-react";
import { rollBusinessIdea } from "@/lib/api";
import type { BusinessIdea } from "@/lib/types";

export function NexaDice({ onRun }: { onRun: (cmd: string) => void }) {
  const [idea, setIdea] = useState<BusinessIdea | null>(null);
  const [busy, setBusy] = useState(false);

  const roll = async () => {
    setBusy(true);
    try {
      const result = await rollBusinessIdea();
      setIdea(result);
    } catch {
      setIdea({
        idea: "AI automation agency for local dentists",
        niche: "agency",
        niche_label: "Agency",
        suggested_command: "Build a 30-day launch plan for an AI automation agency",
        first_steps: ["Validate with 10 interviews", "Landing page + Stripe", "Test ads £50/day"],
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-premium rounded-2xl p-5 border border-gold/25">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-bold text-gold uppercase tracking-wider">Infinite ideas</p>
          <p className="text-sm text-text-2">Nexa suggests a business — then runs it for you</p>
        </div>
        <button
          type="button"
          onClick={roll}
          disabled={busy}
          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold to-amber-600 text-black text-2xl flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50"
          title="Roll business idea"
        >
          {busy ? "…" : "🎲"}
        </button>
      </div>
      {idea && (
        <div className="space-y-3 animate-slide-up">
          <p className="text-white font-semibold">{idea.idea}</p>
          <p className="text-xs text-text-3">{idea.niche_label} mode · 5 first steps included</p>
          <ul className="text-sm text-text-2 space-y-1 list-disc list-inside">
            {idea.first_steps.slice(0, 3).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onRun(idea.suggested_command)}
            className="w-full py-2.5 rounded-xl bg-gold/15 border border-gold/40 text-gold text-sm font-semibold hover:bg-gold/25"
          >
            Run this business →
          </button>
        </div>
      )}
      {!idea && (
        <p className="text-xs text-text-3 flex items-center gap-1">
          <Dices size={14} /> Tap the dice — no blank prompts
        </p>
      )}
    </div>
  );
}
