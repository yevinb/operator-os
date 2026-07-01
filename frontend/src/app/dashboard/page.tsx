"use client";

import { useState, useCallback, useEffect } from "react";
import { Zap, Send, Sparkles, AlertCircle, Target } from "lucide-react";
import { MetricsGrid } from "@/components/MetricsGrid";
import { TaskList } from "@/components/TaskList";
import { EMPTY_METRICS } from "@/lib/demo";
import { runCommand, getMetrics, getNiches, setNicheMode } from "@/lib/api";
import { logCommand } from "@/lib/store";
import { CompanyPulse } from "@/components/CompanyPulse";
import { getBusinessContext, saveBusinessProfile } from "@/lib/business-context";
import { getSession, updateUser } from "@/lib/auth";
import type { CommandResponse, NicheMode } from "@/lib/types";
import { NexaDice } from "@/components/NexaDice";
import { DailyCheckIn } from "@/components/DailyCheckIn";
import { MarketingPlanPanel } from "@/components/MarketingPlanPanel";
import { CoachPanel } from "@/components/CoachPanel";

export default function CommandCenterPage() {
  const [lastResponse, setLastResponse] = useState<CommandResponse | null>(null);
  const [history, setHistory] = useState<CommandResponse[]>([]);
  const [textCmd, setTextCmd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [niches, setNiches] = useState<NicheMode[]>([]);
  const [niche, setNiche] = useState("general");
  const [showCoach, setShowCoach] = useState(false);
  const user = getSession();
  const ctx = getBusinessContext();

  useEffect(() => {
    getMetrics().then(setMetrics).catch(() => setMetrics(EMPTY_METRICS));
    getNiches().then(setNiches).catch(() => {});
    setNiche(ctx.niche_mode || "general");
    if (!ctx.goal && !localStorage.getItem("nexa_coach_done")) {
      setShowCoach(true);
    }
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

  const selectNiche = async (id: string) => {
    setNiche(id);
    saveBusinessProfile({ niche_mode: id });
    await updateUser({ niche_mode: id });
    try {
      await setNicheMode(id);
    } catch { /* offline */ }
  };

  const executed = lastResponse?.executed_count ?? lastResponse?.tasks.filter((t) => t.status === "completed").length ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <DailyCheckIn onRun={execute} />

      {showCoach && (
        <CoachPanel
          onDone={(cmd, nicheId) => {
            if (nicheId) selectNiche(nicheId);
            localStorage.setItem("nexa_coach_done", "1");
            setShowCoach(false);
            if (cmd) execute(cmd);
          }}
        />
      )}

      {user && (
        <div className="p-4 rounded-2xl border border-white/10 bg-black/30 text-sm text-text-2">
          <span className="text-white font-medium">{ctx.company || user.company}</span>
          {ctx.goal && <> · Goal: {ctx.goal}</>}
          {ctx.market && <> · {ctx.market}</>}
        </div>
      )}

      {/* Niche modes */}
      <div>
        <p className="text-xs font-bold text-gold uppercase tracking-wider mb-2">Nexa mode</p>
        <div className="flex flex-wrap gap-2">
          {niches.length ? niches.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => selectNiche(n.id)}
              className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                niche === n.id ? "border-gold bg-gold/15 text-gold" : "border-white/10 text-text-2 hover:border-gold/40"
              }`}
            >
              {n.emoji} {n.label}
            </button>
          )) : (
            ["agency", "coach", "ecommerce", "real_estate", "general"].map((id) => (
              <button key={id} type="button" onClick={() => selectNiche(id)} className="px-3 py-1.5 rounded-full text-xs border border-white/10 capitalize">
                {id.replace("_", " ")}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <NexaDice onRun={execute} />
        <MarketingPlanPanel refreshKey={tick} />
      </div>

      <CompanyPulse key={tick} />

      <div className="card-premium rounded-3xl p-6 md:p-8 border-2 border-gold/30">
        <div className="flex items-center gap-2 mb-2">
          <Target className="text-gold" size={20} />
          <h1 className="text-xl font-black">ONE OUTCOME — NEXA RUNS IT</h1>
        </div>
        <p className="text-sm text-text-2 mb-4">Not a blank box. Say what you want — Nexa builds the plan and executes.</p>

        <form
          onSubmit={(e) => { e.preventDefault(); execute(textCmd); setTextCmd(""); }}
          className="flex flex-col sm:flex-row gap-3 mb-4"
        >
          <input
            value={textCmd}
            onChange={(e) => setTextCmd(e.target.value)}
            placeholder='e.g. "Get me 50 leads this month"'
            disabled={busy}
            className="flex-1 px-6 py-5 rounded-2xl bg-black/60 border-2 border-white/10 text-white text-lg outline-none focus:border-gold disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!textCmd.trim() || busy}
            className="px-10 py-5 rounded-2xl bg-gradient-to-r from-gold to-amber-500 text-black font-black text-lg flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Send size={20} />
            {busy ? "EXECUTING…" : "EXECUTE"}
          </button>
        </form>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-danger/10 border border-danger/30 flex items-center gap-2 text-danger text-sm">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {["Get me 50 leads this month", "Increase sales 20%", "Grow Instagram followers", "Launch email nurture sequence", "Check Stripe balance"].map((cmd) => (
            <button
              key={cmd}
              type="button"
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
              <p className="font-bold text-success">{executed} LIVE · Nexa is executing your plan</p>
              <p className="text-white font-semibold">&ldquo;{lastResponse.command}&rdquo;</p>
            </div>
          </div>
          <p className="text-text-2 mb-4">{lastResponse.summary}</p>
          {lastResponse.marketing_plan && (
            <pre className="text-xs text-text-2 whitespace-pre-wrap mb-4 p-4 rounded-xl bg-black/40 border border-gold/20 max-h-56 overflow-y-auto">
              {lastResponse.marketing_plan}
            </pre>
          )}
          <TaskList tasks={lastResponse.tasks} animate={false} />
        </section>
      )}

      <section>
        <h2 className="text-sm font-bold text-gold uppercase tracking-wider mb-4">Live metrics</h2>
        <MetricsGrid metrics={metrics} />
      </section>

      {history.length > 1 && (
        <section>
          <h2 className="text-sm font-bold text-text-2 uppercase tracking-wider mb-4">Command history</h2>
          <div className="space-y-2">
            {history.slice(1, 6).map((h) => {
              const done = h.executed_count ?? h.tasks.filter((t) => t.status === "completed").length;
              return (
                <div key={h.command + h.intent} className="flex justify-between p-4 rounded-xl card-premium">
                  <div>
                    <p className="font-medium">{h.command}</p>
                    <p className="text-xs text-text-3">{done} executed</p>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full font-bold bg-success/20 text-success">LIVE</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
