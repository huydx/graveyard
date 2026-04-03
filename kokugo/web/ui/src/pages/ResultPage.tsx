import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { generateSummary, getSummary } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import { rubyFromWordReading } from "../lib/ruby";
import type { LearningSummary, SubmitResult } from "../types";

export default function ResultPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const id = rawId ? decodeURIComponent(rawId) : "";
  const location = useLocation();
  const state = location.state as { result?: SubmitResult } | undefined;

  const [summary, setSummary] = useState<LearningSummary | null>(null);
  const [summaryErr, setSummaryErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSummary(id)
      .then((s) => setSummary(s))
      .catch(() => {
        /* none yet */
      });
  }, [id]);

  const onGenSummary = async () => {
    if (!id) return;
    setLoading(true);
    setSummaryErr("");
    try {
      const { summary: s } = await generateSummary(id);
      setSummary(s);
    } catch (e) {
      setSummaryErr(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  };

  const r = state?.result;

  return (
    <section className="view">
      <div className="card">
        <h2>けっか</h2>
        {r ? (
          <>
            <p className="score-big">
              {r.scorePercent}%（{r.correct}/{r.total} せいかい）
            </p>
            {r.questionResults && r.questionResults.length > 0 && (
              <div className="result-by-question">
                <h3 className="result-by-q-head">もんばんごとのコメント</h3>
                <ol className="result-q-list">
                  {r.questionResults.map((row) => (
                    <li key={row.questionId} className="result-q-item">
                      <p className="result-q-prompt">
                        <RubyHtml html={row.prompt} />
                      </p>
                      <p className={"result-q-badge" + (row.isCorrect ? " ok" : " ng")}>
                        {row.isCorrect ? "せいかい" : "ざんねん"}
                      </p>
                      {row.userAnswer ? (
                        <p className="muted result-q-ua">
                          あなたのこたえ: <RubyHtml html={row.userAnswer} />
                        </p>
                      ) : null}
                      <div className="result-q-fb">
                        <RubyHtml html={row.feedback} />
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        ) : (
          <p className="muted">けっかデータがありません（きろくからひらいたときなど）</p>
        )}
        <p>
          <Link to={`/exercise/${encodeURIComponent(id)}`}>もんだいにもどる</Link>
        </p>
      </div>

      <div className="card">
        <h3>このプリントのポイント</h3>
        {!summary && !summaryErr && (
          <button type="button" className="btn btn-primary btn-lg" onClick={() => void onGenSummary()} disabled={loading}>
            {loading ? "つくっている…" : "AIでまとめをつくる"}
          </button>
        )}
        {summaryErr && <p className="status">{summaryErr}</p>}
        {summary && (
          <div>
            <ul>
              {summary.key_points.map((k, i) => (
                <li key={i}>
                  <RubyHtml html={k} />
                </li>
              ))}
            </ul>
            <h4>ことば</h4>
            <div className="vocab-list">
              {summary.vocabulary.map((v, i) => (
                <div key={i} className="vocab-item">
                  <h4 className="vocab-head">
                    <RubyHtml
                      html={v.word.toLowerCase().includes("<ruby") ? v.word : rubyFromWordReading(v.word, v.reading)}
                    />
                  </h4>
                  <p>
                    <RubyHtml html={v.meaning} />
                  </p>
                  <ul>
                    {v.examples.map((ex, j) => (
                      <li key={j}>
                        <RubyHtml html={ex} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <p>
        <Link to="/">ホームへ</Link>
      </p>
    </section>
  );
}
