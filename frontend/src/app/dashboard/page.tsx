"use client";

import { useState, useCallback, useEffect } from "react";
import { Zap, Send, Sparkles, AlertCircle } from "lucide-react";
import { MetricsGrid } from "@/components/MetricsGrid";
import { TaskList } from "@/components/TaskList";
import { EMPTY_METRICS } from "@/lib/demo";
import { runCommand, getMetrics } from "@/lib/api";
import { logCommand } from "@/lib/store";
import { CompanyPulse } from "@/components/CompanyPulse";
import { getBusinessContext } from "@/lib/business-context";
import { getSession } from "@/lib/auth";
import type { CommandResponse } from "@/lib/types";

export default function CommandCenterPage() {
  const [lastResponse, setLastResponse] = useState<CommandResponse | null>(null);
  const [history, setHistory] = useState<CommandResponse[]>([]);
  const [textCmd, setTextCmd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const user = getSession();
  const ctx = getBusinessContext();

  useEffect(() => {
    getMetrics().then(setMetrics).catch(() => setMetrics(EMPTY_METRICS));
  }, []);

  const execute = useCallback(async (command: string) => {
    const trimmed = command.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError("");
    setLastResponse(null);
    try {
      const response = await runCommand(trimmed);
      setLastResponse(response);
      setHistory((h) => [response, ...h].slice(0, 20));
      logCommand(response);
      setTick((t) => t + 1);
      const m = await getMetrics();
      setMetrics(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Command failed. Sign in again or retry.");
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const executed = lastResponse?.executed_count ?? lastResponse?.tasks.filter((t) => t.status === "completed").length ?? 0;
  const planned = lastResponse?.planned_count ?? lastResponse?.tasks.filter((t) => t.status === "planned").length ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {user && (
        <div className="p-4 rounded-2xl border border-white/10 bg-black/30 text-sm text-text-2">
          AI COO context: <span className="text-white font-medium">{ctx.company || user.company}</span>
          {ctx.industry && <> · {ctx.industry}</>}
          {ctx.goal && <> · Goal: {ctx.goal}</>}
          {ctx.market && <> · {ctx.market}</>}
        </div>
      )}

      <CompanyPulse key={tick} />

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
            placeholder='Type: "Post to Slack" or "Check Stripe balance"'
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

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-danger/10 border border-danger/30 flex items-center gap-2 text-danger text-sm">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {["Check Stripe balance.", "Post to Slack.", "Reply to customers.", "Schedule a meeting.", "Hire a developer."].map((cmd) => (
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
        <section className="card-premium rounded-2xl p-6 border-2 border-white/20 animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${executed > 0 ? "bg-success" : "bg-warning"}`}>
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <p className={`font-bold ${executed > 0 ? "text-success" : "text-warning"}`}>
                {executed > 0 ? `${executed} LIVE · ${planned} PLANNED` : `${planned} PLANNED — connect integrations`}
              </p>
              <p className="text-white font-semibold">&ldquo;{lastResponse.command}&rdquo;</p>
            </div>
          </div>
          <p className="text-text-2 mb-4">{lastResponse.summary}</p>
          <TaskList tasks={lastResponse.tasks} animate={false} />
        </section>
      )}

      <section>
        <h2 className="text-sm font-bold text-gold uppercase tracking-wider mb-4">Live business metrics</h2>
        <MetricsGrid metrics={metrics} />
      </section>

      {history.length > 1 && (
        <section>
          <h2 className="text-sm font-bold text-text-2 uppercase tracking-wider mb-4">Command history</h2>
          <div className="space-y-2">
            {history.slice(1, 6).map((h) => {
              const done = h.executed_count ?? h.tasks.filter((t) => t.status === "completed").length;
              const plan = h.planned_count ?? h.tasks.filter((t) => t.status === "planned").length;
              return (
                <div key={h.command + h.intent + h.tasks.length} className="flex justify-between p-4 rounded-xl card-premium">
                  <div>
                    <p className="font-medium">{h.command}</p>
                    <p className="text-xs text-text-3">{done} executed · {plan} planned</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-bold ${done > 0 ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
                    {done > 0 ? "LIVE" : "PLAN"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
