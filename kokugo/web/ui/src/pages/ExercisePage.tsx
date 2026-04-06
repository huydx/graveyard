import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  checkQuestionAnswer,
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
import ScanImageModal from "../components/ScanImageModal";
import RubyHtml, { PassageRuby } from "../components/RubyHtml";
import { furiganaToSpeechText } from "../lib/ruby";
import type { AssignmentExerciseRef, Question, QuestionCheckResult } from "../types";

const MAX_VOICE_RECORD_MS = 10_000;
const LS_QUESTIONS_PANEL = "kokugo-exercise-questions-expanded";

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
        setTitle(d.exercise.title || "（だいもくなし）");
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

  const setAnswer = useCallback((qid: string, val: string) => {
    setAnswers((a) => ({ ...a, [qid]: val }));
    setChecks((c) => {
      if (!c[qid]) return c;
      const { [qid]: _, ...rest } = c;
      return rest;
    });
  }, []);

  const readPassage = () => {
    const u = new SpeechSynthesisUtterance(furiganaToSpeechText(passage));
    u.lang = "ja-JP";
    u.rate = 0.92;
    speechSynthesis.speak(u);
  };

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
      navigate(`/result/${encodeURIComponent(id)}`, { state: { result: res } });
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラー");
    }
  };

  const micActive = listening || deviceRecording || voiceBusy;
  const showMicHoldAnimation = deviceRecording || listening;
  const check = q ? checks[q.id] : undefined;
  const scorable = q && needsCheck(q);

  if (loadErr) {
    return (
      <div className="card">
        <p className="status">{loadErr}</p>
      </div>
    );
  }

  return (
    <section className="view">
      {printAssignmentId ? (
        <nav className="print-breadcrumb muted">
          <Link to={`/prints/${encodeURIComponent(printAssignmentId)}`}>← このプリントにもどる</Link>
        </nav>
      ) : null}
      {assignmentSiblings.length > 0 && (
        <div className="card assignment-sibling-bar" aria-label="このプリントのほかのだい">
          <p className="muted assignment-sibling-label">このプリントのだいをきりかえ</p>
          <div className="assignment-sibling-chips">
            {assignmentSiblings.map((s) => (
              <button
                key={s.id}
                type="button"
                className={
                  "btn btn-secondary assignment-sibling-chip" + (s.id === id ? " is-current" : "")
                }
                disabled={s.id === id}
                onClick={() => navigate(`/exercise/${encodeURIComponent(s.id)}`)}
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
            <button type="button" className="btn btn-ghost" onClick={readPassage}>
              よみあげ
            </button>
          </div>
          {scanPageCount > 0 && (
            <div className="scan-page-strip exercise-scan-strip" aria-label="スキャンしたページ">
              <p className="muted scan-page-count">
                {scanPageCount} まいのプリント（サムネをタップでおおきくみる）
              </p>
              <div className="scan-thumbs">
                {Array.from({ length: scanPageCount }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className="scan-thumb-btn"
                    aria-label={`ページ ${i + 1} をおおきくひょうじ`}
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
          <div className="passage-body">
            <PassageRuby text={passage} />
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
              aria-label={
                questionsPanelExpanded
                  ? "もんだいパネルをしまう（よみこみをひろげる）"
                  : "もんだいパネルをひらく"
              }
            >
              {questionsPanelExpanded ? (
                <>
                  <span aria-hidden>⟨</span>
                  <span className="question-panel-toggle-label">しまう</span>
                </>
              ) : (
                <>
                  <span className="question-panel-toggle-collapsed-title">もんだい</span>
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
            <p className="q-prompt">もんだいがありません。スキャンをやりなおしてください。</p>
          ) : (
            <>
              <div className="q-meta">
                <span>
                  もんだい {qIdx + 1} / {questions.length}
                </span>
                <span className="muted" />
              </div>
              <p className="q-prompt">
                <RubyHtml html={q.prompt} />
              </p>

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
                      <strong>マイクには https がひつようです</strong>
                      <p>
                        いま <code>http://</code> なので録音できません。アプリのPCで次を実行し、表示された{" "}
                        <code>https://…ts.net</code> でひらきなおしてください。
                      </p>
                      <pre className="cmd-snippet">tailscale serve https / http://127.0.0.1:8787</pre>
                      <p className="muted">くわしくは README の「iPadでマイク（HTTPS）」</p>
                    </div>
                  )}
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
                          ? "マイク"
                          : deviceRecording
                            ? "録音ちゅう（はなすとおわる）"
                            : "マイクをおさえて録音"
                      }
                      disabled={voiceBusy || (needsHTTPSForMic && !deviceRecording)}
                      onClick={shouldUseBrowserSpeechRecognition() ? () => onMic() : undefined}
                      onPointerDown={shouldUseBrowserSpeechRecognition() ? undefined : onMicPointerDown}
                      onPointerUp={shouldUseBrowserSpeechRecognition() ? undefined : onMicPointerEnd}
                      onPointerCancel={shouldUseBrowserSpeechRecognition() ? undefined : onMicPointerEnd}
                      onContextMenu={shouldUseBrowserSpeechRecognition() ? undefined : (ev) => ev.preventDefault()}
                    >
                      🎤
                    </button>
                  </div>
                  <p className="muted">
                    {shouldUseBrowserSpeechRecognition()
                      ? "マイクをおす（ブラウザの音声入力）"
                      : deviceRecording
                        ? "指をはなすとおわります（さいちょう 10 びょう）"
                        : voiceBusy
                          ? "文字おこしちゅう…"
                          : "マイクをおさえっぱなしで録音、はなすとおわり（さいちょう 10 びょう）"}
                  </p>
                  {!shouldUseBrowserSpeechRecognition() && (
                    <p className="muted voice-hint-ios">
                      iPad/iPhone ではブラウザの音声入力がつかえないことが多いので、録音したあとサーバー（Gemini）が文字におこします。
                    </p>
                  )}
                  <p className="voice-text">
                    <RubyHtml html={answers[q.id] || ""} />
                  </p>
                </div>
              )}

              {scorable && (
                <div className="q-check-row">
                  <button
                    type="button"
                    className="btn btn-secondary btn-lg"
                    disabled={checkBusy}
                    onClick={() => void onCheckAnswer()}
                  >
                    {checkBusy ? "かくにんちゅう…" : "こたえをかくにん"}
                  </button>
                  {!check && <span className="muted">せいかいかどうと、コメントがでます</span>}
                </div>
              )}
              {scorable && (
                <div className="q-reveal-block">
                  {revealedSolutions[q.id] === undefined ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-lg q-reveal-btn"
                      disabled={revealBusy}
                      onClick={() => void onRevealSolution()}
                    >
                      {revealBusy ? "よみこみちゅう…" : "せいかいをみる"}
                    </button>
                  ) : (
                    <div className="q-reveal-panel" role="region" aria-label="せいかいの例">
                      <div className="q-reveal-head">
                        <span className="q-reveal-label">せいかいの例</span>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={hideRevealedSolution}>
                          かくす
                        </button>
                      </div>
                      <div className="q-reveal-body">
                        <RubyHtml html={revealedSolutions[q.id]} />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!scorable && <p className="muted q-scorable-skip">じどうさいてんのたいしょうがいです。つぎへすすんでOKです。</p>}
              {check && (
                <div
                  className={
                    "q-feedback" + (check.isCorrect ? " q-feedback-correct" : " q-feedback-wrong")
                  }
                  role="status"
                >
                  <strong>{check.isCorrect ? "せいかい" : "ざんねん"}</strong>
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
                  まえ
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  disabled={qIdx >= questions.length - 1}
                  onClick={() => setQIdx((i) => i + 1)}
                >
                  つぎ
                </button>
              </div>
              <button type="button" className="btn btn-primary btn-xl btn-block" onClick={onSubmit}>
                すべてのこたえをおくる
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
