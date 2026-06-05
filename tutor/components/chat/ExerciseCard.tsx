"use client";

interface ExerciseCardProps {
  html?: string;
  problem: string;
}

export default function ExerciseCard({ html, problem }: ExerciseCardProps) {
  if (html) {
    return (
      <div className="self-stretch mx-0 my-1">
        <div className="bg-dark-card border border-white/10 rounded-2xl p-6 shadow-card">
          {/* Sandboxed iframe for v1 display-only exercises */}
          <iframe
            srcDoc={html}
            className="w-full min-h-[200px] rounded-xl border-0"
            sandbox="allow-scripts"
            title="Exercise"
          />
          <p className="text-center text-sm text-accent-purple mt-3 font-semibold">
            こたえを はなしてね ✨
          </p>
        </div>
      </div>
    );
  }

  // Fallback: plain text problem
  return (
    <div className="self-stretch mx-0 my-1">
      <div className="bg-dark-card border border-white/10 rounded-2xl p-6 shadow-card">
        <p className="text-xs text-accent-purple font-semibold mb-1">
          ✦ もんだい ✦
        </p>
        <p className="text-3xl font-bold text-center my-3 text-accent-gold tracking-wider text-glow">
          {problem}
        </p>
        <p className="text-center text-sm text-accent-purple mt-3 font-semibold">
          こたえを はなしてね ✨
        </p>
      </div>
    </div>
  );
}
