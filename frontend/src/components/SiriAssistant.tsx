"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Send, Mic } from "lucide-react";
import { SiriOrb } from "./SiriOrb";
import { useVoice } from "@/hooks/useVoice";
import { buildSpokenResponse } from "@/lib/voice";
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
  const [expanded, setExpanded] = useState(fullscreen);
  const [lastHeard, setLastHeard] = useState("");
  const [typedCommand, setTypedCommand] = useState("");
  const processingRef = useRef(false);
  const setProcessingRef = useRef<(() => void) | null>(null);
  const speakRef = useRef<((text: string) => Promise<void>) | null>(null);

  const executeCommand = useCallback(
    async (command: string) => {
      const trimmed = command.trim();
      if (!trimmed || processingRef.current) return;

      processingRef.current = true;
      setProcessingRef.current?.();
      setLastHeard(trimmed);
      setResponseText("");
      setTypedCommand(trimmed);

      try {
        const response = await runCommand(trimmed);
        const spoken = buildSpokenResponse(
          response.command,
          response.summary,
          response.tasks.length
        );
        setResponseText(spoken);
        onCommandComplete?.(response);
        await speakRef.current?.(spoken);
      } catch {
        setResponseText("Something went wrong. Try again.");
      } finally {
        processingRef.current = false;
      }
    },
    [onCommandComplete]
  );

  const handleSpeechEnd = useCallback(
    (text: string) => {
      executeCommand(text);
    },
    [executeCommand]
  );

  const voice = useVoice(handleSpeechEnd);
  setProcessingRef.current = voice.setProcessing;
  speakRef.current = voice.speak;

  const liveText =
    [voice.transcript, voice.interimTranscript].filter(Boolean).join(" ").trim();

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
    setLastHeard("");
    if (!expanded) setExpanded(true);
    voice.startListening();
  };

  const handleTypedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = typedCommand.trim();
    if (cmd) executeCommand(cmd);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !e.repeat &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        if (voice.state === "idle") {
          setResponseText("");
          setLastHeard("");
          if (!expanded) setExpanded(true);
          voice.startListening();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && voice.state === "listening") {
        e.preventDefault();
        voice.stopListening();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [voice, expanded]);

  if (!voice.isSupported) {
    return (
      <div className={cn("text-center p-6 max-w-md mx-auto", className)}>
        <p className="text-text-2 text-sm mb-4">
          Voice not supported in this browser. Type your command below.
        </p>
        <form onSubmit={handleTypedSubmit} className="flex gap-2">
          <input
            value={typedCommand}
            onChange={(e) => setTypedCommand(e.target.value)}
            placeholder='e.g. "Increase sales"'
            className="flex-1 px-4 py-3 rounded-xl bg-surface border border-border text-text outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="px-4 py-3 rounded-xl bg-accent text-white font-medium"
          >
            Run
          </button>
        </form>
      </div>
    );
  }

  const content = (
    <div className="flex flex-col items-center justify-center w-full max-w-lg mx-auto">
      {/* Status bar — always visible */}
      <div className="w-full mb-6 px-4 py-3 rounded-xl bg-surface-2/80 border border-border text-center">
        <p className="text-xs text-text-3 uppercase tracking-wider mb-1">Status</p>
        <p className={cn(
          "text-sm",
          voice.error ? "text-danger" : voice.state === "listening" ? "text-accent" : "text-text-2"
        )}>
          {voice.error || voice.statusHint || (voice.state === "idle" ? "Ready — tap orb to speak" : "")}
        </p>
      </div>

      <div className="min-h-[72px] text-center mb-6 px-4">
        {voice.state === "listening" && (
          <p className="text-text text-2xl font-light typing-cursor">
            {liveText || "Say your command…"}
          </p>
        )}
        {voice.state === "processing" && (
          <p className="text-text text-xl">&ldquo;{lastHeard}&rdquo;</p>
        )}
        {voice.state === "speaking" && (
          <p className="text-text text-base leading-relaxed">{responseText}</p>
        )}
        {voice.state === "idle" && !liveText && !responseText && (
          <p className="text-text-2 text-xl font-light">What should I run?</p>
        )}
      </div>

      <SiriOrb state={voice.state} size="lg" onClick={handleOrbClick} />

      <p className="mt-6 text-text-3 text-sm text-center">
        {voice.state === "listening"
          ? "Speak now — stops automatically when you pause"
          : "Tap orb · or type below"}
      </p>

      {/* Always-visible text fallback */}
      <form onSubmit={handleTypedSubmit} className="w-full mt-6 flex gap-2">
        <input
          value={typedCommand}
          onChange={(e) => setTypedCommand(e.target.value)}
          placeholder='Type command: "Increase sales"'
          disabled={voice.state === "processing" || voice.state === "listening"}
          className="flex-1 px-4 py-3 rounded-xl bg-surface border border-border text-text text-sm outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!typedCommand.trim() || voice.state === "processing"}
          className="px-4 py-3 rounded-xl bg-accent text-white disabled:opacity-40 flex items-center gap-1.5"
        >
          <Send size={16} />
          Run
        </button>
      </form>

      {liveText && voice.state === "idle" && !responseText && (
        <button
          onClick={() => executeCommand(liveText)}
          className="mt-3 flex items-center gap-2 text-sm text-accent hover:underline"
        >
          <Mic size={14} />
          Run what I said: &ldquo;{liveText.slice(0, 40)}{liveText.length > 40 ? "…" : ""}&rdquo;
        </button>
      )}

      {voice.state === "idle" && (
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {["Increase sales.", "Run my company.", "Reply to customers."].map((cmd) => (
            <button
              key={cmd}
              onClick={() => {
                setTypedCommand(cmd);
                executeCommand(cmd);
              }}
              className="px-3 py-1.5 text-xs text-text-2 bg-surface-2 border border-border rounded-full hover:bg-surface-3"
            >
              {cmd}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (fullscreen || expanded) {
    return (
      <>
        {!fullscreen && (
          <div
            className="fixed inset-0 bg-void/80 backdrop-blur-sm z-40"
            onClick={() => {
              if (voice.state === "idle") {
                setExpanded(false);
                setResponseText("");
              }
            }}
          />
        )}
        <div
          className={cn(
            fullscreen ? "relative py-8" : "fixed inset-0 z-50 flex items-center justify-center px-6",
            className
          )}
        >
          {!fullscreen && voice.state === "idle" && (
            <button
              onClick={() => setExpanded(false)}
              className="absolute top-6 right-6 p-2 rounded-full bg-surface-2 text-text-2"
            >
              <X size={20} />
            </button>
          )}
          {content}
        </div>
      </>
    );
  }

  return (
    <div className={cn("flex flex-col items-center py-6", className)}>
      {content}
    </div>
  );
}
