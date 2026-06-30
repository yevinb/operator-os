"use client";

import { SiriAssistant } from "./SiriAssistant";
import type { CommandResponse } from "@/lib/types";

interface SiriHeroProps {
  onTryCommand?: () => void;
}

export function SiriHero({ onTryCommand }: SiriHeroProps) {
  const handleComplete = (_response: CommandResponse) => {
    onTryCommand?.();
  };

  return (
    <div className="mt-12 p-8 rounded-3xl bg-surface/40 border border-border backdrop-blur-md max-w-xl mx-auto">
      <p className="text-center text-text-3 text-sm mb-2 uppercase tracking-widest">
        Try it now — speak like Siri
      </p>
      <SiriAssistant onCommandComplete={handleComplete} fullscreen />
    </div>
  );
}
