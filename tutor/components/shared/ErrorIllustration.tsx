"use client";

interface ErrorIllustrationProps {
  onRetry?: () => void;
}

export default function ErrorIllustration({ onRetry }: ErrorIllustrationProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center px-8">
        <span className="text-6xl block mb-6">🐻‍❄️</span>
        <h2 className="text-xl font-bold text-text-primary mb-2">
          あれ？つながらないよ
        </h2>
        <p className="text-text-muted text-lg">
          ちょっと まってね。くま先生が なおしてる！
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-6 px-6 py-3 rounded-2xl bg-accent-purple text-white font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            もういちど やってみる ✨
          </button>
        )}
        <p className="text-text-muted text-sm mt-4">
          マイクのボタンで もういちど はなしかけてね
        </p>
      </div>
    </div>
  );
}
