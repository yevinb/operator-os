"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
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
  const voice = useVoice();
  const [displayText, setDisplayText] = useState("");
  const [responseText, setResponseText] = useState("");
  const [expanded, setExpanded] = useState(fullscreen);
  const wasListeningRef = useRef(false);
  const processingRef = useRef(false);

  const liveText =
    voice.transcript || voice.interimTranscript || displayText;

  const executeCommand = useCallback(
    async (command: string) => {
      if (!command.trim() || processingRef.current) return;
      processingRef.current = true;
      voice.setProcessing();

      let response: CommandResponse;
      try {
        const { executeCommand: apiExec, getHealth } = await import("@/lib/api");
        await getHealth();
        response = await apiExec(command);
      } catch {
        response = demoExecuteCommand(command);
      }

      const spoken = buildSpokenResponse(
        response.command,
        response.summary,
        response.tasks.length
      );
      setResponseText(spoken);
      onCommandComplete?.(response);
      await voice.speak(spoken);
      processingRef.current = false;
    },
    [onCommandComplete, voice]
  );

  // Auto-execute when speech recognition ends with a transcript
  useEffect(() => {
    if (voice.state === "listening") {
      wasListeningRef.current = true;
      return;
    }

    if (
      wasListeningRef.current &&
      voice.state === "idle" &&
      voice.transcript.trim() &&
      !processingRef.current
    ) {
      wasListeningRef.current = false;
      const cmd = voice.transcript.trim();
      setDisplayText(cmd);
      executeCommand(cmd);
    }
  }, [voice.state, voice.transcript, executeCommand]);

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

    if (!expanded) setExpanded(true);
    voice.startListening();
  }, [voice, expanded]);

  // Spacebar hold to talk
  useEffect(() => {
    let spaceDown = false;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        if (!spaceDown && voice.state === "idle") {
          spaceDown = true;
          setExpanded(true);
          voice.startListening();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDown = false;
        if (voice.state === "listening") voice.stopListening();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [voice]);

  if (!voice.isSupported) {
    return (
      <div className={cn("text-center text-text-2 text-sm p-6", className)}>
        Voice not supported in this browser. Use Chrome or Safari on desktop/mobile.
      </div>
    );
  }

  const content = (
    <div className="flex flex-col items-center justify-center w-full">
      {/* Transcript / status */}
      <div className="min-h-[80px] max-w-lg text-center mb-8 px-4">
        {voice.error && (
          <p className="text-danger text-lg">{voice.error}</p>
        )}
        {!voice.error && voice.state === "idle" && !liveText && !responseText && (
          <p className="text-text-2 text-xl font-light">
            {expanded ? "What can I run for you?" : "Tap to speak"}
          </p>
        )}
        {!voice.error && voice.state === "listening" && (
          <p className="text-text text-2xl font-light typing-cursor">
            {liveText || "Listening…"}
          </p>
        )}
        {!voice.error && voice.state === "processing" && (
          <p className="text-accent text-xl font-light animate-pulse">
            Running your company…
          </p>
        )}
        {!voice.error && voice.state === "speaking" && (
          <p className="text-text text-lg font-light leading-relaxed">{responseText}</p>
        )}
        {!voice.error && voice.state === "idle" && liveText && !responseText && (
          <p className="text-text text-xl font-light">{liveText}</p>
        )}
        {!voice.error && voice.state === "idle" && responseText && !voice.transcript && (
          <p className="text-text-2 text-sm mt-2">Tap orb for another command</p>
        )}
      </div>

      <SiriOrb state={voice.state} size="lg" onClick={handleOrbClick} />

      <p className="mt-8 text-text-3 text-sm">
        {voice.state === "listening"
          ? "Release or tap again when done"
          : "Tap orb · Hold spacebar to talk"}
      </p>

      {/* Quick commands */}
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
