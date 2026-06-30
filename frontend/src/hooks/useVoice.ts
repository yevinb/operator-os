"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { VoiceHook, VoiceState } from "@/lib/voice";

type SpeechEndHandler = (text: string) => void;

export function useVoice(onSpeechEnd?: SpeechEndHandler): VoiceHook {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<InstanceType<NonNullable<typeof window.SpeechRecognition>> | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const onSpeechEndRef = useRef(onSpeechEnd);
  const stateRef = useRef<VoiceState>("idle");
  const handledEndRef = useRef(false);

  onSpeechEndRef.current = onSpeechEnd;

  const getHeardText = useCallback(() => {
    const combined = `${finalRef.current} ${interimRef.current}`.trim();
    return combined;
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const hasSynth = "speechSynthesis" in window;
    setIsSupported(!!SR && hasSynth);

    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    const finishListening = () => {
      if (handledEndRef.current) return;
      handledEndRef.current = true;

      // Small delay — browsers often fire onend before the last onresult
      setTimeout(() => {
        const heard = getHeardText();
        const wasListening = stateRef.current === "listening";
        interimRef.current = "";
        setInterimTranscript("");

        if (wasListening) {
          setState("idle");
        }

        if (heard) {
          finalRef.current = heard;
          setTranscript(heard);
          setError(null);
          onSpeechEndRef.current?.(heard);
        } else if (wasListening) {
          setError("Didn't catch that. Tap the orb and speak clearly.");
        }
      }, 250);
    };

    recognition.onstart = () => {
      handledEndRef.current = false;
      finalRef.current = "";
      interimRef.current = "";
      setTranscript("");
      setInterimTranscript("");
      setError(null);
      setState("listening");
    };

    recognition.onresult = (event) => {
      let newFinal = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          newFinal += text;
        } else {
          interim += text;
        }
      }

      if (newFinal) {
        finalRef.current = `${finalRef.current} ${newFinal}`.trim();
        setTranscript(finalRef.current);
      }

      interimRef.current = interim;
      setInterimTranscript(interim);
    };

    recognition.onend = () => {
      finishListening();
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") return;

      if (event.error === "not-allowed") {
        setState("error");
        setError("Microphone blocked. Click the lock icon in your browser and allow mic access.");
        return;
      }

      // If we already captured words, still process them
      const heard = getHeardText();
      if (heard) {
        finishListening();
        return;
      }

      if (event.error === "no-speech") {
        setState("idle");
        setError("No speech detected. Tap the orb and try again.");
      } else {
        setState("idle");
        setError("Voice error. Tap the orb and try again.");
      }
    };

    recognitionRef.current = recognition;
  }, [getHeardText]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    window.speechSynthesis?.cancel();
    setError(null);
    finalRef.current = "";
    interimRef.current = "";
    setTranscript("");
    setInterimTranscript("");

    try {
      recognitionRef.current.start();
    } catch {
      try {
        recognitionRef.current.stop();
      } catch {
        /* already stopped */
      }
      setTimeout(() => {
        try {
          recognitionRef.current?.start();
        } catch {
          setError("Could not start microphone. Refresh and try again.");
        }
      }, 200);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      /* ignore */
    }
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

      const pickVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        return (
          voices.find((v) => v.name.includes("Samantha")) ||
          voices.find((v) => v.name.includes("Google US English")) ||
          voices.find((v) => v.lang.startsWith("en") && v.localService) ||
          voices.find((v) => v.lang.startsWith("en"))
        );
      };

      const preferred = pickVoice();
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

if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}
