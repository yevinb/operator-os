"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { VoiceHook, VoiceState } from "@/lib/voice";

export function useVoice(): VoiceHook {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<InstanceType<NonNullable<typeof window.SpeechRecognition>> | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const hasSynth = "speechSynthesis" in window;
    setIsSupported(!!SR && hasSynth);

    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState("listening");
      setError(null);
      setTranscript("");
      setInterimTranscript("");
    };

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) setTranscript((prev) => (prev + final).trim());
      setInterimTranscript(interim);
    };

    recognition.onend = () => {
      setInterimTranscript("");
      setState((prev) => {
        if (prev === "listening") return "idle";
        return prev;
      });
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      setState("error");
      if (event.error === "not-allowed") {
        setError("Microphone access denied. Allow mic in browser settings.");
      } else if (event.error === "no-speech") {
        setError("Didn't catch that. Tap the orb and try again.");
        setState("idle");
      } else {
        setError("Voice error. Try again.");
        setState("idle");
      }
    };

    recognitionRef.current = recognition;
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    window.speechSynthesis?.cancel();
    setError(null);
    setTranscript("");
    setInterimTranscript("");

    try {
      recognitionRef.current.start();
    } catch {
      recognitionRef.current.stop();
      setTimeout(() => recognitionRef.current?.start(), 100);
    }
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const speak = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      if (!window.speechSynthesis) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      setState("speaking");

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => v.name.includes("Samantha")) ||
        voices.find((v) => v.name.includes("Google US English")) ||
        voices.find((v) => v.lang.startsWith("en") && v.localService) ||
        voices.find((v) => v.lang.startsWith("en"));
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => {
        setState("idle");
        resolve();
      };
      utterance.onerror = () => {
        setState("idle");
        resolve();
      };

      synthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const cancelSpeech = useCallback(() => {
    window.speechSynthesis?.cancel();
    setState("idle");
  }, []);

  const setProcessing = useCallback(() => setState("processing"), []);

  return {
    state,
    transcript,
    interimTranscript,
    isSupported,
    error,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
    setProcessing,
  };
}

// Load voices on mount (Chrome needs this)
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
