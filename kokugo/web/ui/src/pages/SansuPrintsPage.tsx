import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSansuHistory } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import { paths } from "../lib/paths";
import * as L from "../lib/uiLabelsRuby";
import type { AssignmentGroup } from "../types";

export default function SansuPrintsPage() {
  const [rows, setRows] = useState<AssignmentGroup[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    listSansuHistory()
      .then((d) => setRows(d.assignments || []))
      .catch((e) => setErr(e instanceof Error ? e.message : "エラー"));
  }, []);

  return (
    <section className="view">
      <div className="card prints-hero">
        <h2 className="prints-hero-title">
          <RubyHtml html={L.sansuPrintsHeroTitle} />
        </h2>
        <p className="muted prints-hero-lead">
          <RubyHtml html={L.sansuPrintsHeroLead} />
        </p>
        <div className="prints-hero-actions">
          <Link to={paths.sansu.printsNew} className="btn btn-primary btn-xl">
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
          <ul className="list">
            {rows.map((g) => (
              <li key={g.id} className="row">
                <Link to={paths.sansu.scan(g.id)} className="row-title">
                  {g.title?.trim() || "（むだい）"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
