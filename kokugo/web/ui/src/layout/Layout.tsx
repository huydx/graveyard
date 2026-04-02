import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { getHealth } from "../api/client";
import { useDraftExercise } from "../context/DraftExerciseContext";

const routeTitles: { prefix: string; title: string }[] = [
  { prefix: "/exercise/", title: "れんしゅう" },
  { prefix: "/result/", title: "けっか" },
  { prefix: "/scan", title: "スキャン" },
  { prefix: "/history", title: "きろく" },
  { prefix: "/remind", title: "まいつきおさらい" },
  { prefix: "/", title: "ホーム" },
];

function titleForPath(pathname: string): string {
  for (const { prefix, title } of routeTitles) {
    if (prefix === "/" && pathname === "/") return title;
    if (prefix !== "/" && pathname.startsWith(prefix)) return title;
  }
  return "こくごアトリエ";
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { draftExerciseId, beginNewScan } = useDraftExercise();
  const [badge, setBadge] = useState("AI: せつぞくまち");
  const [geminiOk, setGeminiOk] = useState(false);
  const [childName, setChildName] = useState("がくせい");

  useEffect(() => {
    getHealth()
      .then((h) => {
        if (h.geminiConnected) {
          setBadge("Sensei AI: せつぞくOK");
          setGeminiOk(true);
        } else {
          setBadge("AI: キーをせっていしてね");
          setGeminiOk(false);
        }
        if (h.childName) setChildName(h.childName);
      })
      .catch(() => {
        setBadge("API: つづかない");
        setGeminiOk(false);
      });
  }, []);

  const startLesson = () => {
    navigate(draftExerciseId ? `/exercise/${encodeURIComponent(draftExerciseId)}` : "/scan");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">こくごアトリエ</div>
        <div className="profile">
          <div className="avatar" aria-hidden="true">
            🐦
          </div>
          <div className="profile-text">
            <span>{childName}</span>
            <small>がんばっているよ</small>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => "nav-btn" + (isActive ? " active" : "")}>
            ホーム
          </NavLink>
          <NavLink
            to="/scan"
            className={({ isActive }) => "nav-btn" + (isActive ? " active" : "")}
            onClick={beginNewScan}
          >
            スキャン
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => "nav-btn" + (isActive ? " active" : "")}>
            きろく
          </NavLink>
          <NavLink to="/remind" className={({ isActive }) => "nav-btn" + (isActive ? " active" : "")}>
            まいつきおさらい
          </NavLink>
        </nav>
        <button type="button" className="btn btn-primary btn-block sidebar-cta" onClick={startLesson}>
          れんしゅうをはじめる
        </button>
      </aside>
      <main className="main">
        <header className="topbar">
          <span className={"badge" + (geminiOk ? " ok" : "")}>{badge}</span>
          <h1>{titleForPath(location.pathname)}</h1>
        </header>
        <Outlet context={{ childName }} />
      </main>
    </div>
  );
}
