"use client";

import { useState } from "react";

export default function Dashboard() {
  const [tab, setTab] = useState<"history" | "observations">("history");

  return (
    <div className="min-h-screen bg-dark-bg p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-text-primary mb-6">
          🐻 おとなの せってい
        </h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("history")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === "history"
                ? "bg-accent-purple text-white"
                : "bg-dark-card border border-white/10 text-text-muted hover:text-text-secondary"
            }`}
          >
            セッションの きろく
          </button>
          <button
            onClick={() => setTab("observations")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === "observations"
                ? "bg-accent-purple text-white"
                : "bg-dark-card border border-white/10 text-text-muted hover:text-text-secondary"
            }`}
          >
            くま先生の きづき
          </button>
        </div>

        {/* Content */}
        <div className="bg-dark-card border border-white/10 rounded-2xl p-6">
          {tab === "history" ? (
            <div>
              <h3 className="text-lg font-bold text-text-primary mb-4">
                さいきんの セッション
              </h3>
              <p className="text-text-muted text-sm">
                セッションの きろくが ここに ひょうじされます。
                <br />
                くわしくは ~/.tutor/kids/default/sessions/ を みてね。
              </p>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-bold text-text-primary mb-4">
                くま先生の きづき
              </h3>
              <p className="text-text-muted text-sm">
                そうすけの がくしゅうの ようすが ここに ひょうじされます。
                <br />
                くわしくは ~/.tutor/kids/default/MEMORY.md を みてね。
              </p>
            </div>
          )}
        </div>

        {/* Back link */}
        <a
          href="/"
          className="inline-block mt-6 text-text-muted text-sm hover:text-text-secondary transition-colors"
        >
          ← チャットに もどる
        </a>
      </div>
    </div>
  );
}
