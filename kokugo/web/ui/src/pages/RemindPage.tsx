import { useEffect, useState } from "react";
import { monthlyReminders, reviewVocabCard } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import { rubyFromWordReading } from "../lib/ruby";
import * as L from "../lib/uiLabelsRuby";
import type { VocabCard } from "../types";

export default function RemindPage() {
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    monthlyReminders()
      .then((d) => {
        setCards(d.cards || []);
        setIdx(0);
        setShowBack(false);
      })
      .catch(() => setCards([]));
  }, []);

  const c = cards[idx];

  const next = () => {
    setShowBack(false);
    setIdx((i) => (i + 1) % Math.max(cards.length, 1));
  };

  const markReviewed = async () => {
    if (!c) return;
    try {
      await reviewVocabCard(c.id);
      next();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラー");
    }
  };

  if (!cards.length) {
    return (
      <section className="view">
        <div className="card">
          <p className="muted">
            <RubyHtml html={L.remindEmpty} />
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="view">
      <div className="card flashcard">
        {err && <p className="status">{err}</p>}
        <div className="fc-main">
          {!showBack ? (
            <>
              <p className="fc-word">
                <RubyHtml
                  html={c.word.toLowerCase().includes("<ruby") ? c.word : rubyFromWordReading(c.word, c.reading)}
                />
              </p>
              <button type="button" className="btn btn-primary btn-xl" onClick={() => setShowBack(true)}>
                <RubyHtml html={L.remindFlip} />
              </button>
            </>
          ) : (
            <>
              <div className="fc-back">
                <p className="fc-meaning">
                  <RubyHtml html={c.meaning} />
                </p>
                <div className="fc-examples">
                  {(c.examples || []).map((ex, i) => (
                    <p key={i}>
                      <RubyHtml html={ex} />
                    </p>
                  ))}
                </div>
              </div>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => void markReviewed()}>
                <RubyHtml html={L.remindGotIt} />
              </button>
            </>
          )}
        </div>
        <p className="muted" style={{ textAlign: "center" }}>
          {idx + 1} / {cards.length}
        </p>
      </div>
    </section>
  );
}
