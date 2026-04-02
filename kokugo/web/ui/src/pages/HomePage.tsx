import { useNavigate, useOutletContext } from "react-router-dom";
import { useDraftExercise } from "../context/DraftExerciseContext";

export default function HomePage() {
  const { childName } = useOutletContext<{ childName: string }>();
  const navigate = useNavigate();
  const { beginNewScan } = useDraftExercise();

  const goScan = () => {
    beginNewScan();
    navigate("/scan");
  };

  return (
    <section className="view">
      <div className="hero card">
        <div className="hero-text">
          <p className="greeting">こんにちは、{childName}さん！</p>
          <p className="sub">じゃむのプリントをスキャンして、国語のれんしゅうをしよう。</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="btn btn-primary btn-xl" onClick={goScan}>
            プリントをスキャン →
          </button>
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h2>きょうのもくひょう</h2>
          <p className="muted">プリントを1まい、すいりょうしてみよう。</p>
          <div className="progress fake-progress">
            <span style={{ width: "40%" }} />
          </div>
        </div>
        <div className="card">
          <h2>つぎのばしょ</h2>
          <p className="muted">スキャンしたら「れんしゅうをはじめる」から続きへ。</p>
        </div>
      </div>
    </section>
  );
}
