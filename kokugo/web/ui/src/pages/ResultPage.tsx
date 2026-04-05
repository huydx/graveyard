import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { generatePrintSummary, getExercise, getPrintSummary } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import type { AssignmentExerciseRef, PrintLearningSummary, SubmitResult } from "../types";

export default function ResultPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const id = rawId ? decodeURIComponent(rawId) : "";
  const location = useLocation();
  const state = location.state as { result?: SubmitResult } | undefined;

  const [summary, setSummary] = useState<PrintLearningSummary | null>(null);
  const [summaryErr, setSummaryErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [printAssignmentId, setPrintAssignmentId] = useState("");
  const [siblingRows, setSiblingRows] = useState<AssignmentExerciseRef[]>([]);

  useEffect(() => {
    if (!id) return;
    getExercise(id)
      .then((d) => {
        const aid = d.exercise.assignmentId?.trim() ?? "";
        setPrintAssignmentId(aid);
        setSiblingRows(d.assignment?.exercises ?? []);
      })
      .catch(() => {
        setPrintAssignmentId("");
        setSiblingRows([]);
      });
  }, [id]);

  useEffect(() => {
    if (!printAssignmentId) return;
    getPrintSummary(printAssignmentId)
      .then((s) => setSummary(s))
      .catch(() => {
        setSummary(null);
      });
  }, [printAssignmentId]);

  const onGenSummary = async () => {
    if (!printAssignmentId) return;
    setLoading(true);
    setSummaryErr("");
    try {
      const { summary: s } = await generatePrintSummary(printAssignmentId);
      setSummary(s);
    } catch (e) {
      setSummaryErr(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  };

  const r = state?.result;

  const nextInPrint = (() => {
    const idx = siblingRows.findIndex((e) => e.id === id);
    const rest = idx >= 0 ? siblingRows.slice(idx + 1) : siblingRows;
    return rest.find((e) => e.status !== "completed");
  })();

  return (
    <section className="view">
      {printAssignmentId ? (
        <nav className="print-breadcrumb muted">
          <Link to={`/prints/${encodeURIComponent(printAssignmentId)}`}>← このプリントにもどる</Link>
        </nav>
      ) : null}
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
        {nextInPrint ? (
          <p className="result-next-print">
            <Link to={`/exercise/${encodeURIComponent(nextInPrint.id)}`}>
              つぎのだい（{nextInPrint.assignmentSort + 1}）のれんしゅうへ →
            </Link>
          </p>
        ) : null}
      </div>

      <div className="card">
        <h3>このプリントのポイント</h3>
        <p className="muted">
          まとめは<strong>プリントぜんたい</strong>（すべてのだい）を対象にします。くわしくは
          {printAssignmentId ? (
            <Link to={`/prints/${encodeURIComponent(printAssignmentId)}`}>プリントページ</Link>
          ) : (
            "プリントページ"
          )}
          でも見られます。
        </p>
        {!printAssignmentId ? (
          <p className="muted">このもんだいにはプリントIDがないため、ここではまとめをつくれません。</p>
        ) : null}
        {!summary && !summaryErr && printAssignmentId ? (
          <button type="button" className="btn btn-primary btn-lg" onClick={() => void onGenSummary()} disabled={loading}>
            {loading ? "つくっている…" : "AIでまとめをつくる"}
          </button>
        ) : null}
        {summaryErr && <p className="status">{summaryErr}</p>}
        {summary && (
          <div className="print-summary-block">
            {summary.overview ? (
              <p className="print-summary-overview">
                <RubyHtml html={summary.overview} />
              </p>
            ) : null}
            {summary.keyword_cards?.length ? (
              <>
                <h4 className="print-summary-kw-head">ことば・ポイント（最大10）</h4>
                <ul className="print-summary-kw-list">
                  {summary.keyword_cards.map((row, i) => (
                    <li key={i} className="print-summary-card-row">
                      <p className="print-summary-phrase">
                        <RubyHtml html={row.phrase} />
                      </p>
                      {row.nuance ? (
                        <p className="muted print-summary-nuance">
                          <RubyHtml html={row.nuance} />
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {printAssignmentId ? (
              <p className="muted print-summary-regen">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void onGenSummary()}
                  disabled={loading}
                >
                  {loading ? "つくりなおしちゅう…" : "まとめをつくりなおす"}
                </button>
              </p>
            ) : null}
          </div>
        )}
      </div>

      <p>
        <Link to="/prints">プリント一覧へ</Link>
      </p>
    </section>
  );
}
