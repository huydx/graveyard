"use client";

import { useState, useRef, useCallback } from "react";
import { createBrowserSTT } from "@/lib/stt";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export default function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const handleToggle = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = createBrowserSTT();
    if (!recognition) {
      alert("おとの にゅうりょくが できません。キーボードを つかってね。");
      return;
    }

    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      if (transcript.trim()) {
        onTranscript(transcript.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("STT error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    setIsRecording(true);
  }, [isRecording, onTranscript]);

  return (
    <div className="px-4 py-3 border-t border-white/10 bg-dark-bg flex justify-center">
      <button
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-20 h-20 rounded-full flex items-center justify-center text-3xl
          transition-all duration-300
          ${
            isRecording
              ? "bg-red-500/20 border-2 border-red-400 shadow-glow-red animate-pulse"
              : "bg-purple-card border-2 border-purple/40 text-purple-light hover:border-purple hover:shadow-glow-purple"
          }
          disabled:opacity-50
        `}
        aria-label={isRecording ? "Tap to stop recording" : "Tap to start recording"}
      >
        🎤
      </button>

      {isRecording && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-dark-card border border-white/10 rounded-xl px-4 py-2 text-text-secondary text-sm animate-fade-in">
          きいているよ...
        </div>
      )}
    </div>
  );
}
