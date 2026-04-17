import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  checkQuestionAnswer,
  explainPassageSelection,
  generateSpeedReadSegments,
  getExercise,
  getQuestionSolution,
  submitAnswers,
  transcribeAudio,
} from "../api/client";
import {
  createJaSpeechRecognition,
  shouldUseBrowserSpeechRecognition,
} from "../hooks/createJaSpeechRecognition";
import { useMediaRecorderAnswer } from "../hooks/useMediaRecorderAnswer";
import { useWebHighlighterExplain } from "../hooks/useWebHighlighterExplain";
import ScanImageModal from "../components/ScanImageModal";
import RubyHtml, { PassageRuby } from "../components/RubyHtml";
import { paths } from "../lib/paths";
import * as L from "../lib/uiLabelsRuby";
import type { AssignmentExerciseRef, Question, QuestionCheckResult } from "../types";

const MAX_VOICE_RECORD_MS = 10_000;
const LS_QUESTIONS_PANEL = "kokugo-exercise-questions-expanded";
const SPEED_READING_MIN_WPM = 80;
const SPEED_READING_MAX_WPM = 420;
const SPEED_READING_DEFAULT_WPM = 180;
const EXPLAIN_SELECTION_MAX_RUNES = 400;

export default function ExercisePage() {
  const { id: rawId } = useParams<{ id: string }>();
  const id = rawId ? decodeURIComponent(rawId) : "";
  const navigate = useNavigate();
  const { start: startRecording, stop: stopRecording, cancel: cancelRecording } = useMediaRecorderAnswer();

  const [title, setTitle] = useState("—");
  const [passage, setPassage] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [listening, setListening] = useState(false);
  const [deviceRecording, setDeviceRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [checkBusy, setCheckBusy] = useState(false);
  const [revealBusy, setRevealBusy] = useState(false);
  const [revealedSolutions, setRevealedSolutions] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<Record<string, QuestionCheckResult>>({});
  const [loadErr, setLoadErr] = useState("");
  const [scanPageCount, setScanPageCount] = useState(0);
  const [scanModalIndex, setScanModalIndex] = useState<number | null>(null);
  const [assignmentSiblings, setAssignmentSiblings] = useState<AssignmentExerciseRef[]>([]);
  const [printAssignmentId, setPrintAssignmentId] = useState("");
  const [questionsPanelExpanded, setQuestionsPanelExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(LS_QUESTIONS_PANEL) !== "false";
  });
  const [speedReadingMode, setSpeedReadingMode] = useState(false);
  const [speedReadingPlaying, setSpeedReadingPlaying] = useState(false);
  const [speedReadingWpm, setSpeedReadingWpm] = useState(SPEED_READING_DEFAULT_WPM);
  const [speedReadingIdx, setSpeedReadingIdx] = useState(0);
  const [speedReadHtmlSegments, setSpeedReadHtmlSegments] = useState<string[] | null>(null);
  const [speedReadGenBusy, setSpeedReadGenBusy] = useState(false);
  const [speedReadGenErr, setSpeedReadGenErr] = useState("");
  const [explainMode, setExplainMode] = useState(false);
  const [explainSelection, setExplainSelection] = useState("");
  const [explainBusy, setExplainBusy] = useState(false);
  const [explainErr, setExplainErr] = useState("");
  const [explainResult, setExplainResult] = useState<{
    importantKeywords: string[];
    shortMeaning: string;
    explanation: string;
  } | null>(null);

  const [passageBodyEl, setPassageBodyEl] = useState<HTMLDivElement | null>(null);
  const isPressingMicRef = useRef(false);
  const holdRecordingActiveRef = useRef(false);
  const maxRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_QUESTIONS_PANEL, questionsPanelExpanded ? "true" : "false");
    } catch {
      /* ignore */
    }
  }, [questionsPanelExpanded]);

  const clearMaxRecordTimer = useCallback(() => {
    if (maxRecordTimerRef.current !== null) {
      clearTimeout(maxRecordTimerRef.current);
      maxRecordTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    getExercise(id)
      .then((d) => {
        setTitle(d.exercise.title || L.exerciseDefaultTitle);
        setPassage(d.exercise.passage || "");
        setQuestions(d.questions || []);
        setAnswers({});
        setChecks({});
        setRevealedSolutions({});
        setQIdx(0);
        const n = d.exercise.imagePaths?.length ?? (d.exercise.imagePath ? 1 : 0);
        setScanPageCount(n);
        const sibs = d.assignment?.exercises;
        setAssignmentSiblings(sibs && sibs.length > 1 ? sibs : []);
        setPrintAssignmentId(d.exercise.assignmentId?.trim() ? d.exercise.assignmentId : "");
        setExplainSelection("");
        setExplainErr("");
        setExplainResult(null);
        const srs = d.exercise.speedReadHtmlSegments;
        if (srs && srs.length > 0) {
          setSpeedReadHtmlSegments(srs);
        } else {
          setSpeedReadHtmlSegments(null);
        }
        setSpeedReadGenErr("");
        setSpeedReadGenBusy(false);
      })
      .catch((e) => setLoadErr(e instanceof Error ? e.message : "エラー"));
  }, [id]);

  useEffect(() => {
    clearMaxRecordTimer();
    isPressingMicRef.current = false;
    holdRecordingActiveRef.current = false;
    cancelRecording();
    setDeviceRecording(false);
    setListening(false);
  }, [qIdx, cancelRecording, clearMaxRecordTimer]);

  const q = questions[qIdx];
  const speedReadingWords = useMemo(() => {
    if (!speedReadingMode || speedReadGenBusy) {
      return [];
    }
    if (speedReadHtmlSegments !== null && speedReadHtmlSegments.length > 0) {
      return speedReadHtmlSegments;
    }
    return [];
  }, [speedReadingMode, speedReadGenBusy, speedReadHtmlSegments]);

  const runSpeedReadGen = useCallback(() => {
    if (!id || !passage.trim()) return;
    setSpeedReadGenBusy(true);
    setSpeedReadGenErr("");
    void generateSpeedReadSegments(id)
      .then((res) => {
        const segs = res.htmlSegments ?? [];
        if (segs.length > 0) {
          setSpeedReadHtmlSegments(segs);
        } else {
          setSpeedReadHtmlSegments(null);
          setSpeedReadGenErr("本文がないか、文節に分けられませんでした。");
        }
      })
      .catch((e) => {
        setSpeedReadHtmlSegments(null);
        setSpeedReadGenErr(e instanceof Error ? e.message : "エラー");
      })
      .finally(() => setSpeedReadGenBusy(false));
  }, [id, passage]);

  useEffect(() => {
    setSpeedReadingPlaying(false);
    setSpeedReadingIdx(0);
    setExplainSelection("");
    setExplainErr("");
    setExplainResult(null);
  }, [passage]);

  const onExplainHlText = useCallback((text: string) => {
    setExplainSelection(text);
    setExplainErr("");
  }, []);

  const { clearVisual: clearExplainHighlight } = useWebHighlighterExplain({
    enabled: explainMode && !speedReadingMode,
    root: passageBodyEl,
    passageKey: passage,
    maxRunes: EXPLAIN_SELECTION_MAX_RUNES,
    onSelectText: onExplainHlText,
  });

  useEffect(() => {
    if (!speedReadingMode || !speedReadingPlaying || speedReadingWords.length === 0) return;
    if (speedReadingIdx >= speedReadingWords.length - 1) {
      setSpeedReadingPlaying(false);
      return;
    }
    const stepMs = Math.max(80, Math.round(60_000 / speedReadingWpm));
    const timer = window.setInterval(() => {
      setSpeedReadingIdx((i) => {
        if (i >= speedReadingWords.length - 1) {
          setSpeedReadingPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, stepMs);
    return () => window.clearInterval(timer);
  }, [speedReadingMode, speedReadingPlaying, speedReadingIdx, speedReadingWords.length, speedReadingWpm]);

  const setAnswer = useCallback((qid: string, val: string) => {
    setAnswers((a) => ({ ...a, [qid]: val }));
    setChecks((c) => {
      if (!c[qid]) return c;
      const { [qid]: _, ...rest } = c;
      return rest;
    });
  }, []);

  const startWebSpeech = () => {
    if (!q || q.type !== "voice") return;
    const r = createJaSpeechRecognition();
    if (!r) {
      alert("このブラウザではブラウザ音声入力がつかえません。録音モードにきりかわります。");
      return;
    }
    setListening(true);
    r.onresult = (ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => {
      const t = ev.results[0][0].transcript;
      setAnswer(q.id, t);
    };
    r.onend = () => setListening(false);
    r.onerror = (ev: { error: string }) => {
      setListening(false);
      if (ev.error === "not-allowed") {
        alert("マイクのきょかがひつようです（ブラウザの設定をかくにん）。");
      }
    };
    try {
      r.start();
    } catch {
      setListening(false);
      alert("音声入力をはじめられませんでした。");
    }
  };

  const needsHTTPSForMic =
    typeof window !== "undefined" && !window.isSecureContext && !shouldUseBrowserSpeechRecognition();

  const onMic = () => {
    if (!q || q.type !== "voice") return;
    if (shouldUseBrowserSpeechRecognition()) {
      startWebSpeech();
    }
  };

  const finishHoldRecording = useCallback(async () => {
    clearMaxRecordTimer();
    if (!holdRecordingActiveRef.current) return;
    holdRecordingActiveRef.current = false;
    const question = q;
    setVoiceBusy(true);
    try {
      const { blob, mime } = await stopRecording();
      if (question?.type === "voice") {
        const { text } = await transcribeAudio(blob, mime);
        setAnswer(question.id, text.trim());
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "文字おこしに失敗しました");
    } finally {
      setVoiceBusy(false);
      setDeviceRecording(false);
    }
  }, [q, stopRecording, setAnswer, clearMaxRecordTimer]);

  const onMicPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!q || q.type !== "voice" || shouldUseBrowserSpeechRecognition()) return;
    if (voiceBusy || (needsHTTPSForMic && !deviceRecording)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isPressingMicRef.current = true;
    void (async () => {
      try {
        await startRecording();
        if (!isPressingMicRef.current) {
          cancelRecording();
          return;
        }
        holdRecordingActiveRef.current = true;
        setDeviceRecording(true);
        maxRecordTimerRef.current = window.setTimeout(() => {
          maxRecordTimerRef.current = null;
          void finishHoldRecording();
        }, MAX_VOICE_RECORD_MS);
      } catch {
        isPressingMicRef.current = false;
        alert(
          "マイクをつかえません。https:// または localhost でひらいているか、iPadの「設定」→「プライバシー」でマイクをきょかしてください。"
        );
      }
    })();
  };

  const onMicPointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (shouldUseBrowserSpeechRecognition()) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
    isPressingMicRef.current = false;
    if (holdRecordingActiveRef.current) void finishHoldRecording();
  };

  const needsCheck = (qq: Question) => qq.scorable !== false;

  const onCheckAnswer = async () => {
    if (!id || !q || !needsCheck(q)) return;
    setCheckBusy(true);
    try {
      const res = await checkQuestionAnswer(id, q.id, answers[q.id] ?? "");
      setChecks((c) => ({ ...c, [q.id]: res }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラー");
    } finally {
      setCheckBusy(false);
    }
  };

  const onRevealSolution = async () => {
    if (!id || !q || !needsCheck(q)) return;
    setRevealBusy(true);
    try {
      const { correctAnswer } = await getQuestionSolution(id, q.id);
      setRevealedSolutions((r) => ({ ...r, [q.id]: correctAnswer }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "せいかいをよみこめませんでした");
    } finally {
      setRevealBusy(false);
    }
  };

  const hideRevealedSolution = () => {
    if (!q) return;
    setRevealedSolutions((r) => {
      const next = { ...r };
      delete next[q.id];
      return next;
    });
  };

  const onSubmit = async () => {
    if (!id) return;
    const payload: Record<string, string> = {};
    for (const qq of questions) {
      payload[qq.id] = answers[qq.id] ?? "";
    }
    try {
      const res = await submitAnswers(id, payload);
      navigate(paths.kokugo.result(id), { state: { result: res } });
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラー");
    }
  };

  const micActive = listening || deviceRecording || voiceBusy;
  const showMicHoldAnimation = deviceRecording || listening;
  const check = q ? checks[q.id] : undefined;
  const scorable = q && needsCheck(q);

  const runExplain = useCallback(async () => {
    if (!id || !explainSelection.trim()) return;
    setExplainBusy(true);
    setExplainErr("");
    try {
      const res = await explainPassageSelection(id, explainSelection);
      setExplainResult(res);
      window.getSelection()?.removeAllRanges();
      clearExplainHighlight();
      setExplainSelection("");
    } catch (e) {
      setExplainErr(e instanceof Error ? e.message : "エラー");
    } finally {
      setExplainBusy(false);
    }
  }, [id, explainSelection, clearExplainHighlight]);

  if (loadErr) {
    return (
      <div className="card">
        <p className="status">{loadErr}</p>
      </div>
    );
  }

  return (
    <section className="view view--wide">
      {printAssignmentId ? (
        <nav className="print-breadcrumb muted">
          <Link to={paths.kokugo.print(printAssignmentId)}>
            <RubyHtml html={L.backToThisPrint} />
          </Link>
        </nav>
      ) : null}
      {assignmentSiblings.length > 0 && (
        <div className="card assignment-sibling-bar" aria-label={L.ariaSiblingSections}>
          <p className="muted assignment-sibling-label">
            <RubyHtml html={L.switchSectionLabel} />
          </p>
          <div className="assignment-sibling-chips">
            {assignmentSiblings.map((s) => (
              <button
                key={s.id}
                type="button"
                className={
                  "btn btn-secondary assignment-sibling-chip" + (s.id === id ? " is-current" : "")
                }
                disabled={s.id === id}
                onClick={() => navigate(paths.kokugo.exercise(s.id))}
              >
                {s.assignmentSort + 1}
                {s.status === "completed" ? " ✓" : ""}
              </button>
            ))}
          </div>
        </div>
      )}
      <div
        className={
          "exercise-layout" + (questionsPanelExpanded ? "" : " exercise-layout--q-collapsed")
        }
      >
        <article className="card passage-panel">
          <div className="passage-head">
            <h2 className="passage-title">
              <RubyHtml html={title} />
            </h2>
            <div className="passage-mode-toggles">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setSpeedReadingMode(false);
                  setSpeedReadingPlaying(false);
                  setExplainMode((v) => {
                    const next = !v;
                    if (!next) {
                      setExplainSelection("");
                      setExplainErr("");
                      setExplainResult(null);
                    }
                    return next;
                  });
                }}
              >
                <RubyHtml html={explainMode ? L.explainModeToggleOff : L.explainModeToggleOn} />
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setExplainMode(false);
                  setExplainSelection("");
                  setExplainErr("");
                  setExplainResult(null);
                  setSpeedReadingMode((v) => {
                    const next = !v;
                    if (!next) setSpeedReadingPlaying(false);
                    return next;
                  });
                }}
              >
                <RubyHtml html={speedReadingMode ? L.speedReadToggleOff : L.speedReadToggleOn} />
              </button>
            </div>
          </div>
          {explainMode && (
            <div className="explain-mode-panel" role="region" aria-label={L.explainModeAriaPanel}>
              <p className="muted explain-mode-hint">
                <RubyHtml html={L.explainModeHint} />
              </p>
              <div className="explain-mode-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!explainSelection.trim() || explainBusy}
                  onClick={() => void runExplain()}
                >
                  {explainBusy ? <RubyHtml html={L.explainModeBusy} /> : <RubyHtml html={L.explainModeButton} />}
                </button>
              </div>
              {explainErr ? <p className="explain-mode-error">{explainErr}</p> : null}
              {explainResult ? (
                <div className="explain-mode-result" aria-live="polite">
                  <div className="explain-mode-block">
                    <h3 className="explain-mode-subhead">
                      <RubyHtml html={L.explainModeDetail} />
                    </h3>
                    <p className="explain-mode-text">
                      <RubyHtml html={explainResult.explanation} as="span" />
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          )}
          {speedReadingMode && (
            <div className="speed-reading-panel" role="region" aria-label="Speed reading">
              <div className="speed-reading-controls">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    if (speedReadingIdx >= speedReadingWords.length - 1) setSpeedReadingIdx(0);
                    setSpeedReadingPlaying((v) => !v);
                  }}
                  disabled={speedReadingWords.length === 0}
                >
                  <RubyHtml html={speedReadingPlaying ? L.speedReadPause : L.speedReadStart} />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setSpeedReadingPlaying(false);
                    setSpeedReadingIdx(0);
                  }}
                  disabled={speedReadingWords.length === 0}
                >
                  <RubyHtml html={L.speedReadReset} />
                </button>
                <label className="speed-reading-slider-wrap">
                  <span className="muted">
                    <RubyHtml html={L.speedReadSpeed} />: {speedReadingWpm} {L.speedReadSpeedUnit}
                  </span>
                  <input
                    type="range"
                    min={SPEED_READING_MIN_WPM}
                    max={SPEED_READING_MAX_WPM}
                    step={10}
                    value={speedReadingWpm}
                    aria-label={L.speedReadAriaSlider}
                    onChange={(e) => setSpeedReadingWpm(Number(e.target.value))}
                  />
                </label>
              </div>
              <div className="speed-reading-track" aria-live="polite">
                {speedReadGenBusy ? (
                  <span className="muted">
                    <RubyHtml html={L.speedReadBunsetsuLoading} />
                  </span>
                ) : speedReadHtmlSegments && speedReadHtmlSegments.length > 0 ? (
                  <span className="muted">
                    {speedReadingIdx + 1}/{speedReadingWords.length}
                  </span>
                ) : (
                  <div className="speed-reading-bunsetsu-setup">
                    <p className="muted speed-reading-bunsetsu-hint">
                      <RubyHtml html={L.speedReadBunsetsuHint} />
                    </p>
                    {speedReadGenErr ? <p className="speed-reading-gen-error">{speedReadGenErr}</p> : null}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void runSpeedReadGen()}
                      disabled={!passage.trim()}
                    >
                      <RubyHtml html={speedReadGenErr ? L.speedReadBunsetsuRetry : L.speedReadBunsetsuGenerate} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {scanPageCount > 0 && (
            <div className="scan-page-strip exercise-scan-strip" aria-label="スキャンしたページ">
              <p className="muted scan-page-count">
                <RubyHtml html={L.scanPagesLabel(scanPageCount)} />
              </p>
              <div className="scan-thumbs">
                {Array.from({ length: scanPageCount }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className="scan-thumb-btn"
                    aria-label={L.ariaEnlargePage(i)}
                    onClick={() => setScanModalIndex(i)}
                  >
                    <img
                      src={`/api/exercises/${encodeURIComponent(id)}/image/${i}`}
                      alt=""
                      className="scan-thumb"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div
            className={"passage-body" + (explainMode && !speedReadingMode ? " passage-body--explain" : "")}
            ref={setPassageBodyEl}
          >
            {speedReadingMode ? (
              <div className="passage-speed-text" aria-live="polite">
                {speedReadingWords.map((word, idx) => (
                  <span
                    key={`${word}-${idx}`}
                    className={"speed-reading-word" + (idx === speedReadingIdx ? " is-active" : "")}
                  >
                    <RubyHtml html={word} />
                  </span>
                ))}
              </div>
            ) : (
              <PassageRuby text={passage} />
            )}
          </div>
        </article>

        <div className="exercise-question-dock-spacer" aria-hidden="true" />

        <article
          className={
            "card question-panel" + (questionsPanelExpanded ? "" : " question-panel--collapsed")
          }
        >
          <div className="question-panel-toolbar">
            <button
              type="button"
              className="question-panel-toggle"
              onClick={() => setQuestionsPanelExpanded((v) => !v)}
              aria-expanded={questionsPanelExpanded}
              aria-label={questionsPanelExpanded ? L.ariaQuestionPanelClose : L.ariaQuestionPanelOpen}
            >
              {questionsPanelExpanded ? (
                <>
                  <span aria-hidden>⟨</span>
                  <span className="question-panel-toggle-label">
                    <RubyHtml html={L.panelClose} />
                  </span>
                </>
              ) : (
                <>
                  <span className="question-panel-toggle-collapsed-title">
                    <RubyHtml html={L.panelCollapsedTitle} />
                  </span>
                  {questions.length > 0 ? (
                    <span className="question-panel-toggle-progress">
                      {qIdx + 1}/{questions.length}
                    </span>
                  ) : null}
                  <span className="question-panel-toggle-open-hint" aria-hidden>
                    ⟩
                  </span>
                </>
              )}
            </button>
          </div>
          <div className="question-panel-inner">
          {!questions.length ? (
            <p className="q-prompt">
              <RubyHtml html={L.noQuestionsRescan} />
            </p>
          ) : (
            <>
              <div className="q-meta">
                <span>
                  <RubyHtml html={L.questionProgress(qIdx + 1, questions.length)} />
                </span>
                <span className="muted" />
              </div>
              <p className="q-prompt">
                <RubyHtml html={q.prompt} />
              </p>

              <div className="question-interaction-body">
                <div className="question-interaction-main">
                  {q.type === "choice" ? (
                    <div className="choice-grid">
                      {(q.options || []).map((opt, i) => {
                        const lab = String.fromCharCode(65 + i);
                        const sel = answers[q.id] === opt;
                        return (
                          <button
                            key={i}
                            type="button"
                            className={"choice-btn" + (sel ? " selected" : "")}
                            onClick={() => setAnswer(q.id, opt)}
                          >
                            <span className="choice-label">{lab}</span>{" "}
                            <RubyHtml html={opt} />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="voice-area">
                      {needsHTTPSForMic && (
                        <div className="voice-https-banner" role="status">
                          <strong>
                            <RubyHtml html={L.httpsMicNeeded} />
                          </strong>
                          <p>
                            <RubyHtml html={L.httpsMicBody} />
                          </p>
                          <pre className="cmd-snippet">tailscale serve https / http://127.0.0.1:8787</pre>
                          <p className="muted">
                            <RubyHtml html={L.httpsMicReadmeHint} />
                          </p>
                        </div>
                      )}
                      <div className="voice-mic-column">
                        <div
                          className={
                            "mic-btn-wrap" + (showMicHoldAnimation ? " mic-btn-wrap--recording" : "")
                          }
                        >
                          {showMicHoldAnimation && (
                            <div className="mic-orbit-layer" aria-hidden>
                              <span className="mic-orbit-ring" />
                              <span className="mic-orbit-arm">
                                <span className="mic-orbit-dot" />
                              </span>
                              <span className="mic-orbit-arm mic-orbit-arm--lag">
                                <span className="mic-orbit-dot mic-orbit-dot--secondary" />
                              </span>
                            </div>
                          )}
                          <button
                            type="button"
                            className={"mic-btn" + (micActive ? " listening" : "")}
                            aria-label={
                              shouldUseBrowserSpeechRecognition()
                                ? L.micAriaBrowser
                                : deviceRecording
                                  ? L.micAriaRecording
                                  : L.micAriaHold
                            }
                            disabled={voiceBusy || (needsHTTPSForMic && !deviceRecording)}
                            onClick={shouldUseBrowserSpeechRecognition() ? () => onMic() : undefined}
                            onPointerDown={shouldUseBrowserSpeechRecognition() ? undefined : onMicPointerDown}
                            onPointerUp={shouldUseBrowserSpeechRecognition() ? undefined : onMicPointerEnd}
                            onPointerCancel={shouldUseBrowserSpeechRecognition() ? undefined : onMicPointerEnd}
                            onContextMenu={
                              shouldUseBrowserSpeechRecognition() ? undefined : (ev) => ev.preventDefault()
                            }
                          >
                            🎤
                          </button>
                        </div>
                        <p className="muted voice-mic-hint">
                          <RubyHtml
                            html={
                              shouldUseBrowserSpeechRecognition()
                                ? L.micHintBrowser
                                : deviceRecording
                                  ? L.micHintRelease
                                  : voiceBusy
                                    ? L.transcribing
                                    : L.micHintHold
                            }
                          />
                        </p>
                        {!shouldUseBrowserSpeechRecognition() && (
                          <p className="muted voice-hint-ios">
                            <RubyHtml html={L.micHintIos} />
                          </p>
                        )}
                      </div>
                      <p className="voice-text">
                        <RubyHtml html={answers[q.id] || ""} />
                      </p>
                    </div>
                  )}
                </div>
                {scorable && (
                  <aside className="question-interaction-actions" aria-label={L.ariaQuestionActions}>
                    <div className="question-actions-stack">
                      <button
                        type="button"
                        className="btn btn-secondary btn-lg question-action-btn"
                        disabled={checkBusy}
                        onClick={() => void onCheckAnswer()}
                      >
                        <RubyHtml html={checkBusy ? L.checkAnswerBusy : L.checkAnswer} />
                      </button>
                      {!check && (
                        <p className="muted question-check-hint">
                          <RubyHtml html={L.checkHint} />
                        </p>
                      )}
                      {revealedSolutions[q.id] === undefined ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-lg question-action-btn q-reveal-btn"
                          disabled={revealBusy}
                          onClick={() => void onRevealSolution()}
                        >
                          <RubyHtml html={revealBusy ? L.revealBusy : L.revealAnswer} />
                        </button>
                      ) : null}
                    </div>
                  </aside>
                )}
              </div>
              {scorable && revealedSolutions[q.id] !== undefined && (
                <div className="q-reveal-block q-reveal-block--below-actions">
                  <div className="q-reveal-panel" role="region" aria-label={L.ariaRevealRegion}>
                    <div className="q-reveal-head">
                      <span className="q-reveal-label">
                        <RubyHtml html={L.revealLabel} />
                      </span>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={hideRevealedSolution}>
                        <RubyHtml html={L.hideJa} />
                      </button>
                    </div>
                    <div className="q-reveal-body">
                      <RubyHtml html={revealedSolutions[q.id]} />
                    </div>
                  </div>
                </div>
              )}
              {!scorable && (
                <p className="muted q-scorable-skip">
                  <RubyHtml html={L.skipAutoScore} />
                </p>
              )}
              {check && (
                <div
                  className={
                    "q-feedback" + (check.isCorrect ? " q-feedback-correct" : " q-feedback-wrong")
                  }
                  role="status"
                >
                  <strong>
                    <RubyHtml html={check.isCorrect ? L.correctJa : L.wrongJa} />
                  </strong>
                  <div>
                    <RubyHtml html={check.feedback} />
                  </div>
                </div>
              )}

              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-lg"
                  disabled={qIdx <= 0}
                  onClick={() => setQIdx((i) => i - 1)}
                >
                  <RubyHtml html={L.prevJa} />
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  disabled={qIdx >= questions.length - 1}
                  onClick={() => setQIdx((i) => i + 1)}
                >
                  <RubyHtml html={L.nextJa} />
                </button>
              </div>
              <button type="button" className="btn btn-primary btn-xl btn-block" onClick={onSubmit}>
                <RubyHtml html={L.submitAll} />
              </button>
            </>
          )}
          </div>
        </article>
      </div>

      {scanModalIndex !== null && scanPageCount > 0 && (
        <ScanImageModal
          exerciseId={id}
          pageIndex={scanModalIndex}
          totalPages={scanPageCount}
          onClose={() => setScanModalIndex(null)}
          onChangePage={setScanModalIndex}
        />
      )}
    </section>
  );
}
