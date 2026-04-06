import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPrint } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import { isEnterWithoutIme } from "../lib/keyboard";
import * as L from "../lib/uiLabelsRuby";

export default function NewPrintPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const trimmed = title.trim();
  const canSave = trimmed.length > 0 && !busy;

  const onSave = async () => {
    if (!canSave) return;
    setErr("");
    setBusy(true);
    try {
      const { assignmentId } = await createPrint({ title: trimmed });
      navigate(`/prints/${encodeURIComponent(assignmentId)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="view print-new">
      <nav className="print-breadcrumb muted">
        <Link to="/prints">
          <RubyHtml html={L.backPrintList} />
        </Link>
      </nav>

      <div className="card print-new-card">
        <h2 className="prints-subhead">
          <RubyHtml html={L.newPrintHead} />
        </h2>
        <p className="muted print-new-lead">
          <RubyHtml html={L.newPrintLead} />
        </p>

        <div className="print-title-field">
          <label htmlFor="new-print-title" className="print-title-label">
            <RubyHtml html={L.newPrintLabel} />
          </label>
          <input
            id="new-print-title"
            type="text"
            className="print-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (!isEnterWithoutIme(e)) return;
              e.preventDefault();
              void onSave();
            }}
            placeholder="例: 10がつ2しゅうのこくご"
            maxLength={200}
            disabled={busy}
            autoComplete="off"
            enterKeyHint="done"
            autoFocus
          />
        </div>

        {err ? <p className="status">{err}</p> : null}

        <div className="print-new-actions">
          <button type="button" className="btn btn-primary btn-xl" disabled={!canSave} onClick={() => void onSave()}>
            <RubyHtml html={busy ? L.newPrintSaving : L.newPrintSaveBtn} />
          </button>
          <Link to="/prints" className="btn btn-ghost">
            <RubyHtml html={L.cancelJa} />
          </Link>
        </div>
      </div>
    </section>
  );
}
