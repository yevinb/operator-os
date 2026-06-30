"use client";

import { useState } from "react";
import { Check, Plug } from "lucide-react";
import { getIntegrations, toggleIntegration } from "@/lib/store";
import type { Integration } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORIES = ["all", "marketing", "sales", "finance", "support", "hr", "operations", "automation", "communication"];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>(getIntegrations);
  const [filter, setFilter] = useState("all");

  const connect = (id: string) => {
    setIntegrations(toggleIntegration(id));
  };

  const filtered =
    filter === "all" ? integrations : integrations.filter((i) => i.category === filter);

  const connected = integrations.filter((i) => i.connected).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Integrations</h1>
          <p className="text-text-2 text-sm">
            Connect your stack. OperatorOS automates via n8n, MCP, and direct APIs.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-accent">{connected}</p>
          <p className="text-xs text-text-3">connected</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn(
              "px-3 py-1.5 text-xs rounded-full border capitalize transition-colors",
              filter === c
                ? "bg-accent/10 border-accent text-accent"
                : "border-border text-text-2 hover:border-accent/30"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((int) => (
          <div
            key={int.id}
            className={cn(
              "p-5 rounded-2xl border transition-colors",
              int.connected
                ? "bg-success/5 border-success/30"
                : "bg-surface border-border hover:border-accent/20"
            )}
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{int.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{int.name}</h3>
                  {int.connected && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success flex items-center gap-1">
                      <Check size={10} /> Connected
                    </span>
                  )}
                </div>
                <p className="text-sm text-text-2 mt-1">{int.description}</p>
                <p className="text-xs text-text-3 mt-2 capitalize">{int.category}</p>
              </div>
            </div>
            <button
              onClick={() => connect(int.id)}
              className={cn(
                "mt-4 w-full py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2",
                int.connected
                  ? "bg-surface-2 text-text-2 hover:bg-surface-3"
                  : "bg-accent text-white hover:bg-accent-bright"
              )}
            >
              <Plug size={14} />
              {int.connected ? "Disconnect" : "Connect"}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 p-5 rounded-2xl bg-surface-2 border border-border">
        <h3 className="font-semibold mb-2">Automation stack</h3>
        <p className="text-sm text-text-2">
          <strong className="text-text">n8n</strong> — workflow automation ·{" "}
          <strong className="text-text">MCP</strong> — AI tool servers ·{" "}
          <strong className="text-text">Browser automation</strong> — web tasks ·{" "}
          <strong className="text-text">Redis</strong> — task queue ·{" "}
          <strong className="text-text">PostgreSQL</strong> — business memory ·{" "}
          <strong className="text-text">Vector DB</strong> — long-term AI memory
        </p>
      </div>
    </div>
  );
}
