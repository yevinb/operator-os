"use client";

import { cn } from "@/lib/utils";
import type { VoiceState } from "@/lib/voice";

interface SiriOrbProps {
  state: VoiceState;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  className?: string;
}

const SIZES = {
  sm: { orb: "w-20 h-20", ring: "w-28 h-28", core: "w-12 h-12" },
  md: { orb: "w-32 h-32", ring: "w-44 h-44", core: "w-20 h-20" },
  lg: { orb: "w-40 h-40", ring: "w-56 h-56", core: "w-28 h-28" },
};

export function SiriOrb({ state, size = "lg", onClick, className }: SiriOrbProps) {
  const s = SIZES[size];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center rounded-full outline-none",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-void",
        "transition-transform duration-300 active:scale-95",
        s.orb,
        className
      )}
      aria-label={
        state === "listening"
          ? "Listening… tap to stop"
          : state === "speaking"
            ? "Speaking… tap to interrupt"
            : "Tap to speak"
      }
    >
      {/* Outer pulse rings */}
      {(state === "listening" || state === "speaking") && (
        <>
          <span
            className={cn(
              "absolute rounded-full border border-accent/30 siri-ring-1",
              s.ring
            )}
          />
          <span
            className={cn(
              "absolute rounded-full border border-accent/20 siri-ring-2",
              s.ring
            )}
          />
          <span
            className={cn(
              "absolute rounded-full border border-accent/10 siri-ring-3",
              s.ring
            )}
          />
        </>
      )}

      {/* Processing spinner ring */}
      {state === "processing" && (
        <span
          className={cn(
            "absolute rounded-full border-2 border-transparent border-t-accent border-r-accent/50 siri-spin",
            s.ring
          )}
        />
      )}

      {/* Main orb */}
      <span
        className={cn(
          "absolute rounded-full siri-orb-gradient transition-all duration-500",
          s.core,
          state === "listening" && "siri-orb-listening scale-110",
          state === "speaking" && "siri-orb-speaking",
          state === "processing" && "siri-orb-processing opacity-80",
          state === "error" && "siri-orb-error",
          state === "idle" && "siri-orb-idle hover:scale-105"
        )}
      />

      {/* Waveform bars when listening */}
      {state === "listening" && (
        <div className="absolute flex items-center justify-center gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-white/90 siri-wave-bar"
              style={{ animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
      )}

      {/* Speaking glow */}
      {state === "speaking" && (
        <div className="absolute flex items-center justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-white/80 siri-speak-dot"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      )}

      {/* Idle mic hint */}
      {state === "idle" && (
        <svg
          className="relative z-10 w-8 h-8 text-white/90"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
          />
        </svg>
      )}
    </button>
  );
}
