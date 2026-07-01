"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { nexaChat } from "@/lib/api";
import { getBusinessContext } from "@/lib/business-context";
import { getSession } from "@/lib/auth";
import { logCommand } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";
import { TaskList } from "@/components/TaskList";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "nexa_chat_history";

const STARTERS = [
  "Get me 50 leads this month",
  "What can you do for my business?",
  "Check my Stripe balance",
  "Grow my Instagram followers",
  "Help me launch a marketing campaign",
];

function loadHistory(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const ctx = getBusinessContext();
  const company = ctx.company || getSession()?.company || "your business";
  return [{
    id: "welcome",
    role: "nexa",
    content: `Hey — I'm Nexa, your AI operator for ${company}. Chat naturally, or tell me an outcome and I'll build the plan and run it live.`,
    timestamp: new Date().toISOString(),
  }];
}

function saveHistory(messages: ChatMessage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-80)));
}

export function NexaChat({ compact = false }: { compact?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessages(loadHistory());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setError("");
    setBusy(true);

    try {
      const apiHistory = history
        .filter((m) => m.id !== "welcome")
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await nexaChat(content, apiHistory);
      const nexaMsg: ChatMessage = {
        id: `n_${Date.now()}`,
        role: "nexa",
        content: res.reply,
        timestamp: new Date().toISOString(),
        executed: res.executed,
        commandResponse: res.command_response,
      };

      if (res.executed && res.command_response) {
        logCommand(res.command_response);
      }

      const next = [...history, nexaMsg];
      setMessages(next);
      saveHistory(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed — try again.");
      const errMsg: ChatMessage = {
        id: `e_${Date.now()}`,
        role: "nexa",
        content: "Sorry — I couldn't reach the server. Check you're signed in and try again.",
        timestamp: new Date().toISOString(),
      };
      const next = [...history, errMsg];
      setMessages(next);
      saveHistory(next);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-3xl border border-gold/25 bg-black/40 backdrop-blur-xl overflow-hidden",
        compact ? "h-[520px]" : "h-[calc(100vh-8rem)] min-h-[560px]"
      )}
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-gradient-to-r from-gold/10 to-transparent">
        <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
          <Sparkles size={18} className="text-gold" />
        </div>
        <div>
          <p className="font-bold text-white">Talk to Nexa</p>
          <p className="text-xs text-text-2">Chat naturally — I'll execute outcomes live</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[88%] md:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-gold text-black font-medium rounded-br-md"
                  : "bg-surface border border-white/10 text-text rounded-bl-md"
              )}
            >
              {m.content}
              {m.executed && m.commandResponse && (
                <div className="mt-4 pt-3 border-t border-white/10 space-y-3">
                  <p className="text-xs font-bold text-success uppercase tracking-wide">
                    {(m.commandResponse.executed_count ?? 0)} verified · {(m.commandResponse.planned_count ?? 0)} planned
                  </p>
                  <TaskList tasks={m.commandResponse.tasks} animate={false} />
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="bg-surface border border-white/10 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2 text-sm text-text-2">
              <Loader2 size={16} className="animate-spin text-gold" />
              Nexa is thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 2 && !busy && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="px-3 py-1.5 rounded-full text-xs border border-white/10 text-text-2 hover:border-gold/40 hover:text-gold transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p className="px-4 text-danger text-xs">{error}</p>}

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="p-4 border-t border-white/10 flex gap-2"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Nexa… e.g. Get me 30 leads this month"
          disabled={busy}
          className="flex-1 px-4 py-3 rounded-2xl bg-void border border-white/10 text-white text-sm outline-none focus:border-gold disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || busy}
          className="px-5 py-3 rounded-2xl bg-gold text-black font-bold disabled:opacity-40 flex items-center gap-2"
        >
          <Send size={16} />
          Send
        </button>
      </form>
    </div>
  );
}
