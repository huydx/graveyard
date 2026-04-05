import { useCallback, useEffect, useState } from "react";
import { getAppSettings, getHealth, getOllamaCheck, putAppSettings } from "../api/client";

const backendOptions = (
  <>
    <option value="">環境変数の既定（個別変数 → KOKUGO_CHAT_BACKEND、未設定時は gemini）</option>
    <option value="gemini">gemini（要 API キー：DB または環境変数）</option>
    <option value="ollama">ollama（OLLAMA_CHAT_MODEL / OLLAMA_MODEL）</option>
  </>
);

function sortedModelNames(models: string[]): string[] {
  return [...models].sort((a, b) => a.localeCompare(b));
}

export default function SettingsPage() {
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("");
  const [ollamaChatModel, setOllamaChatModel] = useState("");
  const [ollamaModelsList, setOllamaModelsList] = useState<string[]>([]);
  const [ollamaListFetching, setOllamaListFetching] = useState(false);
  const [ollamaCheckLoading, setOllamaCheckLoading] = useState(false);
  const [ollamaCheckOk, setOllamaCheckOk] = useState<boolean | null>(null);
  const [ollamaCheckDetail, setOllamaCheckDetail] = useState<string | null>(null);
  const [summaryChatBackend, setSummaryChatBackend] = useState("");
  const [judgeChatBackend, setJudgeChatBackend] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [clearGeminiKey, setClearGeminiKey] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [geminiKeyEffective, setGeminiKeyEffective] = useState(false);
  const [envHint, setEnvHint] = useState({
    url: "",
    ollamaChatModel: "",
    summary: "",
    judge: "",
  });
  const [effectiveSummary, setEffectiveSummary] = useState("");
  const [effectiveJudge, setEffectiveJudge] = useState("");
  const [effectiveOllamaChat, setEffectiveOllamaChat] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  /** Fetches installed model names from Ollama (server: GET …/api/tags). */
  const refreshOllamaModels = useCallback(async (url?: string, opts?: { userInitiated?: boolean }) => {
    const user = opts?.userInitiated ?? false;
    if (user) {
      setOllamaCheckLoading(true);
      setOllamaCheckDetail(null);
      setOllamaCheckOk(null);
    } else {
      setOllamaListFetching(true);
    }
    try {
      const res = await getOllamaCheck(url);
      if (!res.ok) {
        setOllamaCheckOk(false);
        setOllamaModelsList([]);
        const msg = res.message ?? "接続に失敗しました";
        setOllamaCheckDetail(user ? msg : `モデル一覧を取得できませんでした（${msg}）`);
        return;
      }
      setOllamaCheckOk(true);
      setOllamaModelsList(sortedModelNames(res.models ?? []));
      if (user) {
        setOllamaCheckDetail(
          res.baseUrl ? `接続 OK（${res.models?.length ?? 0} 件のモデル） — ${res.baseUrl}` : "接続 OK"
        );
      } else {
        setOllamaCheckDetail(null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "接続に失敗しました";
      setOllamaCheckOk(false);
      setOllamaModelsList([]);
      setOllamaCheckDetail(user ? msg : `モデル一覧を取得できませんでした（${msg}）`);
    } finally {
      if (user) {
        setOllamaCheckLoading(false);
      } else {
        setOllamaListFetching(false);
      }
    }
  }, []);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const s = await getAppSettings();
      setOllamaBaseUrl(s.ollamaBaseUrl ?? "");
      setOllamaChatModel(s.ollamaChatModel ?? "");
      setSummaryChatBackend(s.summaryChatBackend ?? "");
      setJudgeChatBackend(s.judgeChatBackend ?? "");
      setHasGeminiKey(s.hasGeminiKey);
      setGeminiKeyEffective(s.geminiKeyEffective);
      setEnvHint({
        url: s.envOllamaBaseUrl || "",
        ollamaChatModel: s.envOllamaChatModel || "",
        summary: s.envSummaryChatBackend || "",
        judge: s.envJudgeChatBackend || "",
      });
      setEffectiveSummary(s.summaryChatBackendEffective || "gemini");
      setEffectiveJudge(s.judgeChatBackendEffective || "gemini");
      setEffectiveOllamaChat(s.ollamaChatModelEffective ?? "");
      setGeminiKey("");
      setClearGeminiKey(false);
      setStatus("idle");
      const probeUrl = (s.ollamaBaseUrl ?? "").trim() || undefined;
      void refreshOllamaModels(probeUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗");
      setStatus("error");
    }
  }, [refreshOllamaModels]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setStatus("saving");
    setError(null);
    try {
      await putAppSettings({
        ollamaBaseUrl,
        ollamaChatModel,
        summaryChatBackend,
        judgeChatBackend,
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

  const checkOllama = () =>
    void refreshOllamaModels(ollamaBaseUrl.trim() || undefined, { userInitiated: true });

  return (
    <section className="view">
      <div className="card settings-card">
        <h2>せってい（このパソコンに保存）</h2>
        <p className="muted small-gap">
          プリントの読み取りは <strong>Gemini 3</strong>（環境変数 <code>GEMINI_MODEL</code>、既定{" "}
          <code>gemini-3-flash-preview</code>）のワンショット解析のみです。まとめ・採点は Gemini か Ollama
          を別々に選べます。API キーはここか <code>GOOGLE_API_KEY</code> で指定します（DB
          に値があるときはそちらが優先）。
        </p>

        <div className="settings-field">
          <label htmlFor="ollama-url">Ollama サーバー（URL）</label>
          <div className="settings-inline-row">
            <input
              id="ollama-url"
              type="url"
              className="input-select"
              autoComplete="off"
              placeholder={envHint.url || "例: http://127.0.0.1:11434"}
              value={ollamaBaseUrl}
              onChange={(e) => setOllamaBaseUrl(e.target.value)}
            />
            <button
              type="button"
              className="btn"
              onClick={checkOllama}
              disabled={ollamaCheckLoading || ollamaListFetching}
            >
              {ollamaCheckLoading ? "確認中…" : "接続確認"}
            </button>
          </div>
          {ollamaListFetching ? (
            <p className="muted tiny-hint">Ollama（/api/tags）からモデル一覧を取得しています…</p>
          ) : null}
          {envHint.url ? (
            <p className="muted tiny-hint">環境変数の既定: {envHint.url}</p>
          ) : null}
          {ollamaCheckDetail ? (
            <p className={ollamaCheckOk ? "ok-text tiny-hint" : "error-text tiny-hint"}>{ollamaCheckDetail}</p>
          ) : null}
        </div>

        <div className="settings-field">
          <label htmlFor="ollama-chat-model">チャット用モデル（まとめ・採点で ollama を選んだとき）</label>
          <select
            id="ollama-chat-model"
            className="input-select"
            value={ollamaChatModel}
            onChange={(e) => setOllamaChatModel(e.target.value)}
          >
            <option value="">
              環境変数の既定（OLLAMA_CHAT_MODEL → OLLAMA_MODEL
              {envHint.ollamaChatModel ? ` — いまは ${envHint.ollamaChatModel}` : ""}）
            </option>
            {ollamaModelsList.map((name) => (
              <option key={`chat-${name}`} value={name}>
                {name}
              </option>
            ))}
            {ollamaChatModel !== "" && !ollamaModelsList.includes(ollamaChatModel) ? (
              <option value={ollamaChatModel}>{ollamaChatModel}（保存中・一覧に未反映）</option>
            ) : null}
          </select>
          <p className="muted tiny-hint">
            いまの有効モデル名: {effectiveOllamaChat || "（未設定）"}
            。開いたときに Ollama から一覧を取ります。URL を変えたあとは「接続確認」で取り直せます。
          </p>
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
          <label htmlFor="gemini-key">Google Gemini API キー</label>
          <input
            id="gemini-key"
            type="password"
            className="input-select"
            autoComplete="off"
            placeholder={hasGeminiKey ? "（保存済み・あたらしいキーで上書き）" : "プリント読み取り・Gemini 利用に必要"}
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
