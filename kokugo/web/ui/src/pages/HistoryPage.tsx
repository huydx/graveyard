import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteExercise, listHistory } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import type { Exercise } from "../types";

export default function HistoryPage() {
  const [list, setList] = useState<Exercise[]>([]);
  const [err, setErr] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  const remove = async (ex: Exercise) => {
    if (!window.confirm("このきろくを削除しますか？（もとに戻せません）")) return;
    setErr("");
    setDeletingId(ex.id);
    try {
      await deleteExercise(ex.id);
      setList((prev) => prev.filter((e) => e.id !== ex.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラー");
    } finally {
      setDeletingId(null);
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
            <li key={ex.id} className="history-row">
              <button type="button" className="history-row-main" onClick={() => open(ex)}>
                <RubyHtml html={ex.title || "（むだい）"} /> — {ex.status}
                {typeof ex.scorePercent === "number" ? ` — ${ex.scorePercent}%` : ""}
              </button>
              <button
                type="button"
                className="history-row-delete"
                aria-label="このきろくを削除"
                disabled={deletingId !== null}
                onClick={() => void remove(ex)}
              >
                {deletingId === ex.id ? "…" : "削除"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
