import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { generatePrintSummary, getExercise, getPrintSummary } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import { paths } from "../lib/paths";
import * as L from "../lib/uiLabelsRuby";
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
    <section className="view view--wide">
      {printAssignmentId ? (
        <nav className="print-breadcrumb muted">
          <Link to={paths.kokugo.print(printAssignmentId)}>
            <RubyHtml html={L.backToThisPrint} />
          </Link>
        </nav>
      ) : null}
      <div className="card">
        <h2>
          <RubyHtml html={L.resultHead} />
        </h2>
        {r ? (
          <>
            <p className="score-big">
              <RubyHtml html={L.resultScoreLine(r.scorePercent, r.correct, r.total)} />
            </p>
            {r.questionResults && r.questionResults.length > 0 && (
              <div className="result-by-question">
                <h3 className="result-by-q-head">
                  <RubyHtml html={L.resultByQuestion} />
                </h3>
                <ol className="result-q-list">
                  {r.questionResults.map((row) => (
                    <li key={row.questionId} className="result-q-item">
                      <p className="result-q-prompt">
                        <RubyHtml html={row.prompt} />
                      </p>
                      <p className={"result-q-badge" + (row.isCorrect ? " ok" : " ng")}>
                        <RubyHtml html={row.isCorrect ? L.correctJa : L.wrongJa} />
                      </p>
                      {row.userAnswer ? (
                        <p className="muted result-q-ua">
                          <RubyHtml html={L.yourAnswer} /> <RubyHtml html={row.userAnswer} />
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
          <p className="muted">
            <RubyHtml html={L.resultNoData} />
          </p>
        )}
        <p>
          <Link to={paths.kokugo.exercise(id)}>
            <RubyHtml html={L.backToQuestions} />
          </Link>
        </p>
        {nextInPrint ? (
          <p className="result-next-print">
            <Link to={paths.kokugo.exercise(nextInPrint.id)}>
              <RubyHtml html={L.nextSectionPractice(nextInPrint.assignmentSort + 1)} />
            </Link>
          </p>
        ) : null}
      </div>

      <div className="card">
        <h3>
          <RubyHtml html={L.printPointsHead} />
        </h3>
        <p className="muted">
          <RubyHtml html={L.printPointsLeadP1} />
          {printAssignmentId ? (
            <Link to={paths.kokugo.print(printAssignmentId)}>
              <RubyHtml html={L.printPointsLink} />
            </Link>
          ) : (
            <RubyHtml html={L.printPointsLink} />
          )}
          <RubyHtml html={L.printPointsLeadP2} />
        </p>
        {!printAssignmentId ? (
          <p className="muted">
            <RubyHtml html={L.noPrintIdSummary} />
          </p>
        ) : null}
        {!summary && !summaryErr && printAssignmentId ? (
          <button type="button" className="btn btn-primary btn-lg" onClick={() => void onGenSummary()} disabled={loading}>
            <RubyHtml html={loading ? L.makingSummary : L.aiMakeSummary} />
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
                <h4 className="print-summary-kw-head">
                  <RubyHtml html={L.wordsPoints} />
                </h4>
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
                  <RubyHtml html={loading ? L.regenSummaryBusy : L.regenSummary} />
                </button>
              </p>
            ) : null}
          </div>
        )}
      </div>

      <p>
        <Link to={paths.kokugo.prints}>
          <RubyHtml html={L.toPrintList} />
        </Link>
      </p>
    </section>
  );
}
