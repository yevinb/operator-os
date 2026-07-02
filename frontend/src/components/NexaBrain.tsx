"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Brain,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Zap,
  ChevronRight,
  Rocket,
  Clock,
  FileText,
  Globe,
  Bot,
} from "lucide-react";
import { NexaChat } from "@/components/NexaChat";
import {
  getBrainStatus,
  getDailyBrief,
  getWeeklyReport,
  getBrainFeed,
  runBrainAgent,
  runAllBrainAgents,
  runMorningCycle,
  ingestBrainUrl,
  getBrainConfig,
  updateBrainConfig,
  triggerBrainLearn,
  type BrainAgent,
  type BrainFeedItem,
  type BrainStatus,
  type DailyBrief,
  type WeeklyReport,
} from "@/lib/brain";
import { cn } from "@/lib/utils";

const TAG_COLORS: Record<string, string> = {
  Optimization: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Awareness: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  Retention: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "Intent Capture": "bg-sky-500/15 text-sky-300 border-sky-500/30",
  "Organic Discovery": "bg-lime-500/15 text-lime-300 border-lime-500/30",
  "Viral Awareness": "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  "Social Proof": "bg-pink-500/15 text-pink-300 border-pink-500/30",
  Conversion: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  Operations: "bg-gold/15 text-gold border-gold/30",
  "Brand Authority": "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
};

function DeliverableBody({ body }: { body: Record<string, unknown> }) {
  const skip = new Set(["title", "deliverable_type", "generated_by", "asset_id"]);
  const entries = Object.entries(body).filter(([k]) => !skip.has(k));
  if (!entries.length) return null;
  return (
    <div className="space-y-2 text-xs text-text-2">
      {entries.map(([key, val]) => (
        <div key={key}>
          <span className="text-text-3 uppercase tracking-wide">{key.replace(/_/g, " ")}: </span>
          {typeof val === "string" ? (
            <span className="text-text whitespace-pre-wrap">{val}</span>
          ) : (
            <pre className="mt-1 p-2 rounded-lg bg-black/40 overflow-x-auto text-[10px]">
              {JSON.stringify(val, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

export function NexaBrain() {
  const [status, setStatus] = useState<BrainStatus | null>(null);
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [agents, setAgents] = useState<BrainAgent[]>([]);
  const [feed, setFeed] = useState<BrainFeedItem[]>([]);
  const [learning, setLearning] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [agentResult, setAgentResult] = useState("");
  const [error, setError] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [expandedFeed, setExpandedFeed] = useState<number | null>(null);
  const [competitors, setCompetitors] = useState("");
  const [keywords, setKeywords] = useState("");
  const [autoRun, setAutoRun] = useState(true);
  const [lastExecutions, setLastExecutions] = useState<{ channel: string; ok: boolean; message?: string }[]>([]);

  const load = useCallback(async (refreshBrief = false) => {
    setError("");
    setLearning(true);
    try {
      await triggerBrainLearn(false);
      const [st, br, wk, ag, fd] = await Promise.all([
        getBrainStatus(),
        getDailyBrief(refreshBrief),
        getWeeklyReport(refreshBrief),
        import("@/lib/brain").then((m) => m.getBrainAgents()),
        getBrainFeed(20),
      ]);
      setStatus(st);
      setBrief(br);
      setWeekly(wk);
      setAgents(ag.agents);
      setFeed(fd.items);
      const cfg = await getBrainConfig();
      setCompetitors((cfg.competitors || []).join("\n"));
      setKeywords((cfg.brand_keywords || []).join(", "));
      setAutoRun(cfg.auto_run_daily);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Brain failed to load");
    } finally {
      setLearning(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAgent = async (agent: BrainAgent) => {
    setRunningId(agent.id);
    setAgentResult("");
    try {
      const res = await runBrainAgent(agent.id);
      if (!res.ok) {
        setAgentResult(res.error || "Agent could not run");
        return;
      }
      setAgentResult(res.summary || `${agent.name} completed`);
      if (res.executions) setLastExecutions(res.executions);
      await load(false);
    } catch (e) {
      setAgentResult(e instanceof Error ? e.message : "Agent failed");
    } finally {
      setRunningId(null);
    }
  };

  const runAll = async () => {
    setBulkRunning(true);
    setAgentResult("");
    try {
      const res = await runAllBrainAgents();
      setAgentResult(`Magic employees: ${res.ran} ran · ${res.skipped} skipped`);
      await load(false);
    } catch (e) {
      setAgentResult(e instanceof Error ? e.message : "Run all failed");
    } finally {
      setBulkRunning(false);
    }
  };

  const morning = async () => {
    setBulkRunning(true);
    try {
      const res = await runMorningCycle();
      setAgentResult(`Morning cycle: ${res.agents_ran} daily agents · brief ready`);
      await load(true);
    } catch (e) {
      setAgentResult(e instanceof Error ? e.message : "Morning cycle failed");
    } finally {
      setBulkRunning(false);
    }
  };

  const saveBrainConfig = async () => {
    try {
      await updateBrainConfig({
        competitors: competitors.split("\n").map((s) => s.trim()).filter(Boolean),
        brand_keywords: keywords.split(",").map((s) => s.trim()).filter(Boolean),
        auto_run_daily: autoRun,
      });
      setAgentResult("Brain config saved — competitors & 24/7 autopilot updated");
      await load(false);
    } catch (e) {
      setAgentResult(e instanceof Error ? e.message : "Config save failed");
    }
  };

  const ingestUrl = async () => {
    if (!urlInput.trim()) return;
    try {
      const res = await ingestBrainUrl(urlInput.trim());
      setAgentResult(`Brain learned from URL: ${res.summary.slice(0, 120)}…`);
      setUrlInput("");
      await load(false);
    } catch (e) {
      setAgentResult(e instanceof Error ? e.message : "URL ingest failed");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-8 pb-16">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-gold/15 via-black/70 to-violet-950/50 p-6 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold/10 via-transparent to-transparent" />
        <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-gold text-sm font-semibold">
                <Brain size={18} /> Nexa Brain
              </span>
              <span className="px-2 py-0.5 rounded-full bg-success/15 text-success text-[10px] font-bold border border-success/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                24/7 ACTIVE
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-[1.05]">
              Learns your business every day
            </h1>
            <p className="text-text-2 text-sm md:text-base leading-relaxed">
              {status?.tagline ||
                "Your second marketing brain. Unified data, history, and context — then magic employees execute."}
            </p>
            {status && (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-text-2">
                  {status.days_learned} days learned
                </span>
                <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-text-2">
                  {status.memory_entries} memories
                </span>
                <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-text-2">
                  {status.agents_active}/{status.agents_total} agents
                </span>
                <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-text-2">
                  {status.agents_run_today} runs today
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
            <button
              type="button"
              onClick={morning}
              disabled={bulkRunning || learning}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gold text-black font-bold text-sm hover:brightness-110 disabled:opacity-50"
            >
              {bulkRunning ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
              Run morning cycle
            </button>
            <button
              type="button"
              onClick={runAll}
              disabled={bulkRunning || learning}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-gold/40 text-gold font-semibold text-sm hover:bg-gold/10 disabled:opacity-50"
            >
              <Bot size={16} /> Run all agents
            </button>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={learning}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-text-2 text-sm hover:border-white/20"
            >
              <RefreshCw size={14} className={learning ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>
      </section>

      {error && <p className="text-danger text-sm">{error}</p>}
      {agentResult && (
        <p className="text-sm text-success border border-success/20 bg-success/5 rounded-xl px-4 py-3">
          {agentResult}
        </p>
      )}

      {/* Today's ONE decision */}
      <section className="rounded-2xl border-2 border-gold/30 bg-gradient-to-b from-gold/5 to-transparent p-6 md:p-8">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gold mb-4">
          <Zap size={14} />
          Today&apos;s decision — no data dumps
        </div>
        {brief ? (
          <div className="space-y-4">
            <p className="text-lg text-white/90">{brief.headline}</p>
            <p className="text-2xl md:text-4xl font-black text-white leading-snug">{brief.action}</p>
            <p className="text-text-2">{brief.why}</p>
            <ul className="grid md:grid-cols-3 gap-3 pt-2">
              {brief.insights?.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-2 p-3 rounded-xl bg-black/30 border border-white/5">
                  <Sparkles size={14} className="text-gold shrink-0 mt-0.5" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : learning ? (
          <div className="flex items-center gap-2 text-text-2 py-8">
            <Loader2 size={20} className="animate-spin text-gold" />
            Brain is learning your business…
          </div>
        ) : null}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Brain setup — Nas "we plug in" */}
        <section className="rounded-2xl border border-gold/20 bg-surface/50 p-5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <Bot size={16} className="text-gold" /> Brain setup (competitors & 24/7)
          </h2>
          <label className="text-xs text-text-3 block mb-1">Competitor URLs (one per line)</label>
          <textarea
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
            rows={3}
            placeholder="https://competitor.com"
            className="w-full mb-3 px-3 py-2 rounded-xl bg-void border border-white/10 text-sm text-white outline-none focus:border-gold"
          />
          <label className="text-xs text-text-3 block mb-1">Brand keywords (comma separated)</label>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="reviews, pricing, alternative"
            className="w-full mb-3 px-3 py-2 rounded-xl bg-void border border-white/10 text-sm text-white outline-none focus:border-gold"
          />
          <label className="flex items-center gap-2 text-sm text-text-2 mb-3 cursor-pointer">
            <input type="checkbox" checked={autoRun} onChange={(e) => setAutoRun(e.target.checked)} className="accent-gold" />
            24/7 autopilot — run morning cycle daily
          </label>
          <button type="button" onClick={saveBrainConfig} className="px-4 py-2 rounded-xl bg-gold text-black text-sm font-bold">
            Save brain config
          </button>
        </section>

        {/* URL ingest */}
        <section className="rounded-2xl border border-white/10 bg-surface/50 p-5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <Globe size={16} className="text-gold" /> Teach Brain from URL
          </h2>
          <p className="text-xs text-text-3 mb-3">Paste your site or product URL — Brain learns your offers and voice.</p>
          <div className="flex gap-2">
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://yourcompany.com"
              className="flex-1 px-3 py-2 rounded-xl bg-void border border-white/10 text-sm text-white outline-none focus:border-gold"
            />
            <button type="button" onClick={ingestUrl} className="px-4 py-2 rounded-xl bg-gold text-black text-sm font-bold">
              Learn
            </button>
          </div>
        </section>

        {/* Weekly report */}
        <section className="rounded-2xl border border-white/10 bg-surface/50 p-5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <FileText size={16} className="text-gold" /> Weekly Brain Report
          </h2>
          {weekly ? (
            <div className="space-y-2 text-sm text-text-2">
              <p className="font-medium text-white">{weekly.title}</p>
              {weekly.summary && <p>{weekly.summary}</p>}
              <ul className="list-disc pl-4 space-y-1 text-xs">
                {weekly.highlights?.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
              <p className="text-gold text-xs pt-1">Next week: {weekly.next_week_focus}</p>
            </div>
          ) : (
            <p className="text-text-3 text-sm">Loading report…</p>
          )}
        </section>
      </div>

      {lastExecutions.length > 0 && (
        <section className="rounded-xl border border-white/10 bg-black/40 p-4">
          <h3 className="text-xs font-bold uppercase text-gold mb-2">Live execution proofs</h3>
          <ul className="space-y-1 text-xs">
            {lastExecutions.map((ex, i) => (
              <li key={i} className={ex.ok ? "text-success" : "text-text-3"}>
                {ex.ok ? "✓" : "○"} {ex.channel}: {ex.message || (ex.ok ? "done" : "skipped")}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Data sources */}
      {status && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-text-3 mb-3">
            Central intelligence hub — your data sources
          </h2>
          <div className="flex flex-wrap gap-2">
            {status.sources.map((s) => (
              <span key={s.id} className="px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-black/50 text-text">
                {s.label}
              </span>
            ))}
            <Link href="/dashboard/integrations" className="px-3 py-1.5 rounded-lg text-xs border border-dashed border-gold/50 text-gold hover:bg-gold/5">
              + Plug in more
            </Link>
          </div>
        </section>
      )}

      {/* Nas comparison */}
      <section className="grid md:grid-cols-2 gap-4 rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-6 bg-red-950/20 border-r border-white/5">
          <p className="text-xs font-bold text-red-300 mb-2">WITHOUT BRAIN</p>
          <ul className="text-sm text-text-2 space-y-2">
            <li>Manual workflow</li>
            <li>Cannot scale</li>
            <li>Dashboard paralysis</li>
            <li>Slow growth</li>
          </ul>
        </div>
        <div className="p-6 bg-gold/5">
          <p className="text-xs font-bold text-gold mb-2">NEXA BRAIN — MAGIC EMPLOYEES</p>
          <ul className="text-sm text-text space-y-2">
            <li>13 agents cross every channel</li>
            <li>Works 24/7</li>
            <li>One decision per morning</li>
            <li>Real deliverables daily</li>
          </ul>
        </div>
      </section>

      {/* Agents grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-white">Magic employees</h2>
          <p className="text-xs text-text-3 flex items-center gap-1">
            <Clock size={12} /> Built around your company context
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <article
              key={agent.id}
              className={cn(
                "rounded-2xl border p-5 flex flex-col gap-3",
                agent.status === "active"
                  ? "border-white/10 bg-surface/60 hover:border-gold/30"
                  : "border-white/5 bg-black/40"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded border", TAG_COLORS[agent.tag] || "bg-white/5 text-text-2")}>
                  {agent.tag}
                </span>
                <span className={cn("text-[10px] font-medium", agent.status === "active" ? "text-success" : "text-text-3")}>
                  {agent.status === "active" ? "● Active" : "Setup"}
                </span>
              </div>
              <h3 className="font-bold text-white">{agent.name}</h3>
              <p className="text-xs text-text-2 leading-relaxed flex-1">{agent.description}</p>
              <p className="text-[11px] text-gold/90 font-medium">{agent.outcome}</p>
              <button
                type="button"
                disabled={runningId === agent.id || bulkRunning}
                onClick={() => runAgent(agent)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-gold text-black hover:brightness-110 disabled:opacity-50"
              >
                {runningId === agent.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Run agent
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* Deliverables feed */}
      {feed.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-white mb-4">Agent deliverables</h2>
          <div className="space-y-3">
            {feed.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-black/40 overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5"
                  onClick={() => setExpandedFeed(expandedFeed === item.id ? null : item.id)}
                >
                  <div>
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="text-[10px] text-text-3">{item.agent_id} · {item.created_at.slice(0, 10)}</p>
                  </div>
                  <ChevronRight size={16} className={cn("text-text-3 transition-transform", expandedFeed === item.id && "rotate-90")} />
                </button>
                {expandedFeed === item.id && (
                  <div className="px-4 pb-4 border-t border-white/5 pt-3">
                    <DeliverableBody body={item.body} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4-step */}
      <section className="grid md:grid-cols-4 gap-4">
        {[
          { n: "1", t: "Plug in", d: "Connect Gmail, Stripe, Meta, HubSpot — your existing stack." },
          { n: "2", t: "Build your brain", d: "All marketing data unified in one intelligence hub." },
          { n: "3", t: "Deploy agents", d: "13 magic employees trained on your business." },
          { n: "4", t: "Grow faster", d: "More campaigns. More pipeline. No extra headcount." },
        ].map((s) => (
          <div key={s.n} className="rounded-xl border border-white/5 bg-surface/30 p-4">
            <span className="text-2xl font-black text-gold">{s.n}</span>
            <p className="font-bold text-white mt-2">{s.t}</p>
            <p className="text-xs text-text-3 mt-1">{s.d}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">Talk to your Brain</h2>
          <Link href="/dashboard/chat" className="text-xs text-gold hover:underline">Full screen →</Link>
        </div>
        <NexaChat compact />
      </section>
    </div>
  );
}
