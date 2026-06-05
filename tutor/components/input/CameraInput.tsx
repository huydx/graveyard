"use client";

import { useRef, useState } from "react";

interface CameraInputProps {
  onCapture: (imageUrl: string) => void;
  disabled?: boolean;
}

export default function CameraInput({ onCapture, disabled }: CameraInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = () => {
    if (preview) {
      onCapture(preview);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRetake = () => {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.click();
  };

  return (
    <div className="px-4 py-3 border-t border-white/10 bg-dark-bg">
      {preview ? (
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <img
            src={preview}
            alt="Preview"
            className="w-full max-w-[280px] rounded-xl border border-white/10"
          />
          <div className="flex gap-3">
            <button
              onClick={handleRetake}
              className="px-4 py-2 rounded-xl border border-white/10 text-text-secondary hover:bg-dark-card transition-colors"
            >
              とりなおす 📷
            </button>
            <button
              onClick={handleSend}
              className="px-6 py-2 rounded-xl bg-accent-purple text-white font-semibold hover:bg-purple/80 transition-colors"
            >
              そうしん ✨
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-center">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="w-20 h-20 rounded-full bg-purple-card border-2 border-purple/40 text-purple-light text-3xl flex items-center justify-center hover:border-purple hover:shadow-glow-purple transition-all disabled:opacity-50"
            aria-label="Open camera"
          >
            📷
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}
