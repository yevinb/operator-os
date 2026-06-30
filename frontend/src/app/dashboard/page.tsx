"use client";

import { useState, useCallback } from "react";
import { Zap, Send, Sparkles } from "lucide-react";
import { MetricsGrid } from "@/components/MetricsGrid";
import { TaskList } from "@/components/TaskList";
import { Button } from "@/components/ui/Button";
import { DEMO_METRICS, demoExecuteCommand } from "@/lib/demo";
import { runCommand } from "@/lib/api";
import { logCommand } from "@/lib/store";
import { recordGrowth } from "@/lib/valuation";
import { CompanyPulse } from "@/components/CompanyPulse";
import type { CommandResponse } from "@/lib/types";

export default function CommandCenterPage() {
  const [lastResponse, setLastResponse] = useState<CommandResponse | null>(null);
  const [history, setHistory] = useState<CommandResponse[]>([]);
  const [textCmd, setTextCmd] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const execute = useCallback(async (command: string) => {
    const trimmed = command.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setLastResponse(null);

    const instant = demoExecuteCommand(trimmed);
    setLastResponse(instant);
    setHistory((h) => [instant, ...h].slice(0, 20));
    logCommand(instant);
    recordGrowth(instant.tasks.length);
    setTick((t) => t + 1);
    setBusy(false);

    runCommand(trimmed).catch(() => {});
  }, [busy]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <CompanyPulse key={tick} />

      {/* Command box — hero of dashboard */}
      <div className="card-premium rounded-3xl p-6 md:p-8 border-2 border-gold/30">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="text-gold" size={20} />
          <h1 className="text-xl font-black">COMMAND YOUR COMPANY</h1>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); execute(textCmd); setTextCmd(""); }}
          className="flex flex-col sm:flex-row gap-3 mb-4"
        >
          <input
            value={textCmd}
            onChange={(e) => setTextCmd(e.target.value)}
            placeholder='Type: "Increase sales" or "Run my company"'
            disabled={busy}
            className="flex-1 px-6 py-5 rounded-2xl bg-black/60 border-2 border-white/10 text-white text-lg outline-none focus:border-gold disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!textCmd.trim() || busy}
            className="px-10 py-5 rounded-2xl bg-gradient-to-r from-gold to-amber-500 text-black font-black text-lg flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Send size={20} />
            {busy ? "RUNNING…" : "EXECUTE"}
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {["Increase sales.", "Run my company.", "Reply to customers.", "Check cash flow.", "Hire a developer."].map((cmd) => (
            <button
              key={cmd}
              onClick={() => execute(cmd)}
              disabled={busy}
              className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm hover:border-gold/50 hover:text-gold disabled:opacity-40"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>

      {lastResponse && (
        <section className="card-premium rounded-2xl p-6 border-2 border-success/30 animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <p className="text-success font-bold">EXECUTING NOW</p>
              <p className="text-white font-semibold">&ldquo;{lastResponse.command}&rdquo;</p>
            </div>
          </div>
          <p className="text-text-2 mb-4">{lastResponse.summary}</p>
          <TaskList tasks={lastResponse.tasks} animate />
        </section>
      )}

      <section>
        <h2 className="text-sm font-bold text-gold uppercase tracking-wider mb-4">Live business metrics</h2>
        <MetricsGrid metrics={DEMO_METRICS} />
      </section>

      {history.length > 1 && (
        <section>
          <h2 className="text-sm font-bold text-text-2 uppercase tracking-wider mb-4">Command history</h2>
          <div className="space-y-2">
            {history.slice(1, 6).map((h) => (
              <div key={h.command + h.intent} className="flex justify-between p-4 rounded-xl card-premium">
                <div>
                  <p className="font-medium">{h.command}</p>
                  <p className="text-xs text-text-3">{h.tasks.length} actions completed</p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-success/20 text-success font-bold">DONE</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
