"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { coachChat } from "@/lib/api";

export function CoachPanel({ onDone }: { onDone?: (cmd?: string, niche?: string) => void }) {
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "nexa" | "user"; text: string }[]>([
    { role: "nexa", text: "Hi — I'm Nexa. I run your business, not just chat. What's your name and what business do you want to build?" },
  ]);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const res = await coachChat(text, step);
      setStep(res.next_step);
      setMessages((m) => [...m, { role: "nexa", text: res.reply }]);
      if (res.done && res.suggested_command) {
        onDone?.(res.suggested_command, res.niche_mode);
      }
    } catch {
      setMessages((m) => [...m, { role: "nexa", text: "Tell me one outcome — e.g. Get me 30 leads this month." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-premium rounded-2xl p-5 border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle size={18} className="text-gold" />
        <p className="text-sm font-bold">Nexa coach — spoon-fed setup</p>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto mb-3 text-sm">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "nexa" ? "text-text-2" : "text-white font-medium"}>
            {m.role === "nexa" ? "Nexa: " : "You: "}
            {m.text}
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Talk to Nexa like a friend…"
          className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-sm outline-none focus:border-gold"
        />
        <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl bg-gold text-black text-sm font-bold disabled:opacity-40">
          Send
        </button>
      </form>
    </div>
  );
}
