import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { getHealth } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import { paths } from "../lib/paths";
import * as L from "../lib/uiLabelsRuby";

const LS_SIDEBAR = "study-app-sidebar-expanded";

export default function Layout() {
  const location = useLocation();
  const [badge, setBadge] = useState(L.badgeAiWaiting);
  const [geminiOk, setGeminiOk] = useState(false);
  const [childName, setChildName] = useState("");
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(LS_SIDEBAR) !== "false";
  });

  const inKokugo = location.pathname.startsWith("/kokugo");
  const inSansu = location.pathname.startsWith("/sansu");

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_SIDEBAR, sidebarExpanded ? "true" : "false");
    } catch {
      /* ignore */
    }
  }, [sidebarExpanded]);

  useEffect(() => {
    getHealth()
      .then((h) => {
        if (h.geminiConnected) {
          setBadge(L.badgeAiOk);
          setGeminiOk(true);
        } else {
          setBadge(L.badgeAiKey);
          setGeminiOk(false);
        }
        setChildName(h.childName?.trim() ? h.childName : "");
      })
      .catch(() => {
        setBadge(L.badgeApiDown);
        setGeminiOk(false);
      });
  }, [location.pathname]);

  return (
    <div className={"app-shell" + (sidebarExpanded ? "" : " app-shell--sidebar-collapsed")}>
      <aside className={"sidebar" + (sidebarExpanded ? "" : " sidebar--collapsed")} aria-label={L.ariaMainMenu}>
        {sidebarExpanded ? (
          <>
            <div className="sidebar-collapse-row">
              <button
                type="button"
                className="sidebar-edge-toggle"
                onClick={() => setSidebarExpanded(false)}
                aria-expanded={true}
                aria-label={L.ariaCollapseSidebar}
              >
                ⟨
              </button>
            </div>
            <Link to={paths.home} className="brand brand-super">
              <RubyHtml html={L.superAppTitle} />
            </Link>
            {inKokugo ? (
              <div className="brand brand-sub">
                <RubyHtml html={L.brandTitle} />
              </div>
            ) : null}
            {inSansu ? (
              <div className="brand brand-sub">
                <RubyHtml html={L.sansuPageTitle} />
              </div>
            ) : null}
            <div className="profile">
              <div className="avatar" aria-hidden="true">
                🐦
              </div>
              <div className="profile-text">
                <span>{childName ? childName : <RubyHtml html={L.defaultStudentName} />}</span>
                <small>
                  <RubyHtml html={L.profileCheer} />
                </small>
              </div>
            </div>
            <Link to={paths.home} className="sidebar-hub-link">
              <RubyHtml html={L.navAppHub} />
            </Link>
            {inKokugo ? (
              <>
                <nav className="nav nav-prints-only">
                  <NavLink
                    to={paths.kokugo.prints}
                    className={({ isActive }) => "nav-btn nav-btn-main" + (isActive ? " active" : "")}
                  >
                    <RubyHtml html={L.navPrint} />
                  </NavLink>
                </nav>
                <div className="sidebar-secondary">
                  <Link to={paths.kokugo.remind} className="sidebar-secondary-link">
                    <RubyHtml html={L.navMonthlyReview} />
                  </Link>
                  <Link to={paths.kokugo.settings} className="sidebar-secondary-link">
                    <RubyHtml html={L.navSettings} />
                  </Link>
                </div>
              </>
            ) : null}
            {inSansu ? (
              <div className="sidebar-secondary sidebar-secondary--sansu">
                <p className="sidebar-sansu-hint">
                  <RubyHtml html={L.sansuSidebarHint} />
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            className="sidebar-edge-toggle sidebar-edge-toggle--expand"
            onClick={() => setSidebarExpanded(true)}
            aria-expanded={false}
            aria-label={L.ariaExpandSidebar}
          >
            ⟩
          </button>
        )}
      </aside>
      <main className="main">
        <header className="topbar">
          <span className={"badge" + (geminiOk ? " ok" : "")}>
            <RubyHtml html={badge} />
          </span>
          <RubyHtml as="h1" html={L.titleHtmlForPath(location.pathname)} />
        </header>
        <Outlet context={{ childName }} />
      </main>
    </div>
  );
}
