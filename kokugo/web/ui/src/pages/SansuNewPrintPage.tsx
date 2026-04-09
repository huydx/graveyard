import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createSansuPrint } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import { isEnterWithoutIme } from "../lib/keyboard";
import { paths } from "../lib/paths";
import * as L from "../lib/uiLabelsRuby";

export default function SansuNewPrintPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const trimmed = title.trim();
  const canSave = trimmed.length > 0 && !busy;

  const onSave = async () => {
    if (!canSave) return;
    setBusy(true);
    setErr("");
    try {
      const { assignmentId } = await createSansuPrint({ title: trimmed });
      navigate(paths.sansu.scan(assignmentId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="view print-new">
      <nav className="print-breadcrumb muted">
        <Link to={paths.sansu.prints}>
          <RubyHtml html={L.backPrintList} />
        </Link>
      </nav>
      <div className="card print-new-card">
        <h2 className="prints-subhead">
          <RubyHtml html={L.sansuNewPrintHead} />
        </h2>
        <p className="muted print-new-lead">
          <RubyHtml html={L.sansuNewPrintLead} />
        </p>
        <div className="print-title-field">
          <label htmlFor="new-sansu-print-title" className="print-title-label">
            <RubyHtml html={L.sansuPrintNameLabel} />
          </label>
          <input
            id="new-sansu-print-title"
            type="text"
            className="print-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (!isEnterWithoutIme(e)) return;
              e.preventDefault();
              void onSave();
            }}
            placeholder="れい: 4がつさんすう"
            maxLength={200}
            disabled={busy}
            autoFocus
          />
        </div>
        {err ? <p className="status">{err}</p> : null}
        <div className="print-new-actions">
          <button type="button" className="btn btn-primary btn-xl" disabled={!canSave} onClick={() => void onSave()}>
            <RubyHtml html={busy ? L.newPrintSaving : L.sansuCreatePrint} />
          </button>
          <Link to={paths.sansu.prints} className="btn btn-ghost">
            <RubyHtml html={L.cancelJa} />
          </Link>
        </div>
      </div>
    </section>
  );
}
