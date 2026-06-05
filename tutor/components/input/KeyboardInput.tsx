"use client";

import { useState, useRef } from "react";

interface KeyboardInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function KeyboardInput({ onSend, disabled }: KeyboardInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    inputRef.current?.focus();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="px-4 py-3 border-t border-white/10 bg-dark-bg"
    >
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ここに かいてね..."
          disabled={disabled}
          className="flex-1 bg-dark-card border border-white/10 rounded-xl px-4 py-3 text-text-primary text-lg placeholder:text-text-muted focus:outline-none focus:border-accent-purple focus:shadow-glow-purple transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="bg-accent-purple text-white px-4 py-3 rounded-xl font-semibold disabled:opacity-30 transition-opacity hover:bg-purple/80"
        >
          そうしん
        </button>
      </div>
    </form>
  );
}
