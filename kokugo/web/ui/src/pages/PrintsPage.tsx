import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listHistory } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import { customPrintTitle, exerciseTitleFallbackHtml, isOnlyBareEmptyPrint } from "../lib/printTitle";
import * as L from "../lib/uiLabelsRuby";
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

function printStatusLineHtml(a: AssignmentGroup): string {
  if (isOnlyBareEmptyPrint(a)) return L.statusNotScannedYet;
  const n = a.exercises.length;
  const draft = a.exercises.filter((e) => e.status === "draft").length;
  const done = a.exercises.filter((e) => e.status === "completed").length;
  if (draft === n && n > 0) return L.statusBeforeParse;
  if (done === n) return L.statusAllDone;
  if (done > 0) return `<ruby>練習<rt>れんしゅう</rt></ruby> ${done}/${n} <ruby>終<rt>お</rt></ruby>わり`;
  return `${n} <ruby>大問<rt>だい</rt></ruby>`;
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
        <h2>
          <RubyHtml html={L.printsHeroTitle} />
        </h2>
        <p className="muted">
          <RubyHtml html={L.printsHeroLead} />
        </p>
        <div className="prints-hero-actions">
          <Link to="/prints/new" className="btn btn-primary btn-xl prints-link-btn">
            <RubyHtml html={L.printsNewCta} />
          </Link>
        </div>
      </div>

      <div className="card">
        <h3 className="prints-subhead">
          <RubyHtml html={L.printsPastHead} />
        </h3>
        {err && <p className="status">{err}</p>}
        {!assignments.length && !err ? (
          <p className="muted">
            <RubyHtml html={L.printsEmpty} />
          </p>
        ) : null}
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
                    {formatWhen(a.createdAt)} · <RubyHtml html={printStatusLineHtml(a)} />
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
