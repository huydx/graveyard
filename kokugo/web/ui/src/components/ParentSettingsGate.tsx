import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import RubyHtml from "./RubyHtml";
import { paths } from "../lib/paths";
import * as L from "../lib/uiLabelsRuby";

const SS_KEY = "kokugo_parent_unlock";
const LONGPRESS_MS = 2000;

function expectedPin(): string {
  const v = import.meta.env.VITE_PARENT_PIN;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : "0000";
}

export default function ParentSettingsGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(() =>
    typeof sessionStorage !== "undefined" && sessionStorage.getItem(SS_KEY) === "1",
  );
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unlock = useCallback(() => {
    try {
      sessionStorage.setItem(SS_KEY, "1");
    } catch {
      /* ignore */
    }
    setOk(true);
    setErr("");
  }, []);

  const onPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim() === expectedPin()) {
      unlock();
      setPin("");
    } else {
      setErr("PINがちがいます");
    }
  };

  const startLongPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      unlock();
      pressTimer.current = null;
    }, LONGPRESS_MS);
  };

  const endLongPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  if (ok) return <>{children}</>;

  return (
    <section className="view">
      <div className="card parent-gate-card">
        <h2>
          <RubyHtml html={L.parentGateTitle} />
        </h2>
        <p className="muted">
          <RubyHtml html={L.parentGateLead} />
        </p>
        <p className="muted parent-gate-key-hint">
          <RubyHtml html={L.parentGateKeyHint} />
        </p>
        <form onSubmit={onPinSubmit} className="parent-gate-form">
          <input
            type="password"
            inputMode="numeric"
            className="print-title-input parent-gate-pin"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            autoComplete="off"
            aria-label="PIN"
          />
          <button type="submit" className="btn btn-primary">
            ひらく
          </button>
        </form>
        {err ? <p className="status">{err}</p> : null}
        <p className="muted small-gap">
          <RubyHtml html={L.parentGateLongPress} />
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-block parent-gate-longpress"
          onMouseDown={startLongPress}
          onMouseUp={endLongPress}
          onMouseLeave={endLongPress}
          onTouchStart={startLongPress}
          onTouchEnd={endLongPress}
        >
          2びょう おさえわ（おうちの<ruby>人<rt>ひと</rt></ruby>）
        </button>
        <p className="muted tiny-hint">PINをしらないおうちの<ruby>人<rt>ひと</rt></ruby>がつかいます。</p>
        <Link to={paths.kokugo.prints} className="sidebar-hub-link parent-gate-back">
          <RubyHtml html={L.parentGateBack} />
        </Link>
      </div>
    </section>
  );
}
