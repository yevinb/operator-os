export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "error";

export interface VoiceHook {
  state: VoiceState;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  error: string | null;
  statusHint: string;
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

export function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/** iOS browsers do not support Web Speech recognition. */
export function isVoiceInputAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return false;
  return !!getSpeechRecognitionCtor();
}
