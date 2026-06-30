"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Zap,
  ArrowLeft,
  Activity,
  LayoutDashboard,
  Settings,
  Wifi,
  WifiOff,
  Mic,
} from "lucide-react";
import { SiriAssistant } from "@/components/SiriAssistant";
import { CommandInput } from "@/components/CommandInput";
import { MetricsGrid } from "@/components/MetricsGrid";
import { TaskList } from "@/components/TaskList";
import { Button } from "@/components/ui/Button";
import { demoExecuteCommand, DEMO_METRICS } from "@/lib/demo";
import { runCommand } from "@/lib/api";
import { buildSpokenResponse } from "@/lib/voice";
import type { CommandResponse } from "@/lib/types";

export default function DashboardPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState<CommandResponse | null>(null);
  const [history, setHistory] = useState<CommandResponse[]>([]);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

  const handleCommand = useCallback(async (command: string) => {
    setIsProcessing(true);
    setLastResponse(null);

    try {
      const response = await runCommand(command);
      setBackendOnline(false);
      setLastResponse(response);
      setHistory((prev) => [response, ...prev].slice(0, 10));
      return response;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleSiriComplete = useCallback(
    (response: CommandResponse) => {
      setLastResponse(response);
      setHistory((prev) => [response, ...prev].slice(0, 10));
      setVoiceOpen(false);
    },
    []
  );

  return (
    <div className="min-h-screen bg-void grid-bg">
      {/* Floating Siri launcher */}
      <button
        onClick={() => setVoiceOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-accent shadow-lg shadow-accent/40 flex items-center justify-center hover:scale-105 transition-transform lg:hidden"
        aria-label="Open voice assistant"
      >
        <Mic size={22} className="text-white" />
      </button>

      {/* Siri fullscreen overlay */}
      {voiceOpen && (
        <div className="fixed inset-0 z-50 bg-void/95 backdrop-blur-xl flex flex-col">
          <button
            onClick={() => setVoiceOpen(false)}
            className="absolute top-6 right-6 text-text-2 hover:text-text text-sm z-10"
          >
            Close
          </button>
          <div className="flex-1 flex items-center justify-center">
            <SiriAssistant onCommandComplete={handleSiriComplete} fullscreen />
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 border-r border-border bg-ink/90 backdrop-blur-xl hidden lg:flex flex-col z-40">
        <div className="p-6 border-b border-border">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-semibold">OperatorOS</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {[
            { icon: LayoutDashboard, label: "Command Center", active: true },
            { icon: Activity, label: "Activity Log", active: false },
            { icon: Settings, label: "Integrations", active: false },
          ].map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-colors ${
                item.active
                  ? "bg-accent/10 text-accent"
                  : "text-text-2 hover:bg-surface-2 hover:text-text"
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-text-3">
            {backendOnline === true ? (
              <>
                <Wifi size={12} className="text-success" />
                <span>Backend connected</span>
              </>
            ) : backendOnline === false ? (
              <>
                <WifiOff size={12} className="text-warning" />
                <span>Demo mode</span>
              </>
            ) : (
              <span>Voice ready</span>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="lg:ml-64 min-h-screen">
        <header className="sticky top-0 z-30 border-b border-border bg-void/80 backdrop-blur-xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="lg:hidden">
              <Button variant="ghost" size="sm">
                <ArrowLeft size={16} />
              </Button>
            </Link>
            <div>
              <h1 className="font-semibold">Command Center</h1>
              <p className="text-xs text-text-3">Say it. It runs.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs rounded-full bg-success/10 text-success border border-success/20">
              AI Active
            </span>
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
              CEO
            </div>
          </div>
        </header>

        <div className="p-6 max-w-5xl mx-auto space-y-8">
          {/* Siri — primary interface */}
          <section className="py-8 rounded-3xl bg-surface/30 border border-border/50">
            <h2 className="text-sm font-medium text-text-2 mb-2 uppercase tracking-wider text-center">
              Operator — your AI COO
            </h2>
            <p className="text-center text-text-3 text-sm mb-4">
              Tap the orb or hold spacebar · speaks back like Siri
            </p>
            <SiriAssistant onCommandComplete={handleSiriComplete} />
          </section>

          {/* Text fallback */}
          <section>
            <button
              onClick={() => setShowTextInput(!showTextInput)}
              className="text-sm text-text-3 hover:text-text-2 mb-4"
            >
              {showTextInput ? "Hide keyboard input" : "Type instead →"}
            </button>
            {showTextInput && (
              <CommandInput onSubmit={handleCommand} isProcessing={isProcessing} />
            )}
          </section>

          {lastResponse && (
            <section className="p-6 rounded-2xl bg-surface border border-accent/20">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                  <Zap size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-sm text-text-2 mb-1">
                    Executing:{" "}
                    <span className="text-text font-medium">
                      &ldquo;{lastResponse.command}&rdquo;
                    </span>
                  </p>
                  <p className="text-text">{lastResponse.summary}</p>
                  <p className="text-xs text-accent mt-2">
                    {buildSpokenResponse(
                      lastResponse.command,
                      lastResponse.summary,
                      lastResponse.tasks.length
                    )}
                  </p>
                </div>
              </div>
              <TaskList tasks={lastResponse.tasks} animate />
            </section>
          )}

          <section>
            <h2 className="text-sm font-medium text-text-2 mb-4 uppercase tracking-wider">
              Business overview
            </h2>
            <MetricsGrid metrics={DEMO_METRICS} />
          </section>

          {history.length > 1 && (
            <section>
              <h2 className="text-sm font-medium text-text-2 mb-4 uppercase tracking-wider">
                Recent commands
              </h2>
              <div className="space-y-3">
                {history.slice(1).map((h) => (
                  <div
                    key={h.command + h.intent}
                    className="p-4 rounded-xl bg-surface border border-border flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{h.command}</p>
                      <p className="text-xs text-text-3">{h.tasks.length} actions completed</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-success/10 text-success">
                      Done
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
