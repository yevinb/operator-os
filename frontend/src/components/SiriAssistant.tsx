"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Send } from "lucide-react";
import { SiriOrb } from "./SiriOrb";
import { useVoice } from "@/hooks/useVoice";
import { buildSpokenResponse } from "@/lib/voice";
import { demoExecuteCommand } from "@/lib/demo";
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
  const [displayText, setDisplayText] = useState("");
  const [responseText, setResponseText] = useState("");
  const [expanded, setExpanded] = useState(fullscreen);
  const [lastHeard, setLastHeard] = useState("");
  const processingRef = useRef(false);
  const voiceRef = useRef<ReturnType<typeof useVoice> | null>(null);

  const executeCommand = useCallback(
    async (command: string) => {
      const trimmed = command.trim();
      if (!trimmed || processingRef.current) return;

      processingRef.current = true;
      voiceRef.current?.setProcessing();
      setLastHeard(trimmed);
      setDisplayText(trimmed);
      setResponseText("");

      let response: CommandResponse;
      try {
        const { executeCommand: apiExec, getHealth } = await import("@/lib/api");
        await getHealth();
        response = await apiExec(trimmed);
      } catch {
        response = demoExecuteCommand(trimmed);
      }

      const spoken = buildSpokenResponse(
        response.command,
        response.summary,
        response.tasks.length
      );
      setResponseText(spoken);
      onCommandComplete?.(response);
      await voiceRef.current?.speak(spoken);
      processingRef.current = false;
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
  voiceRef.current = voice;

  const liveText =
    [voice.transcript, voice.interimTranscript].filter(Boolean).join(" ").trim() ||
    displayText;

  const handleOrbClick = useCallback(() => {
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
  }, [voice, expanded]);

  const handleManualRun = useCallback(() => {
    const text = liveText.trim();
    if (text) executeCommand(text);
  }, [liveText, executeCommand]);

  // Spacebar hold to talk
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
      <div className={cn("text-center text-text-2 text-sm p-6", className)}>
        Voice not supported in this browser. Use Chrome or Safari on desktop/mobile.
      </div>
    );
  }

  const content = (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="min-h-[100px] max-w-lg text-center mb-8 px-4">
        {voice.error && (
          <p className="text-danger text-base mb-2">{voice.error}</p>
        )}

        {!voice.error && voice.state === "idle" && !liveText && !responseText && (
          <p className="text-text-2 text-xl font-light">
            {expanded ? "What can I run for you?" : "Tap to speak"}
          </p>
        )}

        {voice.state === "listening" && (
          <>
            <p className="text-text-3 text-sm mb-2">Hearing you…</p>
            <p className="text-text text-2xl font-light typing-cursor">
              {liveText || "Say your command…"}
            </p>
          </>
        )}

        {voice.state === "processing" && (
          <>
            <p className="text-text-3 text-sm mb-2">You said:</p>
            <p className="text-text text-xl font-medium mb-2">&ldquo;{lastHeard}&rdquo;</p>
            <p className="text-accent text-lg font-light animate-pulse">
              Running your company…
            </p>
          </>
        )}

        {voice.state === "speaking" && (
          <>
            <p className="text-text-3 text-sm mb-2">You said: &ldquo;{lastHeard}&rdquo;</p>
            <p className="text-text text-lg font-light leading-relaxed">{responseText}</p>
          </>
        )}

        {voice.state === "idle" && liveText && !responseText && !processingRef.current && (
          <>
            <p className="text-text-3 text-sm mb-2">Heard:</p>
            <p className="text-text text-xl font-light">&ldquo;{liveText}&rdquo;</p>
          </>
        )}

        {voice.state === "idle" && responseText && (
          <p className="text-text-3 text-sm mt-2">Tap orb for another command</p>
        )}
      </div>

      <SiriOrb state={voice.state} size="lg" onClick={handleOrbClick} />

      <p className="mt-8 text-text-3 text-sm text-center">
        {voice.state === "listening"
          ? "Speak now — tap orb again when finished"
          : "Tap orb to talk · tap again to send"}
      </p>

      {/* Fallback run button if voice captured but user wants to confirm */}
      {voice.state === "idle" && liveText && !responseText && (
        <button
          onClick={handleManualRun}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-bright transition-colors"
        >
          <Send size={16} />
          Run &ldquo;{liveText.length > 30 ? liveText.slice(0, 30) + "…" : liveText}&rdquo;
        </button>
      )}

      {voice.state === "idle" && (
        <div className="flex flex-wrap justify-center gap-2 mt-6 max-w-md">
          {["Increase sales.", "Run my company.", "Reply to customers."].map((cmd) => (
            <button
              key={cmd}
              onClick={() => {
                setDisplayText(cmd);
                setResponseText("");
                executeCommand(cmd);
              }}
              className="px-3 py-1.5 text-xs text-text-2 bg-surface-2/80 hover:bg-surface-3 border border-border rounded-full transition-colors"
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
            fullscreen
              ? "relative py-12"
              : "fixed inset-0 z-50 flex flex-col items-center justify-center px-6",
            className
          )}
        >
          {!fullscreen && voice.state === "idle" && (
            <button
              onClick={() => setExpanded(false)}
              className="absolute top-6 right-6 p-2 rounded-full bg-surface-2 text-text-2 hover:text-text"
              aria-label="Close"
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
    <div className={cn("flex flex-col items-center py-8", className)}>
      {content}
      <button
        onClick={() => setExpanded(true)}
        className="mt-4 text-xs text-accent hover:underline"
      >
        Open full voice mode
      </button>
    </div>
  );
}
