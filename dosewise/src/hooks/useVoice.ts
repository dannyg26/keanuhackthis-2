import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal SpeechRecognition types — lib.dom does not ship these everywhere. */

interface MinimalSRResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface MinimalSREvent {
  resultIndex: number;
  results: { length: number; [i: number]: MinimalSRResult };
}
interface MinimalSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: MinimalSREvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => MinimalSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

interface VoiceState {
  listening: boolean;
  speaking: boolean;
  transcript: string;
  finalTranscript: string;
  supported: { recognition: boolean; synthesis: boolean };
}

interface UseVoiceOptions {
  onFinalTranscript?: (text: string) => void;
  /** Mutable amplitude ref a 3D component can read each frame for lip-sync (0..1). */
  mouthAmpRef?: React.RefObject<number>;
}

export function useVoice(opts: UseVoiceOptions = {}) {
  const { onFinalTranscript, mouthAmpRef } = opts;

  const [state, setState] = useState<VoiceState>({
    listening: false,
    speaking: false,
    transcript: "",
    finalTranscript: "",
    supported: { recognition: false, synthesis: false },
  });

  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setState(s => ({
      ...s,
      supported: {
        recognition: !!SR,
        synthesis: typeof window !== "undefined" && "speechSynthesis" in window,
      },
    }));
  }, []);

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    try { recognitionRef.current?.stop(); } catch { /* ignore */ }

    const r = new SR();
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;

    let finalText = "";
    r.onresult = (e: MinimalSREvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      setState(s => ({ ...s, transcript: (finalText + interim).trim() }));
    };
    r.onend = () => {
      setState(s => ({ ...s, listening: false, finalTranscript: finalText.trim() }));
      if (finalText.trim() && onFinalTranscript) onFinalTranscript(finalText.trim());
    };
    r.onerror = () => setState(s => ({ ...s, listening: false }));

    r.start();
    recognitionRef.current = r;
    setState(s => ({ ...s, listening: true, transcript: "", finalTranscript: "" }));
  }, [onFinalTranscript]);

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    setState(s => ({ ...s, listening: false }));
  }, []);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);

    // Pick a friendlier voice if one is available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      /samantha|google us english|jenny|aria|female/i.test(v.name)
    );
    if (preferred) u.voice = preferred;
    u.rate = 1.02;
    u.pitch = 1.05;
    u.volume = 1;

    u.onstart = () => setState(s => ({ ...s, speaking: true }));
    u.onend = () => {
      setState(s => ({ ...s, speaking: false }));
      if (mouthAmpRef) (mouthAmpRef as { current: number }).current = 0;
    };
    u.onerror = () => {
      setState(s => ({ ...s, speaking: false }));
      if (mouthAmpRef) (mouthAmpRef as { current: number }).current = 0;
    };
    // Word-boundary impulse for lip sync
    u.onboundary = () => {
      if (mouthAmpRef) (mouthAmpRef as { current: number }).current = 1;
    };

    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
  }, [mouthAmpRef]);

  const cancel = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setState(s => ({ ...s, speaking: false }));
    if (mouthAmpRef) (mouthAmpRef as { current: number }).current = 0;
  }, [mouthAmpRef]);

  // Make sure voices are loaded (Safari quirk)
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const handler = () => { /* triggers re-evaluation when voices load */ };
    window.speechSynthesis.onvoiceschanged = handler;
    window.speechSynthesis.getVoices();
  }, []);

  return { ...state, start, stop, speak, cancel };
}
