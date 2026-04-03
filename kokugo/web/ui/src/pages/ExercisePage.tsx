import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { checkQuestionAnswer, getExercise, submitAnswers, transcribeAudio } from "../api/client";
import {
  createJaSpeechRecognition,
  shouldUseBrowserSpeechRecognition,
} from "../hooks/createJaSpeechRecognition";
import { useMediaRecorderAnswer } from "../hooks/useMediaRecorderAnswer";
import ScanImageModal from "../components/ScanImageModal";
import RubyHtml, { PassageRuby } from "../components/RubyHtml";
import { furiganaToSpeechText } from "../lib/ruby";
import type { Question, QuestionCheckResult } from "../types";

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
  const [checks, setChecks] = useState<Record<string, QuestionCheckResult>>({});
  const [loadErr, setLoadErr] = useState("");
  const [scanPageCount, setScanPageCount] = useState(0);
  const [scanModalIndex, setScanModalIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    getExercise(id)
      .then((d) => {
        setTitle(d.exercise.title || "（だいもくなし）");
        setPassage(d.exercise.passage || "");
        setQuestions(d.questions || []);
        setAnswers({});
        setChecks({});
        setQIdx(0);
        const n = d.exercise.imagePaths?.length ?? (d.exercise.imagePath ? 1 : 0);
        setScanPageCount(n);
      })
      .catch((e) => setLoadErr(e instanceof Error ? e.message : "エラー"));
  }, [id]);

  useEffect(() => {
    cancelRecording();
    setDeviceRecording(false);
    setListening(false);
  }, [qIdx, cancelRecording]);

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

  const onMic = async () => {
    if (!q || q.type !== "voice") return;

    if (shouldUseBrowserSpeechRecognition()) {
      startWebSpeech();
      return;
    }

    if (deviceRecording) {
      setVoiceBusy(true);
      try {
        const { blob, mime } = await stopRecording();
        const { text } = await transcribeAudio(blob, mime);
        setAnswer(q.id, text.trim());
      } catch (e) {
        alert(e instanceof Error ? e.message : "文字おこしに失敗しました");
      } finally {
        setVoiceBusy(false);
        setDeviceRecording(false);
      }
      return;
    }

    try {
      await startRecording();
      setDeviceRecording(true);
    } catch {
      alert(
        "マイクをつかえません。https:// または localhost でひらいているか、iPadの「設定」→「プライバシー」でマイクをきょかしてください。"
      );
    }
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

  const onSubmit = async () => {
    if (!id) return;
    const pending = questions.filter((qq) => needsCheck(qq) && !checks[qq.id]);
    if (pending.length > 0) {
      alert("まだ「こたえをかくにん」していないもんだいがあります。1もんずつかくにんしてからおくってください。");
      return;
    }
    try {
      const res = await submitAnswers(id, answers);
      navigate(`/result/${encodeURIComponent(id)}`, { state: { result: res } });
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラー");
    }
  };

  const micActive = listening || deviceRecording || voiceBusy;
  const check = q ? checks[q.id] : undefined;
  const scorable = q && needsCheck(q);
  const canGoNext = !q || !scorable || Boolean(check);

  if (loadErr) {
    return (
      <div className="card">
        <p className="status">{loadErr}</p>
      </div>
    );
  }

  return (
    <section className="view">
      <div className="exercise-layout">
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

        <article className="card question-panel">
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
                  <button
                    type="button"
                    className={"mic-btn" + (micActive ? " listening" : "")}
                    aria-label="マイク"
                    disabled={voiceBusy || (needsHTTPSForMic && !deviceRecording)}
                    onClick={() => void onMic()}
                  >
                    🎤
                  </button>
                  <p className="muted">
                    {shouldUseBrowserSpeechRecognition()
                      ? "マイクをおす（ブラウザの音声入力）"
                      : deviceRecording
                        ? "もういちどおすとおわって、サーバーが文字におこします"
                        : voiceBusy
                          ? "文字おこしちゅう…"
                          : "マイクをおすと録音はじまります（もういちどおすとおわり）"}
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
                  disabled={qIdx >= questions.length - 1 || !canGoNext}
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
