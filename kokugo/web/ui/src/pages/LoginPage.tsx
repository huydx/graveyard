import { FormEvent, useEffect, useId, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAuthMe, postLogin } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import { paths } from "../lib/paths";
import * as L from "../lib/uiLabelsRuby";

export default function LoginPage() {
  const emailId = useId();
  const passwordId = useId();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const nextParam = params.get("next");

  useEffect(() => {
    let cancelled = false;
    getAuthMe()
      .then(() => {
        if (cancelled) return;
        if (nextParam && nextParam.startsWith("/")) {
          navigate(nextParam, { replace: true });
        } else {
          navigate(paths.home, { replace: true });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [navigate, nextParam]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await postLogin(email.trim(), password);
      const next = params.get("next");
      if (next && next.startsWith("/")) {
        navigate(next, { replace: true });
      } else {
        navigate(paths.home, { replace: true });
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "エラー");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="login-shell" aria-labelledby={emailId + "-heading"}>
      <div className="login-stack">
        <div className="card login-card">
          <h1 id={emailId + "-heading"} className="login-title">
            <RubyHtml html={L.loginTitle} />
          </h1>
          <p className="login-lead muted">
            <RubyHtml html={L.loginLead} />
          </p>
          <form onSubmit={(ev) => void onSubmit(ev)} className="login-form">
            <div className="login-field">
              <label htmlFor={emailId} className="login-label">
                <RubyHtml html={L.loginEmailLabel} />
              </label>
              <input
                id={emailId}
                type="email"
                autoComplete="username"
                inputMode="email"
                className="login-input"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
              />
            </div>
            <div className="login-field">
              <label htmlFor={passwordId} className="login-label">
                <RubyHtml html={L.loginPasswordLabel} />
              </label>
              <input
                id={passwordId}
                type="password"
                autoComplete="current-password"
                className="login-input"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                required
              />
            </div>
            {err ? (
              <p className="status bad login-error" role="alert">
                {err}
              </p>
            ) : null}
            <button type="submit" className="btn btn-primary btn-block btn-lg login-submit" disabled={busy}>
              {busy ? "…" : <RubyHtml html={L.loginSubmit} />}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
