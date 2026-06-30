"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { VoiceHook } from "@/lib/voice";
import {
  getSpeechRecognitionCtor,
  isVoiceInputAvailable,
} from "@/lib/voice";

type SpeechEndHandler = (text: string) => void;

export function useVoice(onSpeechEnd?: SpeechEndHandler): VoiceHook {
  const [state, setState] = useState<VoiceHook["state"]>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusHint, setStatusHint] = useState("");

  const recognitionRef = useRef<InstanceType<NonNullable<ReturnType<typeof getSpeechRecognitionCtor>>> | null>(null);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const onSpeechEndRef = useRef(onSpeechEnd);
  const listeningRef = useRef(false);
  const processedRef = useRef(false);

  onSpeechEndRef.current = onSpeechEnd;

  useEffect(() => {
    setIsSupported(isVoiceInputAvailable());
  }, []);

  const getHeard = () => `${finalRef.current} ${interimRef.current}`.trim();

  const processHeardText = useCallback(() => {
    if (processedRef.current) return;
    processedRef.current = true;
    listeningRef.current = false;

    const heard = getHeard();
    interimRef.current = "";
    setInterimTranscript("");

    if (heard) {
      finalRef.current = heard;
      setTranscript(heard);
      setError(null);
      setState("idle");
      setStatusHint(`Heard: "${heard}" — running now…`);
      onSpeechEndRef.current?.(heard);
    } else {
      setState("idle");
      setError("Didn't catch that. Tap orb, speak, then tap DONE.");
      setStatusHint("");
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!listeningRef.current) return;
    setStatusHint("Processing what you said…");
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      if (!processedRef.current) processHeardText();
    }, 300);
  }, [processHeardText]);

  /** MUST stay synchronous — called directly from click/tap handler. */
  const startListening = useCallback(() => {
    const SR = getSpeechRecognitionCtor();
    if (!SR) {
      setError("Voice not available on this device. Use the text box.");
      return;
    }

    window.speechSynthesis?.cancel();
    processedRef.current = false;
    listeningRef.current = false;
    finalRef.current = "";
    interimRef.current = "";
    setTranscript("");
    setInterimTranscript("");
    setError(null);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      listeningRef.current = true;
      processedRef.current = false;
      setState("listening");
      setStatusHint("Listening… say your command, then tap DONE");
    };

    recognition.onresult = (event) => {
      let allFinal = "";
      let interim = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          allFinal += text;
        } else {
          interim += text;
        }
      }

      // Rebuild full final from all final segments
      if (allFinal || event.results.length > 0) {
        let complete = "";
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            complete += event.results[i][0].transcript;
          }
        }
        if (complete) {
          finalRef.current = complete.trim();
          setTranscript(finalRef.current);
        }
      }

      interimRef.current = interim;
      setInterimTranscript(interim);
    };

    recognition.onend = () => {
      if (listeningRef.current && !processedRef.current) {
        setTimeout(processHeardText, 200);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") return;

      const heard = getHeard();
      if (heard) {
        setTimeout(processHeardText, 100);
        return;
      }

      listeningRef.current = false;
      processedRef.current = true;
      setState("idle");

      if (event.error === "not-allowed") {
        setError("Mic blocked. Click the lock icon in the address bar → Allow microphone.");
      } else if (event.error === "no-speech") {
        setError("No speech detected. Tap orb and speak clearly.");
      } else {
        setError(`Voice error. Type your command below instead.`);
      }
      setStatusHint("");
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setError("Mic busy. Wait 1 second and tap again.");
      setState("idle");
      setStatusHint("");
    }
  }, [processHeardText]);

  const speak = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      if (!window.speechSynthesis) {
        setState("idle");
        setStatusHint("Done.");
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      setState("speaking");
      setStatusHint("Speaking…");

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.volume = 1;

      const loadAndSpeak = () => {
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
          setStatusHint("Done.");
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      };

      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = loadAndSpeak;
      } else {
        loadAndSpeak();
      }
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
}
