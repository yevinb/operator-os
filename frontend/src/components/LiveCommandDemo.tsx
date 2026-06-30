"use client";

import { useState, useCallback, useRef } from "react";
import { Send, CheckCircle2, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";
import { demoExecuteCommand } from "@/lib/demo";
import { getBusinessContext } from "@/lib/business-context";
import { runCommand } from "@/lib/api";
import { TaskList } from "./TaskList";
import { Button } from "./ui/Button";
import type { CommandResponse } from "@/lib/types";
import { recordActivity } from "@/lib/business-metrics";

export function LiveCommandDemo() {
  const [cmd, setCmd] = useState("");
  const [response, setResponse] = useState<CommandResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionsRun, setActionsRun] = useState(0);
  const runningRef = useRef(false);

  const run = useCallback(async (command: string) => {
    const trimmed = command.trim();
    if (!trimmed || runningRef.current) return;

    runningRef.current = true;
    setBusy(true);
    setResponse(null);

    const instant = demoExecuteCommand(trimmed, getBusinessContext());
    setResponse(instant);
    recordActivity(instant.tasks.length);
    setActionsRun(instant.tasks.length);
    setBusy(false);
    runningRef.current = false;

    runCommand(trimmed).catch(() => {});
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <p className="text-gold text-sm font-bold uppercase tracking-[0.3em] mb-3">
          ▶ Live demo — try it now
        </p>
        <h2 className="text-4xl md:text-5xl font-black mb-2 text-white">
          Command your company
        </h2>
        <p className="text-text-2 text-lg">Type a command. Watch your AI COO execute it instantly.</p>
      </div>

      <div className="card-premium rounded-3xl p-6 md:p-8 glow-gold">
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

            <div className="mt-6 p-4 rounded-2xl bg-success/10 border border-success/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="text-success" size={20} />
                <span className="text-success font-medium">Autonomous actions deployed</span>
              </div>
              <span className="text-2xl font-black text-white">{actionsRun}</span>
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
            Create account to run your company
            <ArrowRight size={18} />
          </Button>
        </Link>
      </div>
    </div>
  );
}
