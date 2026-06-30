/**
 * Cross-browser speech engine.
 * Called synchronously from click handlers (required by Safari/Chrome).
 */

import {
  getBrowserProfile,
  getSpeechRecognitionCtor,
} from "./voice";

export type SpeechState = "idle" | "listening";

export interface SpeechEngineCallbacks {
  onStateChange: (state: SpeechState) => void;
  onTranscript: (final: string, interim: string, combined: string) => void;
  onStatus: (hint: string) => void;
  onError: (message: string) => void;
  onComplete: (heard: string) => void;
}

export class SpeechEngine {
  private recognition: InstanceType<NonNullable<ReturnType<typeof getSpeechRecognitionCtor>>> | null = null;
  private callbacks: SpeechEngineCallbacks;
  private finalText = "";
  private interimText = "";
  private listening = false;
  private processed = false;
  private profile = getBrowserProfile();

  constructor(callbacks: SpeechEngineCallbacks) {
    this.callbacks = callbacks;
  }

  private combined() {
    const c = `${this.finalText} ${this.interimText}`.trim();
    return c || this.finalText || this.interimText;
  }

  private finish() {
    if (this.processed) return;
    this.processed = true;
    this.listening = false;

    const heard = this.combined();
    this.interimText = "";
    this.callbacks.onStateChange("idle");

    if (heard) {
      this.finalText = heard;
      this.callbacks.onTranscript(heard, "", heard);
      this.callbacks.onStatus(`Heard: "${heard}" — running now…`);
      this.callbacks.onComplete(heard);
    } else {
      this.callbacks.onError(
        this.profile.isSafari
          ? "Didn't catch that. Tap orb, speak, wait a beat — it sends automatically on Mac Safari."
          : "Didn't catch that. Tap orb, speak, then tap DONE."
      );
      this.callbacks.onStatus("");
    }
  }

  /** Start listening — MUST be called synchronously inside a user click/tap. */
  start(): boolean {
    const SR = getSpeechRecognitionCtor();
    if (!SR) {
      this.callbacks.onError("Voice not supported. Use the text box below.");
      return false;
    }

    this.abort();
    window.speechSynthesis?.cancel();

    this.finalText = "";
    this.interimText = "";
    this.listening = false;
    this.processed = false;

    const recognition = new SR();
    // Safari Mac: single utterance, auto-stops on pause (most reliable)
    // Chrome/Edge: continuous until user taps DONE
    recognition.continuous = !this.profile.isSafari;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      this.listening = true;
      this.processed = false;
      this.callbacks.onStateChange("listening");
      this.callbacks.onStatus(
        this.profile.isSafari
          ? "Listening… say your command (auto-sends when you pause)"
          : "Listening… say your command, then tap DONE"
      );
    };

    recognition.onresult = (event) => {
      let final = "";
      let interim = "";
      let combined = "";
      const results = event.results;
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const text = result[0]?.transcript ?? "";
        combined += text;
        if (result.isFinal) final += text;
        else interim += text;
      }
      combined = combined.trim();
      final = final.trim();
      interim = interim.trim();

      if (combined) this.finalText = combined;
      if (interim) this.interimText = interim;
      if (final && !this.profile.isSafari) this.finalText = combined || final;
      this.callbacks.onTranscript(this.finalText, this.interimText, this.combined());
    };

    recognition.onend = () => {
      if (this.listening && !this.processed) {
        // Safari needs a bit more time for final results
        const delay = this.profile.isSafari ? 350 : 200;
        setTimeout(() => this.finish(), delay);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") return;

      const heard = this.combined();
      if (heard) {
        setTimeout(() => this.finish(), 100);
        return;
      }

      this.listening = false;
      this.processed = true;
      this.callbacks.onStateChange("idle");

      if (event.error === "not-allowed") {
        this.callbacks.onError(
          "Microphone blocked. On Mac: System Settings → Privacy → Microphone → enable your browser."
        );
      } else if (event.error === "no-speech") {
        this.callbacks.onError("No speech heard. Speak louder and try again.");
      } else if (event.error === "network") {
        this.callbacks.onError("Network error. Check internet and try again.");
      } else {
        this.callbacks.onError(`Voice error (${event.error}). Type your command below.`);
      }
      this.callbacks.onStatus("");
    };

    this.recognition = recognition;

    try {
      recognition.start();
      return true;
    } catch {
      this.callbacks.onError("Mic busy — wait 1 second and tap again.");
      this.callbacks.onStateChange("idle");
      return false;
    }
  }

  stop() {
    if (!this.listening) return;
    this.callbacks.onStatus("Processing what you said…");
    try {
      this.recognition?.stop();
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      if (!this.processed) this.finish();
    }, 400);
  }

  abort() {
    try {
      this.recognition?.abort();
    } catch {
      /* ignore */
    }
    this.recognition = null;
    this.listening = false;
  }
}

/** Cross-browser text-to-speech (Safari Mac fixes included). */
export function speakText(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.02;
    utterance.volume = 1;

    const profile = getBrowserProfile();

    const pickVoice = () => {
      const voices = synth.getVoices();
      return (
        voices.find((v) => v.name === "Samantha") ||
        voices.find((v) => v.name.includes("Samantha")) ||
        voices.find((v) => v.name.includes("Karen")) ||
        voices.find((v) => v.name.includes("Daniel")) ||
        voices.find((v) => v.name.includes("Google US English")) ||
        voices.find((v) => v.lang.startsWith("en") && v.localService) ||
        voices.find((v) => v.lang.startsWith("en"))
      );
    };

    const doSpeak = () => {
      const voice = pickVoice();
      if (voice) utterance.voice = voice;

      let resumeTimer: ReturnType<typeof setInterval> | null = null;

      utterance.onend = () => {
        if (resumeTimer) clearInterval(resumeTimer);
        resolve();
      };
      utterance.onerror = () => {
        if (resumeTimer) clearInterval(resumeTimer);
        resolve();
      };

      synth.speak(utterance);

      if (profile.isSafari || profile.isMac) {
        resumeTimer = setInterval(() => {
          if (synth.speaking && synth.paused) synth.resume();
        }, 120);
        setTimeout(() => {
          if (resumeTimer) clearInterval(resumeTimer);
        }, 30000);
      }
    };

    if (synth.getVoices().length === 0) {
      synth.onvoiceschanged = () => {
        synth.onvoiceschanged = null;
        doSpeak();
      };
      synth.getVoices();
      setTimeout(doSpeak, 250);
    } else {
      doSpeak();
    }
  });
}
