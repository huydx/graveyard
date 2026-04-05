import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { getHealth } from "../api/client";

function titleForPath(pathname: string): string {
  if (pathname === "/prints/new") return "あたらしいプリント";
  if (/\/prints\/[^/]+\/scan/.test(pathname)) return "スキャン";
  if (pathname.startsWith("/prints/") && pathname !== "/prints") return "プリント";
  if (pathname.startsWith("/exercise/")) return "れんしゅう";
  if (pathname.startsWith("/result/")) return "けっか";
  if (pathname.startsWith("/remind")) return "まいつきおさらい";
  if (pathname.startsWith("/settings")) return "せってい";
  if (pathname === "/prints") return "プリント";
  return "こくごアトリエ";
}

export default function Layout() {
  const location = useLocation();
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
  }, [location.pathname]);

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
        <nav className="nav nav-prints-only">
          <NavLink to="/prints" className={({ isActive }) => "nav-btn nav-btn-main" + (isActive ? " active" : "")}>
            プリント
          </NavLink>
        </nav>
        <div className="sidebar-secondary">
          <Link to="/remind" className="sidebar-secondary-link">
            まいつきおさらい
          </Link>
          <Link to="/settings" className="sidebar-secondary-link">
            せってい
          </Link>
        </div>
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
