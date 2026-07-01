"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { getCheckIn } from "@/lib/api";
import type { CheckIn } from "@/lib/types";

export function DailyCheckIn({ onRun }: { onRun: (cmd: string) => void }) {
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);

  useEffect(() => {
    getCheckIn().then(setCheckIn).catch(() => {
      setCheckIn({
        message: "Good morning — tell Nexa one outcome and it builds + runs your plan.",
        suggested_command: "Get me 20 leads this month",
        niche: "general",
        date: new Date().toLocaleDateString(),
      });
    });
  }, []);

  if (!checkIn) return null;

  return (
    <div className="p-4 rounded-2xl border border-accent/30 bg-accent/5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-start gap-3 flex-1">
        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
          <Bell size={18} className="text-accent" />
        </div>
        <div>
          <p className="text-xs font-bold text-accent uppercase tracking-wider mb-1">Daily check-in</p>
          <p className="text-sm text-text whitespace-pre-line">{checkIn.message}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRun(checkIn.suggested_command)}
        className="shrink-0 px-4 py-2 rounded-xl bg-accent text-void text-sm font-semibold hover:opacity-90"
      >
        Do this now
      </button>
    </div>
  );
}
