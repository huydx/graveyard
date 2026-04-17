import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { monthlyReminders, reviewVocabCard } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import { rubyFromWordReading } from "../lib/ruby";
import { paths } from "../lib/paths";
import * as L from "../lib/uiLabelsRuby";
import type { VocabCard } from "../types";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function RemindPage() {
  const [rawCards, setRawCards] = useState<VocabCard[]>([]);
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    monthlyReminders()
      .then((d) => {
        const c = d.cards || [];
        setRawCards(c);
        setCards(shuffle(c));
        setIdx(0);
        setShowBack(false);
      })
      .catch(() => {
        setRawCards([]);
        setCards([]);
      });
  }, []);

  const c = cards[idx];
  const n = cards.length;
  const progressPct = n > 0 ? ((idx + 1) / n) * 100 : 0;

  const goNext = () => {
    setShowBack(false);
    setIdx((i) => (i + 1) % Math.max(n, 1));
  };

  const markReviewed = async () => {
    if (!c) return;
    try {
      await reviewVocabCard(c.id);
      goNext();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラー");
    }
  };

  const reshuffle = () => {
    setCards(shuffle([...rawCards]));
    setIdx(0);
    setShowBack(false);
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
        <div className="remind-progress-wrap" aria-hidden>
          <div className="progress fake-progress remind-progress">
            <span style={{ width: `${progressPct}%` }} />
          </div>
          <p className="muted remind-progress-label">
            {idx + 1} / {n}
          </p>
        </div>
        <p className="muted remind-hint-top">
          <RubyHtml html={L.remindProgressHint(Math.max(0, n - idx - 1))} />
        </p>
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
              <div className="fc-back-actions">
                <button type="button" className="btn btn-primary btn-lg" onClick={() => void markReviewed()}>
                  <RubyHtml html={L.remindGotIt} />
                </button>
                <button type="button" className="btn btn-secondary btn-lg" onClick={goNext}>
                  <RubyHtml html={L.remindNotYet} />
                </button>
                <button type="button" className="btn btn-secondary btn-lg" onClick={goNext}>
                  <RubyHtml html={L.remindDontKnow} />
                </button>
                <button type="button" className="btn btn-ghost btn-lg" onClick={goNext}>
                  <RubyHtml html={L.remindNext} />
                </button>
              </div>
            </>
          )}
        </div>
        <div className="remind-footer-actions">
          <button type="button" className="btn btn-ghost" onClick={reshuffle}>
            <RubyHtml html={L.remindShuffle} />
          </button>
          <Link to={paths.home} className="btn btn-ghost">
            <RubyHtml html={L.remindDoneToday} />
          </Link>
        </div>
      </div>
    </section>
  );
}
