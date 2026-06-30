"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Mic, MicOff, Send, Loader2 } from "lucide-react";
import { Button } from "./ui/Button";
import { cn } from "@/lib/utils";

interface CommandInputProps {
  onSubmit: (command: string) => void;
  isProcessing?: boolean;
  placeholder?: string;
  className?: string;
}

const SUGGESTIONS = [
  "Increase sales.",
  "Run my company.",
  "Reply to customers.",
  "Create a marketing campaign.",
  "Generate this week's report.",
];

export function CommandInput({
  onSubmit,
  isProcessing = false,
  placeholder = 'Say or type a command... e.g. "Increase sales."',
  className,
}: CommandInputProps) {
  const [command, setCommand] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<InstanceType<NonNullable<typeof window.SpeechRecognition>> | null>(null);

  useEffect(() => {
    const SR =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;
    setSpeechSupported(!!SR);

    if (SR) {
      const recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((r) => r[0].transcript)
          .join("");
        setCommand(transcript);
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setCommand("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = command.trim();
    if (!trimmed || isProcessing) return;
    onSubmit(trimmed);
    setCommand("");
  };

  return (
    <div className={cn("w-full", className)}>
      <form onSubmit={handleSubmit} className="relative">
        <div
          className={cn(
            "flex items-center gap-3 p-2 pl-5 rounded-2xl border transition-all duration-300",
            "bg-surface/80 backdrop-blur-xl",
            isListening
              ? "border-accent glow-accent"
              : "border-border hover:border-accent/30 focus-within:border-accent/50"
          )}
        >
          {isListening && (
            <span className="absolute -top-3 left-6 px-2 py-0.5 text-xs font-medium bg-accent text-white rounded-full">
              Listening...
            </span>
          )}

          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={placeholder}
            disabled={isProcessing}
            className="flex-1 bg-transparent text-text placeholder:text-text-3 outline-none text-lg py-3"
            autoFocus
          />

          {speechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              disabled={isProcessing}
              className={cn(
                "p-3 rounded-xl transition-all duration-200",
                isListening
                  ? "bg-danger/20 text-danger pulse-ring"
                  : "bg-surface-2 hover:bg-surface-3 text-text-2 hover:text-text"
              )}
              aria-label={isListening ? "Stop listening" : "Start voice command"}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}

          <Button
            type="submit"
            disabled={!command.trim() || isProcessing}
            size="md"
            className="rounded-xl"
          >
            {isProcessing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
            Execute
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 mt-4">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSubmit(s)}
            disabled={isProcessing}
            className="px-3 py-1.5 text-sm text-text-2 bg-surface-2 hover:bg-surface-3 hover:text-text border border-border rounded-lg transition-colors disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
