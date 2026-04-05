import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listHistory } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import { customPrintTitle, exerciseTitleFallbackHtml, isOnlyBareEmptyPrint } from "../lib/printTitle";
import type { AssignmentGroup } from "../types";

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function printStatusLine(a: AssignmentGroup): string {
  if (isOnlyBareEmptyPrint(a)) return "まだスキャンしていません";
  const n = a.exercises.length;
  const draft = a.exercises.filter((e) => e.status === "draft").length;
  const done = a.exercises.filter((e) => e.status === "completed").length;
  if (draft === n && n > 0) return "スキャン・よみとりまえ";
  if (done === n) return "すべておわり";
  if (done > 0) return `れんしゅう ${done}/${n} おわり`;
  return `${n} だい`;
}

export default function PrintsPage() {
  const [assignments, setAssignments] = useState<AssignmentGroup[]>([]);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    return listHistory()
      .then((d) => setAssignments(d.assignments || []))
      .catch((e) => setErr(e instanceof Error ? e.message : "エラー"));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="view">
      <div className="card prints-hero">
        <h2>プリント</h2>
        <p className="muted">いちらんからひらくか、なまえをつけてあたらしいプリントをほぞんしてください。</p>
        <div className="prints-hero-actions">
          <Link to="/prints/new" className="btn btn-primary btn-xl prints-link-btn">
            あたらしいプリントをつくる
          </Link>
        </div>
      </div>

      <div className="card">
        <h3 className="prints-subhead">いままでのプリント</h3>
        {err && <p className="status">{err}</p>}
        {!assignments.length && !err ? <p className="muted">まだありません</p> : null}
        <ul className="print-index-list">
          {assignments.map((a) => {
            const custom = customPrintTitle(a);
            return (
              <li key={a.id}>
                <Link to={`/prints/${encodeURIComponent(a.id)}`} className="print-index-row">
                  <span className="print-index-title">
                    {custom ? custom : <RubyHtml html={exerciseTitleFallbackHtml(a)} />}
                  </span>
                  <span className="muted print-index-meta">
                    {formatWhen(a.createdAt)} · {printStatusLine(a)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
