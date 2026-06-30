export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "error";

export interface VoiceHook {
  state: VoiceState;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => Promise<void>;
  cancelSpeech: () => void;
  setProcessing: () => void;
}

export function buildSpokenResponse(command: string, summary: string, taskCount: number): string {
  const short = summary.replace(/\.$/, "");
  return `Got it. ${short}. I'm running ${taskCount} autonomous actions now.`;
}
