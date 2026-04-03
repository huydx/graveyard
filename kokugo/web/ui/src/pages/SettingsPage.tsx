import { useCallback, useEffect, useState } from "react";
import { getAppSettings, getHealth, putAppSettings } from "../api/client";

const backendOptions = (
  <>
    <option value="">環境変数の既定（個別変数 → KOKUGO_CHAT_BACKEND、未設定時は gemini）</option>
    <option value="gemini">gemini（要 API キー：DB または環境変数）</option>
    <option value="ollama">ollama（OLLAMA_CHAT_MODEL / OLLAMA_MODEL）</option>
  </>
);

export default function SettingsPage() {
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("");
  const [parseStrategy, setParseStrategy] = useState("three_step");
  const [summaryChatBackend, setSummaryChatBackend] = useState("");
  const [judgeChatBackend, setJudgeChatBackend] = useState("");
  const [rubyBackend, setRubyBackend] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [clearGeminiKey, setClearGeminiKey] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [geminiKeyEffective, setGeminiKeyEffective] = useState(false);
  const [envHint, setEnvHint] = useState({ url: "", parse: "", summary: "", judge: "", ruby: "" });
  const [effectiveParse, setEffectiveParse] = useState("");
  const [effectiveSummary, setEffectiveSummary] = useState("");
  const [effectiveJudge, setEffectiveJudge] = useState("");
  const [effectiveRuby, setEffectiveRuby] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const s = await getAppSettings();
      setOllamaBaseUrl(s.ollamaBaseUrl ?? "");
      setParseStrategy(s.parseStrategy ?? "");
      setSummaryChatBackend(s.summaryChatBackend ?? "");
      setJudgeChatBackend(s.judgeChatBackend ?? "");
      setRubyBackend(s.rubyBackend ?? "");
      setHasGeminiKey(s.hasGeminiKey);
      setGeminiKeyEffective(s.geminiKeyEffective);
      setEnvHint({
        url: s.envOllamaBaseUrl || "",
        parse: s.envParseStrategy || "",
        summary: s.envSummaryChatBackend || "",
        judge: s.envJudgeChatBackend || "",
        ruby: s.envRubyBackend || "",
      });
      setEffectiveParse(s.parseStrategyEffective || "three_step");
      setEffectiveSummary(s.summaryChatBackendEffective || "gemini");
      setEffectiveJudge(s.judgeChatBackendEffective || "gemini");
      setEffectiveRuby(s.rubyBackendEffective || "gemini");
      setGeminiKey("");
      setClearGeminiKey(false);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setStatus("saving");
    setError(null);
    try {
      await putAppSettings({
        ollamaBaseUrl,
        parseStrategy,
        summaryChatBackend,
        judgeChatBackend,
        rubyBackend,
        ...(clearGeminiKey ? { clearGoogleApiKey: true } : {}),
        ...(!clearGeminiKey && geminiKey.trim() !== "" ? { googleApiKey: geminiKey.trim() } : {}),
      });
      await load();
      await getHealth();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗");
      setStatus("error");
    }
  };

  return (
    <section className="view">
      <div className="card settings-card">
        <h2>せってい（このパソコンに保存）</h2>
        <p className="muted small-gap">
          Ollama のアドレス・まとめ・採点・ふりがな（ruby）に Gemini か Ollama を別々に選べます。プリントの読み方・Gemini
          キーもここでかえられます。データベースに値がないときは環境変数にフォールバックします（Gemini
          キーも同じで、DB が空なら GOOGLE_API_KEY を使います）。
        </p>

        <div className="settings-field">
          <label htmlFor="ollama-url">Ollama サーバー（URL）</label>
          <input
            id="ollama-url"
            type="url"
            className="input-select"
            autoComplete="off"
            placeholder={envHint.url || "例: http://127.0.0.1:11434"}
            value={ollamaBaseUrl}
            onChange={(e) => setOllamaBaseUrl(e.target.value)}
          />
          {envHint.url ? (
            <p className="muted tiny-hint">環境変数の既定: {envHint.url}</p>
          ) : null}
        </div>

        <div className="settings-field">
          <label htmlFor="summary-backend">まとめ・音声の文字おこし</label>
          <select
            id="summary-backend"
            className="input-select"
            value={summaryChatBackend}
            onChange={(e) => setSummaryChatBackend(e.target.value)}
          >
            {backendOptions}
          </select>
          <p className="muted tiny-hint">いまの有効値: {effectiveSummary}（文字おこしは Gemini のときだけ可）</p>
          {envHint.summary ? (
            <p className="muted tiny-hint">環境: KOKUGO_CHAT_BACKEND_SUMMARY / KOKUGO_CHAT_BACKEND: {envHint.summary}</p>
          ) : null}
        </div>

        <div className="settings-field">
          <label htmlFor="judge-backend">解答の採点</label>
          <select
            id="judge-backend"
            className="input-select"
            value={judgeChatBackend}
            onChange={(e) => setJudgeChatBackend(e.target.value)}
          >
            {backendOptions}
          </select>
          <p className="muted tiny-hint">いまの有効値: {effectiveJudge}</p>
          {envHint.judge ? (
            <p className="muted tiny-hint">環境: KOKUGO_CHAT_BACKEND_JUDGE / KOKUGO_CHAT_BACKEND: {envHint.judge}</p>
          ) : null}
        </div>

        <div className="settings-field">
          <label htmlFor="ruby-backend">ふりがな JSON（three_step の最終ステップ）</label>
          <select
            id="ruby-backend"
            className="input-select"
            value={rubyBackend}
            onChange={(e) => setRubyBackend(e.target.value)}
          >
            {backendOptions}
          </select>
          <p className="muted tiny-hint">いまの有効値: {effectiveRuby}（one_shot では使いません）</p>
          {envHint.ruby ? (
            <p className="muted tiny-hint">環境: KOKUGO_RUBY_BACKEND / KOKUGO_CHAT_BACKEND: {envHint.ruby}</p>
          ) : null}
        </div>

        <div className="settings-field">
          <label htmlFor="parse-strategy">プリントの読み方（parse strategy）</label>
          <select
            id="parse-strategy"
            className="input-select"
            value={parseStrategy}
            onChange={(e) => setParseStrategy(e.target.value)}
          >
            <option value="">環境変数の既定をつかう</option>
            <option value="three_step">three_step（OCR → JSON → ふりがな）</option>
            <option value="one_shot">one_shot（1回で JSON）</option>
          </select>
          <p className="muted tiny-hint">いまの有効値: {effectiveParse}</p>
        </div>

        <div className="settings-field">
          <label htmlFor="gemini-key">Google Gemini API キー</label>
          <input
            id="gemini-key"
            type="password"
            className="input-select"
            autoComplete="off"
            placeholder={hasGeminiKey ? "（保存済み・あたらしいキーで上書き）" : "AIまわりに必要なとき"}
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            disabled={clearGeminiKey}
          />
          <label className="settings-check">
            <input
              type="checkbox"
              checked={clearGeminiKey}
              onChange={(e) => setClearGeminiKey(e.target.checked)}
            />
            保存したキーを消す（環境変数のキーに戻す）
          </label>
          <p className="muted tiny-hint">
            {hasGeminiKey
              ? "データベースにキーが保存されています（内容は表示しません）。"
              : "データベースにはキーがありません（空なら環境変数 GOOGLE_API_KEY を使います）。"}
            {geminiKeyEffective
              ? " いまの設定では Gemini 用のキーが利用可能です。"
              : " いまの設定では Gemini 用のキーがありません。"}
          </p>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="settings-actions">
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={status === "saving"}>
            {status === "saving" ? "ほぞんちゅう…" : "ほぞんして反映"}
          </button>
          {status === "saved" ? <span className="ok-text">✓ 反映しました</span> : null}
        </div>
      </div>
    </section>
  );
}
