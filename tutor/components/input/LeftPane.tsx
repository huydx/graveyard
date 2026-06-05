"use client";

import { InputMode } from "@/types";

interface LeftPaneProps {
  activeMode: InputMode;
  onModeChange: (mode: InputMode) => void;
  isRecording: boolean;
  onVoiceToggle: () => void;
}

export default function LeftPane({
  activeMode,
  onModeChange,
  isRecording,
  onVoiceToggle,
}: LeftPaneProps) {
  return (
    <div className="w-[82px] min-w-[82px] bg-sidebar border-r border-white/10 flex flex-col items-center py-5 gap-5">
      {/* Voice — tap to start/stop */}
      <button
        onClick={() => {
          if (activeMode === "voice") {
            onVoiceToggle();
          } else {
            onModeChange("voice");
          }
        }}
        className={`
          w-[54px] h-[54px] rounded-2xl border flex items-center justify-center
          text-2xl transition-all duration-200
          ${
            activeMode === "voice"
              ? isRecording
                ? "bg-recording border-red-400 text-red-300 shadow-glow-red scale-110"
                : "bg-purple-card border-purple text-purple-light shadow-glow-purple"
              : "bg-dark-card border-white/10 text-text-muted hover:border-white/30 hover:text-text-secondary"
          }
        `}
        aria-label={isRecording ? "Stop recording" : "Voice input"}
      >
        🎤
      </button>

      {/* Camera */}
      <button
        onClick={() => onModeChange("camera")}
        className={`
          w-[54px] h-[54px] rounded-2xl border flex items-center justify-center
          text-2xl transition-all duration-200
          ${
            activeMode === "camera"
              ? "bg-purple-card border-purple text-purple-light shadow-glow-purple"
              : "bg-dark-card border-white/10 text-text-muted hover:border-white/30 hover:text-text-secondary"
          }
        `}
        aria-label="Camera input"
      >
        📷
      </button>

      {/* Keyboard */}
      <button
        onClick={() => onModeChange("keyboard")}
        className={`
          w-[54px] h-[54px] rounded-2xl border flex items-center justify-center
          text-2xl transition-all duration-200
          ${
            activeMode === "keyboard"
              ? "bg-purple-card border-purple text-purple-light shadow-glow-purple"
              : "bg-dark-card border-white/10 text-text-muted hover:border-white/30 hover:text-text-secondary"
          }
        `}
        aria-label="Keyboard input"
      >
        ⌨
      </button>

      {/* Spacer pushes everything up */}
      <div className="flex-1" />
    </div>
  );
}
