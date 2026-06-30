export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "error";

export interface BrowserProfile {
  isIOS: boolean;
  isSafari: boolean;
  isFirefox: boolean;
  isMac: boolean;
  isChrome: boolean;
  label: string;
  voiceInput: boolean;
  voiceOutput: boolean;
}

export interface VoiceHook {
  state: VoiceState;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  browserLabel: string;
  error: string | null;
  statusHint: string;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => Promise<void>;
  cancelSpeech: () => void;
  setProcessing: () => void;
}

export function buildSpokenResponse(_command: string, summary: string, taskCount: number): string {
  const short = summary.replace(/\.$/, "");
  return `Got it. ${short}. I'm running ${taskCount} autonomous actions now.`;
}

export function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function getBrowserProfile(): BrowserProfile {
  if (typeof window === "undefined") {
    return {
      isIOS: false,
      isSafari: false,
      isFirefox: false,
      isMac: false,
      isChrome: false,
      label: "unknown",
      voiceInput: false,
      voiceOutput: false,
    };
  }

  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isFirefox = /Firefox\//.test(ua);
  const isChrome = /Chrome\//.test(ua) || /CriOS/.test(ua);
  const isSafari = /Safari\//.test(ua) && !isChrome && !/Edg\//.test(ua);
  const isMac = /Macintosh|Mac OS X/.test(ua) && !isIOS;
  const hasSR = !!getSpeechRecognitionCtor();

  let label = "Browser";
  if (isMac && isSafari) label = "Safari on Mac";
  else if (isMac && isChrome) label = "Chrome on Mac";
  else if (isMac && isFirefox) label = "Firefox on Mac";
  else if (isIOS) label = "iPhone/iPad";
  else if (isChrome) label = "Chrome";
  else if (isSafari) label = "Safari";

  return {
    isIOS,
    isSafari,
    isFirefox,
    isMac,
    isChrome,
    label,
    voiceInput: hasSR && !isIOS && !isFirefox,
    voiceOutput: "speechSynthesis" in window,
  };
}

export function isVoiceInputAvailable(): boolean {
  return getBrowserProfile().voiceInput;
}

/** Build full transcript from a speech recognition result event. */
export function transcriptFromEvent(
  results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } }
): { final: string; interim: string; combined: string } {
  let final = "";
  let interim = "";
  let combined = "";

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const text = result[0]?.transcript ?? "";
    combined += text;
    if (result.isFinal) final += text;
    else interim += text;
  }

  return {
    final: final.trim(),
    interim: interim.trim(),
    combined: combined.trim(),
  };
}
