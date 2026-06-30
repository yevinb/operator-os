"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { VoiceHook, VoiceState } from "@/lib/voice";

type SpeechEndHandler = (text: string) => void;

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useVoice(onSpeechEnd?: SpeechEndHandler): VoiceHook {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusHint, setStatusHint] = useState("");

  const recognitionRef = useRef<InstanceType<NonNullable<ReturnType<typeof getSpeechRecognition>>> | null>(null);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const onSpeechEndRef = useRef(onSpeechEnd);
  const listeningRef = useRef(false);

  onSpeechEndRef.current = onSpeechEnd;

  useEffect(() => {
    const SR = getSpeechRecognition();
    const hasSynth = typeof window !== "undefined" && "speechSynthesis" in window;
    setIsSupported(!!SR && hasSynth);
  }, []);

  const processHeardText = useCallback(() => {
    const heard = `${finalRef.current} ${interimRef.current}`.trim();
    interimRef.current = "";
    setInterimTranscript("");
    listeningRef.current = false;
    setState("idle");

    if (heard) {
      finalRef.current = heard;
      setTranscript(heard);
      setError(null);
      setStatusHint(`Heard: "${heard}"`);
      onSpeechEndRef.current?.(heard);
    } else {
      setError("Didn't catch that — try again or type below.");
      setStatusHint("");
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      /* ignore */
    }
    // Fallback if onend doesn't fire
    setTimeout(() => {
      if (listeningRef.current) processHeardText();
    }, 400);
  }, [processHeardText]);

  const startListening = useCallback(async () => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setError("Voice not supported. Use Chrome or Safari.");
      return;
    }

    window.speechSynthesis?.cancel();
    setError(null);
    setStatusHint("Requesting microphone…");
    finalRef.current = "";
    interimRef.current = "";
    setTranscript("");
    setInterimTranscript("");

    // Explicit mic permission — required on Safari & mobile
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setState("error");
      setError("Microphone blocked. Allow mic access in browser settings, then refresh.");
      setStatusHint("");
      return;
    }

    // Fresh recognition instance each time (Chrome fix)
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      listeningRef.current = true;
      setState("listening");
      setStatusHint("Listening… speak your command");
    };

    recognition.onresult = (event) => {
      let newFinal = "";
      let interim = "";

      for (let i = 0; i < event.results.length; i++) {
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
      if (listeningRef.current) {
        // Delay for last onresult
        setTimeout(processHeardText, 150);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") return;

      const heard = `${finalRef.current} ${interimRef.current}`.trim();
      if (heard) {
        setTimeout(processHeardText, 100);
        return;
      }

      listeningRef.current = false;
      setState("idle");

      if (event.error === "not-allowed") {
        setError("Microphone blocked. Allow access and refresh.");
      } else if (event.error === "no-speech") {
        setError("No speech heard. Tap orb and speak louder.");
      } else {
        setError(`Voice error (${event.error}). Try again or type below.`);
      }
      setStatusHint("");
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setError("Could not start mic. Wait a second and tap again.");
      setState("idle");
      setStatusHint("");
    }
  }, [processHeardText]);

  const speak = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      if (!window.speechSynthesis) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      setState("speaking");
      setStatusHint("Speaking response…");

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => v.name.includes("Samantha")) ||
        voices.find((v) => v.name.includes("Google US English")) ||
        voices.find((v) => v.lang.startsWith("en"));
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => {
        setState("idle");
        setStatusHint("Done. Tap orb for another command.");
        resolve();
      };
      utterance.onerror = () => {
        setState("idle");
        setStatusHint("");
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
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
    state,
    transcript,
    interimTranscript,
    isSupported,
    error,
    statusHint,
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
