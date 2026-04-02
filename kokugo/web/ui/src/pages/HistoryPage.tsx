import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listHistory } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import type { Exercise } from "../types";

export default function HistoryPage() {
  const [list, setList] = useState<Exercise[]>([]);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    listHistory()
      .then((d) => setList(d.exercises || []))
      .catch((e) => setErr(e instanceof Error ? e.message : "エラー"));
  }, []);

  const open = (ex: Exercise) => {
    if (ex.status === "completed") {
      navigate(`/result/${encodeURIComponent(ex.id)}`);
    } else {
      navigate(`/exercise/${encodeURIComponent(ex.id)}`);
    }
  };

  return (
    <section className="view">
      <div className="card">
        <h2>これまでのプリント</h2>
        {err && <p className="status">{err}</p>}
        {!list.length && !err ? <p className="muted">まだありません</p> : null}
        <ul className="history-list">
          {list.map((ex) => (
            <li key={ex.id} onClick={() => open(ex)} role="button" tabIndex={0}>
              <RubyHtml html={ex.title || "（むだい）"} /> — {ex.status}
              {typeof ex.scorePercent === "number" ? ` — ${ex.scorePercent}%` : ""}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
