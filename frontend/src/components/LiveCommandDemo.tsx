"use client";

import { useState, useCallback } from "react";
import { Zap, Send, CheckCircle2, TrendingUp, ArrowRight } from "lucide-react";
import Link from "next/link";
import { runCommand } from "@/lib/api";
import { TaskList } from "./TaskList";
import { Button } from "./ui/Button";
import type { CommandResponse } from "@/lib/types";
import { recordGrowth, getCompanyProgress, formatMoney } from "@/lib/valuation";

export function LiveCommandDemo() {
  const [cmd, setCmd] = useState("");
  const [response, setResponse] = useState<CommandResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [valuation, setValuation] = useState(0);

  const run = useCallback(async (command: string) => {
    const trimmed = command.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setResponse(null);
    try {
      const res = await runCommand(trimmed);
      setResponse(res);
      const growth = recordGrowth(res.tasks.length);
      setValuation(growth.estimatedValuation);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const progress = getCompanyProgress();

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Giant $30M header */}
      <div className="text-center mb-8">
        <p className="text-gold text-sm font-bold uppercase tracking-[0.3em] mb-3">
          ▶ LIVE DEMO — TRY IT NOW
        </p>
        <h2 className="text-4xl md:text-6xl font-black mb-2">
          <span className="gradient-gold">$30 Million</span>
          <span className="text-white"> Company</span>
        </h2>
        <p className="text-text-2 text-lg">Type a command. Watch your AI COO execute it. Right now.</p>
      </div>

      <div className="card-premium rounded-3xl p-6 md:p-8 glow-gold">
        {/* Command input */}
        <form
          onSubmit={(e) => { e.preventDefault(); run(cmd); }}
          className="flex flex-col sm:flex-row gap-3 mb-6"
        >
          <input
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            placeholder='Type: "Increase sales"'
            disabled={busy}
            className="flex-1 px-6 py-5 rounded-2xl bg-black/50 border-2 border-gold/30 text-white text-xl placeholder:text-text-3 outline-none focus:border-gold disabled:opacity-50"
            autoFocus
          />
          <button
            type="submit"
            disabled={!cmd.trim() || busy}
            className="px-10 py-5 rounded-2xl bg-gradient-to-r from-gold to-amber-500 text-black font-bold text-lg flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-40 transition-all shrink-0"
          >
            {busy ? (
              <span className="animate-pulse">Running…</span>
            ) : (
              <>
                <Send size={20} />
                EXECUTE
              </>
            )}
          </button>
        </form>

        {/* One-click demos */}
        <div className="flex flex-wrap gap-2 mb-6">
          {["Increase sales.", "Run my company.", "Reply to customers.", "Check cash flow."].map((c) => (
            <button
              key={c}
              onClick={() => { setCmd(c); run(c); }}
              disabled={busy}
              className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-text-2 hover:border-gold/50 hover:text-gold transition-colors disabled:opacity-40"
            >
              {c}
            </button>
          ))}
        </div>

        {/* Results */}
        {response && (
          <div className="animate-slide-up border-t border-white/10 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="text-success" size={24} />
              <span className="text-success font-bold text-lg">COMMAND EXECUTED</span>
            </div>
            <p className="text-white text-xl font-semibold mb-1">
              &ldquo;{response.command}&rdquo;
            </p>
            <p className="text-text-2 mb-6">{response.summary}</p>
            <TaskList tasks={response.tasks} animate />

            <div className="mt-6 p-4 rounded-2xl bg-gold/10 border border-gold/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-gold" size={20} />
                <span className="text-gold font-medium">Company value grew</span>
              </div>
              <span className="text-2xl font-black text-gold">
                {formatMoney(valuation || progress.estimatedValuation)}
              </span>
            </div>
          </div>
        )}

        {!response && !busy && (
          <div className="text-center py-8 text-text-3 border-t border-white/5">
            ↑ Click a button or type a command above to see your AI COO work
          </div>
        )}
      </div>

      <div className="text-center mt-8">
        <Link href="/signup">
          <Button size="lg" className="bg-white text-black hover:bg-zinc-200 font-bold px-10">
            Create account to save progress
            <ArrowRight size={18} />
          </Button>
        </Link>
      </div>
    </div>
  );
}
