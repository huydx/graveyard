"use client";

import { Message } from "@/types";
import { speak, stopSpeaking, isSpeaking } from "@/lib/tts";
import { useState } from "react";

interface ChatBubbleProps {
  message: Message;
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const [playing, setPlaying] = useState(false);
  const isAI = message.role === "assistant";
  const isVoice = message.inputMode === "voice";

  const handleReplay = () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }

    setPlaying(true);
    speak(message.content, {
      rate: 0.85,
      pitch: 1.1,
    });

    // Check when speech ends
    const checkEnd = setInterval(() => {
      if (!isSpeaking()) {
        setPlaying(false);
        clearInterval(checkEnd);
      }
    }, 200);
  };

  return (
    <div
      className={`flex ${isAI ? "justify-start" : "justify-end"} animate-fade-in`}
    >
      <div
        className={`
          max-w-[76%] px-4 py-3 rounded-2xl text-lg leading-relaxed
          ${
            isAI
              ? "bg-dark-card border border-white/10 text-text-primary rounded-bl-md"
              : isVoice
                ? "bg-blue-card border border-blue/20 text-blue-light rounded-br-md"
                : "bg-purple-card border border-purple/20 text-purple-light rounded-br-md"
          }
        `}
      >
        {/* Image attachment */}
        {message.imageUrl && (
          <img
            src={message.imageUrl}
            alt="Captured worksheet"
            className="w-full max-w-[240px] rounded-xl mb-2"
          />
        )}

        {/* Text content */}
        <p className="whitespace-pre-wrap">{message.content}</p>

        {/* Voice replay button (AI messages only) */}
        {isAI && (
          <button
            onClick={handleReplay}
            className="mt-2 text-xs text-text-muted hover:text-accent-purple transition-colors flex items-center gap-1"
            aria-label={playing ? "Stop speaking" : "Replay voice"}
          >
            {playing ? "⏹ とめる" : "🔊 もういちど"}
          </button>
        )}

        {/* Input mode indicator */}
        {!isAI && message.inputMode && (
          <span className="block mt-1 text-xs text-text-muted">
            {message.inputMode === "voice" ? "🎤" : message.inputMode === "camera" ? "📷" : "⌨"}
          </span>
        )}
      </div>
    </div>
  );
}
