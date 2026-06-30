"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { X, Send, CheckCircle2, Zap, Mic } from "lucide-react";
import { SiriOrb } from "./SiriOrb";
import { TaskList } from "./TaskList";
import { useVoice } from "@/hooks/useVoice";
import { buildSpokenResponse, getBrowserProfile } from "@/lib/voice";
import { runCommand } from "@/lib/api";
import type { CommandResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SiriAssistantProps {
  onCommandComplete?: (response: CommandResponse) => void;
  fullscreen?: boolean;
  className?: string;
}

export function SiriAssistant({
  onCommandComplete,
  fullscreen = false,
  className,
}: SiriAssistantProps) {
  const [responseText, setResponseText] = useState("");
  const [lastResponse, setLastResponse] = useState<CommandResponse | null>(null);
  const [expanded, setExpanded] = useState(fullscreen);
  const [lastHeard, setLastHeard] = useState("");
  const [typedCommand, setTypedCommand] = useState("");
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<ReturnType<typeof getBrowserProfile> | null>(null);
  const processingRef = useRef(false);
  const speakRef = useRef<((text: string) => Promise<void>) | null>(null);
  const setProcessingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setProfile(getBrowserProfile());
    setMounted(true);
  }, []);

  const run = useCallback(
    async (command: string) => {
      const trimmed = command.trim();
      if (!trimmed || processingRef.current) return;

      processingRef.current = true;
      setProcessingRef.current?.();
      setLastHeard(trimmed);
      setTypedCommand(trimmed);
      setLastResponse(null);
      setResponseText("");

      try {
        const response = await runCommand(trimmed);
        setLastResponse(response);

        const spoken = buildSpokenResponse(
          response.command,
          response.summary,
          response.tasks.length
        );
        setResponseText(spoken);
        onCommandComplete?.(response);
        speakRef.current?.(spoken);
      } catch {
        setResponseText("Something went wrong. Try again.");
      } finally {
        processingRef.current = false;
      }
    },
    [onCommandComplete]
  );

  const voice = useVoice((text) => run(text));
  speakRef.current = voice.speak;
  setProcessingRef.current = voice.setProcessing;

  const liveText =
    [voice.transcript, voice.interimTranscript].filter(Boolean).join(" ").trim();

  const isSafariMac = profile?.isSafari && profile?.isMac;

  const handleOrbClick = () => {
    if (voice.state === "speaking") {
      voice.cancelSpeech();
      return;
    }
    if (voice.state === "listening") {
      voice.stopListening();
      return;
    }
    if (voice.state === "processing") return;

    setResponseText("");
    setLastResponse(null);
    setLastHeard("");
    if (!expanded) setExpanded(true);
    voice.startListening();
  };

  const handleDone = () => {
    if (voice.state === "listening") voice.stopListening();
  };

  const handleTypedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = typedCommand.trim();
    if (cmd) run(cmd);
  };

  if (!mounted) {
    return (
      <div className={cn("text-center p-8 text-text-2 text-sm", className)}>
        Loading voice…
      </div>
    );
  }

  const inputForm = (
    <form onSubmit={handleTypedSubmit} className="w-full flex gap-2">
      <input
        value={typedCommand}
        onChange={(e) => setTypedCommand(e.target.value)}
        placeholder='Type: "Increase sales"'
        disabled={voice.state === "processing" || voice.state === "listening"}
        className="flex-1 px-4 py-3 rounded-xl bg-surface border border-border text-text text-sm outline-none focus:border-accent disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={!typedCommand.trim() || voice.state === "processing"}
        className="px-5 py-3 rounded-xl bg-accent text-white font-medium disabled:opacity-40 flex items-center gap-1.5 shrink-0"
      >
        <Send size={16} />
        Run
      </button>
    </form>
  );

  if (!voice.isSupported) {
    const reason = profile?.isIOS
      ? "iPhone/iPad can't use web voice — type or tap a chip below."
      : profile?.isFirefox
        ? "Firefox doesn't support voice — type or tap a chip below."
        : "Voice not available — type or tap a chip below.";

    return (
      <div className={cn("text-center p-6 max-w-lg mx-auto w-full", className)}>
        <p className="text-text-2 text-sm mb-4">{reason}</p>
        {inputForm}
        <QuickChips onSelect={(cmd) => { setTypedCommand(cmd); run(cmd); }} />
        {lastResponse && <ResultsPanel response={lastResponse} spoken={responseText} />}
      </div>
    );
  }

  const content = (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto">
      <div className="w-full mb-4 px-4 py-3 rounded-xl bg-surface-2 border border-border text-center">
        <p className="text-xs text-text-3 uppercase tracking-wider mb-1">
          {voice.browserLabel || profile?.label} · Voice ready
        </p>
        <p className={cn(
          "text-sm font-medium",
          voice.error ? "text-danger" : voice.state === "listening" ? "text-accent" : "text-text"
        )}>
          {voice.error || voice.statusHint ||
            (isSafariMac
              ? "Tap orb → speak → pause (sends automatically)"
              : "Tap orb → speak → tap DONE")}
        </p>
      </div>

      {voice.state === "listening" && (
        <div className="w-full mb-4 p-4 rounded-xl bg-accent/10 border border-accent/30 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Mic size={14} className="text-accent animate-pulse" />
            <p className="text-accent text-xs font-medium uppercase tracking-wider">Mic active</p>
          </div>
          <p className="text-text text-2xl font-light min-h-[40px]">
            {liveText || "Start speaking…"}
          </p>
        </div>
      )}

      {voice.state === "processing" && (
        <p className="text-text text-lg mb-4 animate-pulse">
          Running: &ldquo;{lastHeard}&rdquo;
        </p>
      )}

      {voice.state === "idle" && !lastResponse && !voice.error && (
        <p className="text-text-2 text-lg mb-4">What should I run?</p>
      )}

      <SiriOrb state={voice.state} size="lg" onClick={handleOrbClick} />

      {voice.state === "listening" && !isSafariMac && (
        <button
          onClick={handleDone}
          className="mt-6 w-full max-w-xs py-4 rounded-2xl bg-success text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-success/30 hover:brightness-110 transition-all"
        >
          <CheckCircle2 size={22} />
          DONE — Run my command
        </button>
      )}

      {voice.state === "listening" && isSafariMac && (
        <p className="mt-4 text-success text-sm font-medium">
          Mac Safari: stop speaking and it runs automatically
        </p>
      )}

      <p className="mt-4 text-text-3 text-xs text-center">
        {voice.state === "listening"
          ? isSafariMac
            ? "Speak your command, then pause"
            : "Speak, then tap DONE"
          : "Works on MacBook Chrome & Safari · or type below"}
      </p>

      <div className="w-full mt-5">{inputForm}</div>

      <QuickChips
        onSelect={(cmd) => { setTypedCommand(cmd); run(cmd); }}
        disabled={voice.state === "processing" || voice.state === "listening"}
      />

      {lastResponse && <ResultsPanel response={lastResponse} spoken={responseText} />}
    </div>
  );

  if (fullscreen || expanded) {
    return (
      <>
        {!fullscreen && (
          <div
            className="fixed inset-0 bg-void/80 backdrop-blur-sm z-40"
            onClick={() => { if (voice.state === "idle") setExpanded(false); }}
          />
        )}
        <div
          className={cn(
            fullscreen ? "relative py-6" : "fixed inset-0 z-50 overflow-y-auto flex items-start justify-center px-4 py-16",
            className
          )}
        >
          {!fullscreen && voice.state === "idle" && (
            <button
              onClick={() => setExpanded(false)}
              className="fixed top-6 right-6 p-2 rounded-full bg-surface-2 text-text-2 z-50"
            >
              <X size={20} />
            </button>
          )}
          {content}
        </div>
      </>
    );
  }

  return <div className={cn("py-6", className)}>{content}</div>;
}

function QuickChips({
  onSelect,
  disabled,
}: {
  onSelect: (cmd: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2 mt-3">
      {["Increase sales.", "Run my company.", "Reply to customers."].map((cmd) => (
        <button
          key={cmd}
          disabled={disabled}
          onClick={() => onSelect(cmd)}
          className="px-3 py-1.5 text-xs text-text-2 bg-surface-2 border border-border rounded-full hover:bg-accent/20 hover:text-accent disabled:opacity-40"
        >
          {cmd}
        </button>
      ))}
    </div>
  );
}

function ResultsPanel({
  response,
  spoken,
}: {
  response: CommandResponse;
  spoken: string;
}) {
  return (
    <div className="w-full mt-6 p-5 rounded-2xl bg-surface border border-success/30">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
          <Zap size={13} className="text-white" />
        </div>
        <p className="text-sm font-medium text-success">Command executed</p>
      </div>
      <p className="text-text font-medium mb-1">&ldquo;{response.command}&rdquo;</p>
      <p className="text-text-2 text-sm mb-3">{response.summary}</p>
      {spoken && <p className="text-accent text-xs mb-4">{spoken}</p>}
      <TaskList tasks={response.tasks} animate />
    </div>
  );
}
