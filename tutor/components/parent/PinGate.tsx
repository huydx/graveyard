"use client";

import { useState } from "react";

interface PinGateProps {
  onUnlock: () => void;
}

const CORRECT_PIN = process.env.NEXT_PUBLIC_PARENT_PIN ?? "0000";

export default function PinGate({ onUnlock }: PinGateProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const handleDigit = (digit: string) => {
    const newPin = pin + digit;
    setPin(newPin);
    setError(false);

    if (newPin.length === 4) {
      if (newPin === CORRECT_PIN) {
        onUnlock();
      } else {
        setError(true);
        setTimeout(() => setPin(""), 600);
      }
    }
  };

  const handleClear = () => {
    setPin("");
    setError(false);
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center">
      <div className="text-center">
        <span className="text-4xl block mb-6">🔒</span>
        <h2 className="text-xl font-bold text-text-primary mb-8">
          おとなの せってい
        </h2>

        {/* PIN dots */}
        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`
                w-5 h-5 rounded-full border-2 transition-all
                ${
                  pin.length > i
                    ? error
                      ? "border-red-400 bg-red-400 animate-shake"
                      : "border-accent-purple bg-accent-purple"
                    : "border-white/20"
                }
              `}
            />
          ))}
        </div>

        {error && (
          <p className="text-red-400 text-sm mb-4 animate-fade-in">
            あんごうが ちがうよ
          </p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "⌫"].map((key) => (
            <button
              key={key}
              onClick={() => {
                if (key === "C") handleClear();
                else if (key === "⌫") setPin(pin.slice(0, -1));
                else handleDigit(String(key));
              }}
              disabled={pin.length >= 4 && key !== "C"}
              className="w-16 h-16 rounded-2xl bg-dark-card border border-white/10 text-text-primary text-xl font-semibold hover:border-white/30 hover:bg-dark-card/80 transition-all disabled:opacity-30"
            >
              {key}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
