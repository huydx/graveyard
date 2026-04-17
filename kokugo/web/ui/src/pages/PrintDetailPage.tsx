import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteExercise, generatePrintSummary, getPrint, getPrintSummary, patchPrintTitle } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import { isEnterWithoutIme } from "../lib/keyboard";
import {
  exerciseRowTitleHtml,
  exerciseStatusJa,
  exerciseTitleFallbackHtml,
  isOnlyBareEmptyPrint,
} from "../lib/printTitle";
import { splitOverviewToPlainBullets } from "../lib/overviewBullets";
import { paths } from "../lib/paths";
import * as L from "../lib/uiLabelsRuby";
import type { AssignmentGroup, Exercise, PrintLearningSummary } from "../types";

function primaryOf(a: AssignmentGroup): Exercise | undefined {
  return a.exercises?.[0];
}

function firstExerciseToOpen(a: AssignmentGroup): Exercise | undefined {
  const inc = a.exercises.find((e) => e.status !== "completed");
  return inc ?? a.exercises[0];
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function PrintDetailPage() {
  const { assignmentId: rawAid } = useParams<{ assignmentId: string }>();
  const assignmentId = rawAid ? decodeURIComponent(rawAid) : "";
  const navigate = useNavigate();
  const [print, setPrint] = useState<AssignmentGroup | null>(null);
  const [err, setErr] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [titleEdit, setTitleEdit] = useState("");
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleErr, setTitleErr] = useState("");
  const [printSummary, setPrintSummary] = useState<PrintLearningSummary | null>(null);
  const [summaryErr, setSummaryErr] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  const load = useCallback(() => {
    if (!assignmentId) return Promise.resolve();
    setErr("");
    return getPrint(assignmentId)
      .then((d) => setPrint(d.print))
      .catch((e) => setErr(e instanceof Error ? e.message : "エラー"));
  }, [assignmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasParsed =
    print?.exercises?.some((e) => e.status === "parsed" || e.status === "completed") ?? false;

  useEffect(() => {
    if (!assignmentId || !hasParsed) {
      setPrintSummary(null);
      setSummaryErr("");
      return;
    }
    getPrintSummary(assignmentId)
      .then((s) => {
        setPrintSummary(s);
        setSummaryErr("");
      })
      .catch(() => {
        setPrintSummary(null);
        setSummaryErr("");
      });
  }, [assignmentId, hasParsed]);

  useEffect(() => {
    if (!print) return;
    setTitleEdit(print.title ?? "");
    setTitleErr("");
  }, [print?.id, print?.title]);

  const overviewBullets = useMemo(
    () => (printSummary?.overview ? splitOverviewToPlainBullets(printSummary.overview) : []),
    [printSummary?.overview],
  );

  const saveTitle = async () => {
    if (!assignmentId || !print) return;
    const next = titleEdit.trim();
    const prev = (print.title ?? "").trim();
    if (next === prev) {
      setTitleErr("");
      return;
    }
    setTitleSaving(true);
    setTitleErr("");
    try {
      const { title } = await patchPrintTitle(assignmentId, titleEdit);
      setPrint((p) => (p ? { ...p, title } : p));
      setTitleEdit(title);
    } catch (e) {
      setTitleErr(e instanceof Error ? e.message : "エラー");
    } finally {
      setTitleSaving(false);
    }
  };

  const openExercise = (ex: Exercise) => {
    if (ex.status === "completed") {
      navigate(paths.kokugo.result(ex.id));
    } else {
      navigate(paths.kokugo.exercise(ex.id));
    }
  };

  const startPracticeForPrint = () => {
    if (!print) return;
    const ex = firstExerciseToOpen(print);
    if (ex) openExercise(ex);
  };

  const goScan = () => {
    if (!assignmentId) return;
    navigate(paths.kokugo.scan(assignmentId));
  };

  const removeOne = async (ex: Exercise) => {
    if (!window.confirm(L.confirmDeleteSection)) return;
    setDeletingId(ex.id);
    try {
      await deleteExercise(ex.id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラー");
    } finally {
      setDeletingId(null);
    }
  };

  const removeWhole = async () => {
    if (!print) return;
    const p = primaryOf(print);
    if (!p) return;
    if (!window.confirm(L.confirmDeletePrint)) return;
    setDeletingId(p.id);
    try {
      await deleteExercise(p.id);
      navigate(paths.kokugo.prints);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラー");
    } finally {
      setDeletingId(null);
    }
  };

  if (!assignmentId) {
    return (
      <div className="card">
        <p className="status">
          <RubyHtml html={L.invalidId} />
        </p>
        <Link to={paths.kokugo.prints}>
          <RubyHtml html={L.toPrintList} />
        </Link>
      </div>
    );
  }

  if (err && !print) {
    return (
      <div className="card">
        <p className="status">{err}</p>
        <Link to={paths.kokugo.prints}>
          <RubyHtml html={L.toPrintList} />
        </Link>
      </div>
    );
  }

  if (!print) {
    return (
      <div className="card">
        <p className="muted">
          <RubyHtml html={L.loadingDots} />
        </p>
      </div>
    );
  }

  const primary = primaryOf(print);
  const doneCount = print.exercises.filter((e) => e.status === "completed").length;
  const onlyBareEmpty = isOnlyBareEmptyPrint(print);

  const onGenPrintSummary = async () => {
    if (!assignmentId) return;
    setSummaryLoading(true);
    setSummaryErr("");
    try {
      const { summary: s } = await generatePrintSummary(assignmentId);
      setPrintSummary(s);
    } catch (e) {
      setSummaryErr(e instanceof Error ? e.message : "エラー");
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <section className="view print-detail">
      <nav className="print-breadcrumb muted print-breadcrumb--multi">
        <Link to={paths.home}>
          <RubyHtml html={L.backHomeKid} />
        </Link>
        <span className="breadcrumb-sep" aria-hidden>
          ·
        </span>
        <Link to={paths.kokugo.prints}>
          <RubyHtml html={L.backPrintList} />
        </Link>
      </nav>

      <div className="card print-detail-head">
        <div className="print-title-field">
          <label htmlFor="print-title-input" className="print-title-label">
            <RubyHtml html={L.printDetailTitleLabel} />
          </label>
          <input
            id="print-title-input"
            type="text"
            className="print-title-input"
            value={titleEdit}
            onChange={(e) => setTitleEdit(e.target.value)}
            onBlur={() => void saveTitle()}
            onKeyDown={(e) => {
              if (!isEnterWithoutIme(e)) return;
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }}
            placeholder="例: 10がつ2しゅうのしゅくだい（なくてもOK）"
            maxLength={200}
            disabled={titleSaving}
            autoComplete="off"
            enterKeyHint="done"
          />
          {titleSaving ? (
            <p className="muted print-title-saving">
              <RubyHtml html={L.printTitleSaving} />
            </p>
          ) : null}
          {titleErr ? <p className="status">{titleErr}</p> : null}
          {!titleEdit.trim() && print.exercises?.length && !onlyBareEmpty ? (
            <p className="muted print-title-fallback-preview">
              <RubyHtml html={L.emptyNamePreviewLabel} /> <RubyHtml html={exerciseTitleFallbackHtml(print)} />
            </p>
          ) : null}
        </div>
        <p className="muted print-detail-meta">
          {onlyBareEmpty ? (
            <RubyHtml html={L.metaJustCreated} />
          ) : (
            <>
              {formatWhen(print.createdAt)} · <RubyHtml html={L.metaSectionCount(print.exercises.length)} />
              {hasParsed ? <RubyHtml html={L.metaPracticeProgress(doneCount, print.exercises.length)} /> : null}
            </>
          )}
        </p>
        {err ? <p className="status">{err}</p> : null}

        <div className="print-detail-actions">
          <button type="button" className="btn btn-primary btn-xl" onClick={goScan} disabled={!primary}>
            <RubyHtml
              html={
                onlyBareEmpty ? L.scanPrintCta : hasParsed ? L.scanAddPagesCta : L.scanNewSectionCta
              }
            />
          </button>
          {hasParsed ? (
            <button type="button" className="btn btn-secondary btn-xl" onClick={startPracticeForPrint}>
              <RubyHtml html={L.practiceThisPrint} />
            </button>
          ) : null}
          <details className="print-danger-menu">
            <summary className="print-danger-summary" aria-label="ほかの操作（けすなど）">
              ⋯
            </summary>
            <div className="print-danger-panel">
              <button
                type="button"
                className="btn btn-danger-soft"
                disabled={deletingId !== null || !primary}
                onClick={() => void removeWhole()}
              >
                <RubyHtml html={L.deleteThisPrint} />
              </button>
            </div>
          </details>
        </div>
      </div>

      {hasParsed && !onlyBareEmpty ? (
        <div className="card print-summary-card">
          <h3 className="prints-subhead">
            <RubyHtml html={L.printWholeSummaryHead} />
          </h3>
          <p className="muted">
            <RubyHtml html={L.printWholeSummaryLead} />
          </p>
          {summaryErr ? <p className="status">{summaryErr}</p> : null}
          {!printSummary && !summaryErr ? (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => void onGenPrintSummary()}
              disabled={summaryLoading}
            >
              <RubyHtml html={summaryLoading ? L.makingSummary : L.aiMakeSummary} />
            </button>
          ) : null}
          {printSummary ? (
            <div className="print-summary-block">
              {printSummary.overview ? (
                overviewBullets.length >= 2 ? (
                  <>
                    <h4 className="print-summary-subhead">
                      <RubyHtml html={L.printSummaryTodayHead} />
                    </h4>
                    <ul className="print-summary-overview-bullets">
                      {overviewBullets.map((line, bi) => (
                        <li key={bi}>{line}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="print-summary-overview">
                    <RubyHtml html={printSummary.overview} />
                  </p>
                )
              ) : null}
              {printSummary.keyword_cards?.length ? (
                <>
                  <h4 className="print-summary-kw-head">
                    <RubyHtml html={L.printSummaryWordsHead} />
                  </h4>
                  <ul className="print-summary-kw-list">
                    {printSummary.keyword_cards.map((row, i) => (
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
              <p className="muted print-summary-regen">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void onGenPrintSummary()}
                  disabled={summaryLoading}
                >
                  <RubyHtml html={summaryLoading ? L.regenSummaryBusy : L.regenSummary} />
                </button>
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {onlyBareEmpty ? (
        <div className="card print-empty-card">
          <h3 className="prints-subhead print-empty-head">
            <RubyHtml html={L.nextStepsHead} />
          </h3>
          <p className="print-empty-lead">
            <RubyHtml html={L.emptyPrintLead} />
          </p>
        </div>
      ) : (
        <div className="card">
          <h3 className="prints-subhead">
            <RubyHtml html={L.sectionListHead} />
          </h3>
          <p className="muted">
            <RubyHtml html={L.sectionListHint} />
          </p>
          <ul className="history-list">
            {print.exercises.map((ex, i) => (
              <li key={ex.id} className="history-row history-nested-row">
                <button type="button" className="history-row-main" onClick={() => openExercise(ex)}>
                  <span className="muted">
                    <RubyHtml html={L.sectionChip(i)} />
                  </span>{" "}
                  <RubyHtml html={exerciseRowTitleHtml(ex)} /> — <RubyHtml html={exerciseStatusJa(ex.status)} />
                  {typeof ex.scorePercent === "number" ? ` — ${ex.scorePercent}%` : ""}
                </button>
                <details className="history-row-danger">
                  <summary className="history-row-danger-summary" aria-label={L.ariaDeleteSection}>
                    ⋯
                  </summary>
                  <div className="history-row-danger-panel">
                    <button
                      type="button"
                      className="btn btn-danger-soft btn-sm"
                      disabled={deletingId !== null}
                      onClick={(e) => {
                        e.preventDefault();
                        void removeOne(ex);
                      }}
                    >
                      {deletingId === ex.id ? "…" : <RubyHtml html={L.deleteKanji} />}
                    </button>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
