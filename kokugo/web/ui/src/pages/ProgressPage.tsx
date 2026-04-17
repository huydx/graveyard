import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listHistory, listSansuHistory } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import { paths } from "../lib/paths";
import * as L from "../lib/uiLabelsRuby";

export default function ProgressPage() {
  const [kokugoN, setKokugoN] = useState<number | null>(null);
  const [sansuN, setSansuN] = useState<number | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    setErr("");
    Promise.all([listHistory(), listSansuHistory()])
      .then(([k, s]) => {
        if (cancelled) return;
        setKokugoN(k.assignments?.length ?? 0);
        setSansuN(s.assignments?.length ?? 0);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "エラー");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="view">
      <nav className="print-breadcrumb muted print-breadcrumb--multi">
        <Link to={paths.home}>
          <RubyHtml html={L.backHomeKid} />
        </Link>
        <span className="breadcrumb-sep" aria-hidden>
          ·
        </span>
        <Link to={paths.kokugo.prints}>
          <RubyHtml html={L.backPrintList} />
        </Link>
      </nav>
      <div className="card">
        <h2 className="prints-subhead">
          <RubyHtml html={L.progressPageTitle} />
        </h2>
        <p className="muted">
          <RubyHtml html={L.progressPageLead} />
        </p>
        {err ? <p className="status">{err}</p> : null}
        <ul className="progress-stats-list">
          <li>
            <Link to={paths.kokugo.prints} className="progress-stat-link">
              <span className="progress-stat-icon" aria-hidden>
                📚
              </span>
              <span>
                <RubyHtml html={L.brandTitle} />：{kokugoN === null ? "…" : <RubyHtml html={L.progressPrintCount(kokugoN)} />}
              </span>
            </Link>
          </li>
          <li>
            <Link to={paths.sansu.prints} className="progress-stat-link">
              <span className="progress-stat-icon" aria-hidden>
                🔢
              </span>
              <span>
                <RubyHtml html={L.sansuPageTitle} />：{sansuN === null ? "…" : <RubyHtml html={L.progressPrintCount(sansuN)} />}
              </span>
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
