import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSansuHistory } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import { isOnlyBareEmptyPrint, kidFriendlyPrintTitle, sortAssignmentsNewestFirst } from "../lib/printTitle";
import { paths } from "../lib/paths";
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

function sansuStatusLineHtml(a: AssignmentGroup): string {
  if (isOnlyBareEmptyPrint(a)) return L.statusNotScannedYet;
  const n = a.exercises.length;
  const draft = a.exercises.filter((e) => e.status === "draft").length;
  const done = a.exercises.filter((e) => e.status === "completed").length;
  if (draft === n && n > 0) return L.statusBeforeParse;
  if (done === n) return L.statusAllDone;
  if (done > 0) return `<ruby>練習<rt>れんしゅう</rt></ruby> ${done}/${n} <ruby>終<rt>お</rt></ruby>わり`;
  return `${n} <ruby>大問<rt>だい</rt></ruby>`;
}

export default function SansuPrintsPage() {
  const [rows, setRows] = useState<AssignmentGroup[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    listSansuHistory()
      .then((d) => setRows(d.assignments || []))
      .catch((e) => setErr(e instanceof Error ? e.message : "エラー"));
  }, []);

  const sorted = sortAssignmentsNewestFirst(rows);

  return (
    <section className="view">
      <div className="card prints-hero">
        <h2 className="prints-hero-title">
          <RubyHtml html={L.sansuPrintsHeroTitle} />
        </h2>
        <p className="muted prints-hero-lead">
          <RubyHtml html={L.sansuPrintsHeroLead} />
        </p>
        <p className="sansu-main-banner muted">
          <RubyHtml html={L.sansuSidebarHint} />
        </p>
        <div className="prints-hero-actions">
          <Link to={paths.sansu.printsNew} className="btn btn-primary btn-xl prints-link-btn">
            <RubyHtml html={L.sansuNewPrintCta} />
          </Link>
        </div>
      </div>
      <div className="card">
        <h3 className="prints-subhead">
          <RubyHtml html={L.sansuPastPrintsHead} />
        </h3>
        {err ? <p className="status">{err}</p> : null}
        {!rows.length ? (
          <p className="muted">
            <RubyHtml html={L.printsEmpty} />
          </p>
        ) : (
          <ul className="print-card-list">
            {sorted.map((g, i) => {
              const serial = i + 1;
              const title = kidFriendlyPrintTitle(g.createdAt, "sansu", serial);
              return (
                <li key={g.id}>
                  <Link to={paths.sansu.scan(g.id)} className="print-card-link">
                    <span className="print-card-icon" aria-hidden>
                      🔢
                    </span>
                    <div className="print-card-body">
                      <span className="print-card-title">{title}</span>
                      <span className="muted print-card-meta">
                        {formatWhen(g.createdAt)} · <RubyHtml html={sansuStatusLineHtml(g)} />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
