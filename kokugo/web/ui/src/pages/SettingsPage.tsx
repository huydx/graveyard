import { useCallback, useEffect, useState } from "react";
import { getAppSettings, getHealth, getOllamaCheck, putAppSettings } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import * as L from "../lib/uiLabelsRuby";

const backendOptions = (
  <>
    <option value="">{L.settingsBackendOptEnvPlain}</option>
    <option value="gemini">{L.settingsBackendOptGeminiPlain}</option>
    <option value="ollama">{L.settingsBackendOptOllamaPlain}</option>
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
        <h2>
          <RubyHtml html={L.settingsHead} />
        </h2>
        <p className="muted small-gap">
          <RubyHtml html={L.settingsIntro} />
        </p>

        <div className="settings-field">
          <label htmlFor="ollama-url">
            <RubyHtml html={L.labelOllamaServer} />
          </label>
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
              <RubyHtml html={ollamaCheckLoading ? L.checkingBusy : L.btnConnectionCheck} />
            </button>
          </div>
          {ollamaListFetching ? (
            <p className="muted tiny-hint">
              <RubyHtml html={L.ollamaFetchingModels} />
            </p>
          ) : null}
          {envHint.url ? (
            <p className="muted tiny-hint">
              <RubyHtml html={L.envDefaultLabel} /> {envHint.url}
            </p>
          ) : null}
          {ollamaCheckDetail ? (
            <p className={ollamaCheckOk ? "ok-text tiny-hint" : "error-text tiny-hint"}>{ollamaCheckDetail}</p>
          ) : null}
        </div>

        <div className="settings-field">
          <label htmlFor="ollama-chat-model">
            <RubyHtml html={L.labelChatModel} />
          </label>
          <select
            id="ollama-chat-model"
            className="input-select"
            value={ollamaChatModel}
            onChange={(e) => setOllamaChatModel(e.target.value)}
          >
            <option value="">{L.settingsOptEnvOllamaPlain(envHint.ollamaChatModel || undefined)}</option>
            {ollamaModelsList.map((name) => (
              <option key={`chat-${name}`} value={name}>
                {name}
              </option>
            ))}
            {ollamaChatModel !== "" && !ollamaModelsList.includes(ollamaChatModel) ? (
              <option value={ollamaChatModel}>{L.settingsOptSavingPlain(ollamaChatModel)}</option>
            ) : null}
          </select>
          <p className="muted tiny-hint">
            <RubyHtml html={L.effectiveModelHint} />{" "}
            {effectiveOllamaChat ? effectiveOllamaChat : <RubyHtml html={L.unsetParen} />}
            <RubyHtml html={L.openOllamaListHint} />
          </p>
        </div>

        <div className="settings-field">
          <label htmlFor="summary-backend">
            <RubyHtml html={L.labelSummaryBackend} />
          </label>
          <select
            id="summary-backend"
            className="input-select"
            value={summaryChatBackend}
            onChange={(e) => setSummaryChatBackend(e.target.value)}
          >
            {backendOptions}
          </select>
          <p className="muted tiny-hint">
            <RubyHtml html={L.effectiveValueHint} /> {effectiveSummary}
            <RubyHtml html={L.transcribeGeminiOnly} />
          </p>
          {envHint.summary ? (
            <p className="muted tiny-hint">環境: KOKUGO_CHAT_BACKEND_SUMMARY / KOKUGO_CHAT_BACKEND: {envHint.summary}</p>
          ) : null}
        </div>

        <div className="settings-field">
          <label htmlFor="judge-backend">
            <RubyHtml html={L.labelJudgeBackend} />
          </label>
          <select
            id="judge-backend"
            className="input-select"
            value={judgeChatBackend}
            onChange={(e) => setJudgeChatBackend(e.target.value)}
          >
            {backendOptions}
          </select>
          <p className="muted tiny-hint">
            <RubyHtml html={L.effectiveValueHint} /> {effectiveJudge}
          </p>
          {envHint.judge ? (
            <p className="muted tiny-hint">環境: KOKUGO_CHAT_BACKEND_JUDGE / KOKUGO_CHAT_BACKEND: {envHint.judge}</p>
          ) : null}
        </div>

        <div className="settings-field">
          <label htmlFor="gemini-key">
            <RubyHtml html={L.labelGeminiKey} />
          </label>
          <input
            id="gemini-key"
            type="password"
            className="input-select"
            autoComplete="off"
            placeholder={hasGeminiKey ? L.placeholderKeySavedPlain : L.placeholderKeyNeededPlain}
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
            <RubyHtml html={L.clearSavedKey} />
          </label>
          <p className="muted tiny-hint">
            {hasGeminiKey ? (
              <RubyHtml html={L.dbHasKey} />
            ) : (
              <RubyHtml html={L.dbNoKey} />
            )}
            {geminiKeyEffective ? <RubyHtml html={L.geminiKeyAvailable} /> : <RubyHtml html={L.geminiKeyMissing} />}
          </p>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="settings-actions">
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={status === "saving"}>
            <RubyHtml html={status === "saving" ? L.newPrintSaving : L.saveApply} />
          </button>
          {status === "saved" ? (
            <span className="ok-text">
              <RubyHtml html={L.savedOk} />
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
