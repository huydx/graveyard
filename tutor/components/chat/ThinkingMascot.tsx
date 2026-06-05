"use client";

export default function ThinkingMascot() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-3 px-4 py-3 bg-dark-card border border-white/10 rounded-2xl rounded-bl-md">
        {/* Bear mascot */}
        <span className="text-3xl animate-float select-none">🐻</span>

        {/* Animated dots */}
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-dot-pink animate-glow [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-dot-warm animate-glow [animation-delay:200ms]" />
          <span className="w-2 h-2 rounded-full bg-dot-purple animate-glow [animation-delay:400ms]" />
        </div>
      </div>
    </div>
  );
}
