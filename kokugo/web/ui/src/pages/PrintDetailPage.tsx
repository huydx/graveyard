import { useCallback, useEffect, useState } from "react";
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
      navigate(`/result/${encodeURIComponent(ex.id)}`);
    } else {
      navigate(`/exercise/${encodeURIComponent(ex.id)}`);
    }
  };

  const startPracticeForPrint = () => {
    if (!print) return;
    const ex = firstExerciseToOpen(print);
    if (ex) openExercise(ex);
  };

  const goScan = () => {
    if (!assignmentId) return;
    navigate(`/prints/${encodeURIComponent(assignmentId)}/scan`);
  };

  const removeOne = async (ex: Exercise) => {
    if (!window.confirm("このだいを削除しますか？（もとに戻せません）")) return;
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
    if (!window.confirm("このプリントぜんたいを削除しますか？（もとに戻せません）")) return;
    setDeletingId(p.id);
    try {
      await deleteExercise(p.id);
      navigate("/prints");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラー");
    } finally {
      setDeletingId(null);
    }
  };

  if (!assignmentId) {
    return (
      <div className="card">
        <p className="status">IDが不正です</p>
        <Link to="/prints">プリント一覧へ</Link>
      </div>
    );
  }

  if (err && !print) {
    return (
      <div className="card">
        <p className="status">{err}</p>
        <Link to="/prints">プリント一覧へ</Link>
      </div>
    );
  }

  if (!print) {
    return (
      <div className="card">
        <p className="muted">よみこみちゅう…</p>
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
      <nav className="print-breadcrumb muted">
        <Link to="/prints">← プリント一覧</Link>
      </nav>

      <div className="card print-detail-head">
        <div className="print-title-field">
          <label htmlFor="print-title-input" className="print-title-label">
            このプリントのなまえ（わかりやすく）
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
          {titleSaving ? <p className="muted print-title-saving">ほぞんちゅう…</p> : null}
          {titleErr ? <p className="status">{titleErr}</p> : null}
          {!titleEdit.trim() && print.exercises?.length && !onlyBareEmpty ? (
            <p className="muted print-title-fallback-preview">
              なまえを空けたときのひょうじ: <RubyHtml html={exerciseTitleFallbackHtml(print)} />
            </p>
          ) : null}
        </div>
        <p className="muted print-detail-meta">
          {onlyBareEmpty ? (
            <>つくったばかり · まだもんだいはありません</>
          ) : (
            <>
              {formatWhen(print.createdAt)} · {print.exercises.length} だい
              {hasParsed ? ` · れんしゅう ${doneCount}/${print.exercises.length} おわり` : null}
            </>
          )}
        </p>
        {err ? <p className="status">{err}</p> : null}

        <div className="print-detail-actions">
          <button type="button" className="btn btn-primary btn-xl" onClick={goScan} disabled={!primary}>
            {onlyBareEmpty
              ? "プリントをスキャンする"
              : hasParsed
                ? "画像をスキャン（だいをついか）"
                : "画像をスキャン（だいをつくる）"}
          </button>
          {hasParsed ? (
            <button type="button" className="btn btn-secondary btn-xl" onClick={startPracticeForPrint}>
              このプリントのれんしゅう
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost"
            disabled={deletingId !== null || !primary}
            onClick={() => void removeWhole()}
          >
            このプリントを削除
          </button>
        </div>
      </div>

      {hasParsed && !onlyBareEmpty ? (
        <div className="card print-summary-card">
          <h3 className="prints-subhead">プリントぜんたいのまとめ</h3>
          <p className="muted">すべてのだいをまとめて、おぼえておきたいことばやポイント（最大10）をつくります。</p>
          {summaryErr ? <p className="status">{summaryErr}</p> : null}
          {!printSummary && !summaryErr ? (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => void onGenPrintSummary()}
              disabled={summaryLoading}
            >
              {summaryLoading ? "つくっている…" : "AIでまとめをつくる"}
            </button>
          ) : null}
          {printSummary ? (
            <div className="print-summary-block">
              {printSummary.overview ? (
                <p className="print-summary-overview">
                  <RubyHtml html={printSummary.overview} />
                </p>
              ) : null}
              {printSummary.keyword_cards?.length ? (
                <>
                  <h4 className="print-summary-kw-head">ことば・ポイント</h4>
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
                  {summaryLoading ? "つくりなおしちゅう…" : "まとめをつくりなおす"}
                </button>
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {onlyBareEmpty ? (
        <div className="card print-empty-card">
          <h3 className="prints-subhead print-empty-head">つぎのステップ</h3>
          <p className="print-empty-lead">
            いまは<strong>もんだい</strong>がまだありません。上のボタンでプリントの<strong>写真</strong>をいれて、AIに
            <strong>よみとって</strong>もらうと、<strong>だい</strong>がここに列ばされます。
          </p>
        </div>
      ) : (
        <div className="card">
          <h3 className="prints-subhead">だいのいちらん</h3>
          <p className="muted">
            れんしゅうは「このプリントのれんしゅう」か、下の<strong>だい</strong>からはじめられます。
          </p>
          <ul className="history-list">
            {print.exercises.map((ex, i) => (
              <li key={ex.id} className="history-row history-nested-row">
                <button type="button" className="history-row-main" onClick={() => openExercise(ex)}>
                  <span className="muted">だい {i + 1}</span>{" "}
                  <RubyHtml html={exerciseRowTitleHtml(ex)} /> — {exerciseStatusJa(ex.status)}
                  {typeof ex.scorePercent === "number" ? ` — ${ex.scorePercent}%` : ""}
                </button>
                <button
                  type="button"
                  className="history-row-delete"
                  aria-label="このだいだけ削除"
                  disabled={deletingId !== null}
                  onClick={() => void removeOne(ex)}
                >
                  {deletingId === ex.id ? "…" : "削除"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
