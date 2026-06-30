"use client";

import { useState, useCallback } from "react";
import { Zap, Send } from "lucide-react";
import { SiriAssistant } from "@/components/SiriAssistant";
import { MetricsGrid } from "@/components/MetricsGrid";
import { TaskList } from "@/components/TaskList";
import { Button } from "@/components/ui/Button";
import { DEMO_METRICS } from "@/lib/demo";
import { runCommand } from "@/lib/api";
import { logCommand } from "@/lib/store";
import { buildSpokenResponse } from "@/lib/voice";
import type { CommandResponse } from "@/lib/types";

const MODULES = [
  { label: "Marketing", status: "6 campaigns running", color: "text-warning" },
  { label: "Sales", status: "47 leads in pipeline", color: "text-accent" },
  { label: "Support", status: "23 emails queued", color: "text-success" },
  { label: "Finance", status: "$124K MTD revenue", color: "text-text" },
  { label: "HR", status: "3 open positions", color: "text-text-2" },
  { label: "Operations", status: "14 tasks in queue", color: "text-text-2" },
];

export default function CommandCenterPage() {
  const [lastResponse, setLastResponse] = useState<CommandResponse | null>(null);
  const [history, setHistory] = useState<CommandResponse[]>([]);
  const [textCmd, setTextCmd] = useState("");
  const [busy, setBusy] = useState(false);

  const execute = useCallback(async (command: string) => {
    const trimmed = command.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const response = await runCommand(trimmed);
      setLastResponse(response);
      setHistory((h) => [response, ...h].slice(0, 20));
      logCommand(response);
      return response;
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    execute(textCmd);
    setTextCmd("");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Command Center</h1>
        <p className="text-text-2 text-sm">Say or type what you need. Your AI COO executes.</p>
      </div>

      {/* Command bar */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          value={textCmd}
          onChange={(e) => setTextCmd(e.target.value)}
          placeholder='Command your company: "Increase sales" · "Run my company" · "Hire a developer"'
          disabled={busy}
          className="flex-1 px-5 py-4 rounded-2xl bg-surface border border-border text-text text-base outline-none focus:border-accent disabled:opacity-50"
        />
        <Button type="submit" disabled={!textCmd.trim() || busy} size="lg" className="px-8">
          <Send size={18} />
          Execute
        </Button>
      </form>

      {/* Quick commands */}
      <div className="flex flex-wrap gap-2">
        {[
          "Increase sales.",
          "Run my company.",
          "Reply to customers.",
          "Create marketing campaign.",
          "Generate weekly report.",
          "Hire a salesperson.",
          "Check cash flow.",
          "Fire underperforming vendor.",
        ].map((cmd) => (
          <button
            key={cmd}
            onClick={() => execute(cmd)}
            disabled={busy}
            className="px-3 py-1.5 text-sm text-text-2 bg-surface border border-border rounded-lg hover:border-accent/40 hover:text-accent disabled:opacity-50"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* AI modules status */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {MODULES.map((m) => (
          <div key={m.label} className="p-4 rounded-xl bg-surface border border-border">
            <p className="text-xs text-text-3 uppercase tracking-wider mb-1">{m.label}</p>
            <p className={`text-sm font-medium ${m.color}`}>{m.status}</p>
          </div>
        ))}
      </div>

      {/* Voice assistant (optional) */}
      <section className="rounded-2xl bg-surface/30 border border-border/50 py-6">
        <SiriAssistant
          onCommandComplete={(r) => {
            setLastResponse(r);
            setHistory((h) => [r, ...h].slice(0, 20));
            logCommand(r);
          }}
        />
      </section>

      {lastResponse && (
        <section className="p-6 rounded-2xl bg-surface border border-accent/20">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
              <Zap size={14} className="text-white" />
            </div>
            <div>
              <p className="text-sm text-text-2">
                Executing: <span className="text-text font-medium">&ldquo;{lastResponse.command}&rdquo;</span>
              </p>
              <p className="text-text mt-1">{lastResponse.summary}</p>
            </div>
          </div>
          <TaskList tasks={lastResponse.tasks} animate />
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium text-text-2 mb-4 uppercase tracking-wider">Business overview</h2>
        <MetricsGrid metrics={DEMO_METRICS} />
      </section>

      {history.length > 1 && (
        <section>
          <h2 className="text-sm font-medium text-text-2 mb-4 uppercase tracking-wider">Recent commands</h2>
          <div className="space-y-2">
            {history.slice(1, 8).map((h) => (
              <div key={h.command + h.intent} className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border">
                <div>
                  <p className="text-sm font-medium">{h.command}</p>
                  <p className="text-xs text-text-3">{h.tasks.length} actions · {h.intent}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-success/10 text-success">Done</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
