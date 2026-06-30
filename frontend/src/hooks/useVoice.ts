"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { VoiceHook } from "@/lib/voice";
import { getBrowserProfile, isVoiceInputAvailable } from "@/lib/voice";
import { SpeechEngine, speakText } from "@/lib/speechEngine";

type SpeechEndHandler = (text: string) => void;

export function useVoice(onSpeechEnd?: SpeechEndHandler): VoiceHook {
  const [state, setState] = useState<VoiceHook["state"]>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const [browserLabel, setBrowserLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [statusHint, setStatusHint] = useState("");
  const [ready, setReady] = useState(false);

  const engineRef = useRef<SpeechEngine | null>(null);
  const onSpeechEndRef = useRef(onSpeechEnd);

  onSpeechEndRef.current = onSpeechEnd;

  useEffect(() => {
    const profile = getBrowserProfile();
    setIsSupported(isVoiceInputAvailable());
    setBrowserLabel(profile.label);
    setReady(true);

    // Pre-load voices for Mac Safari TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new SpeechEngine({
        onStateChange: (s) => {
          if (s === "listening") setState("listening");
        },
        onTranscript: (final, interim) => {
          setTranscript(final);
          setInterimTranscript(interim);
          setError(null);
        },
        onStatus: (hint) => setStatusHint(hint),
        onError: (msg) => {
          setError(msg);
          setState("error");
        },
        onComplete: (heard) => {
          setState("idle");
          onSpeechEndRef.current?.(heard);
        },
      });
    }
    return engineRef.current;
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript("");
    setInterimTranscript("");
    getEngine().start();
  }, [getEngine]);

  const stopListening = useCallback(() => {
    getEngine().stop();
  }, [getEngine]);

  const speak = useCallback(async (text: string) => {
    setState("speaking");
    setStatusHint("Speaking…");
    await speakText(text);
    setState("idle");
    setStatusHint("Done. Tap orb for another command.");
  }, []);

  const cancelSpeech = useCallback(() => {
    window.speechSynthesis?.cancel();
    setState("idle");
    setStatusHint("");
  }, []);

  const setProcessing = useCallback(() => {
    setState("processing");
    setStatusHint("Running your command…");
  }, []);

  return {
    state: ready ? state : "idle",
    transcript,
    interimTranscript,
    isSupported: ready ? isSupported : false,
    browserLabel,
    error,
    statusHint,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
    setProcessing,
  };
}
