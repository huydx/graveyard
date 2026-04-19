import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { getHealth, postLogout } from "../api/client";
import RubyHtml from "../components/RubyHtml";
import { paths } from "../lib/paths";
import * as L from "../lib/uiLabelsRuby";

const LS_SIDEBAR = "study-app-sidebar-expanded";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [geminiOk, setGeminiOk] = useState(false);
  const [apiReachable, setApiReachable] = useState(true);
  const [childName, setChildName] = useState("");
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(LS_SIDEBAR) !== "false";
  });

  const inKokugo = location.pathname.startsWith("/kokugo");
  const inSansu = location.pathname.startsWith("/sansu");
  const showSettingsBadge = location.pathname === paths.kokugo.settings;

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
        setApiReachable(true);
        setGeminiOk(!!h.geminiConnected);
        setChildName(h.childName?.trim() ? h.childName : "");
      })
      .catch(() => {
        setApiReachable(false);
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
            <Link to={paths.kokugo.progress} className="profile profile--link">
              <div className="avatar" aria-hidden="true">
                🐦
              </div>
              <div className="profile-text">
                <span>{childName ? childName : <RubyHtml html={L.defaultStudentName} />}</span>
                <small>
                  <RubyHtml html={L.profileCheer} />
                </small>
              </div>
            </Link>
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
                  <NavLink
                    to={paths.kokugo.digests}
                    className={({ isActive }) => "nav-btn nav-btn-main" + (isActive ? " active" : "")}
                  >
                    <RubyHtml html={L.navWeeklyDigest} />
                  </NavLink>
                </nav>
                <div className="sidebar-secondary">
                  <Link to={paths.kokugo.remind} className="sidebar-secondary-link">
                    <RubyHtml html={L.navMonthlyReview} />
                  </Link>
                  <Link to={paths.kokugo.settings} className="sidebar-secondary-link sidebar-secondary-link--parent">
                    <RubyHtml html={L.navParentOnly} />
                  </Link>
                  <button
                    type="button"
                    className="sidebar-secondary-link"
                    onClick={() => {
                      void postLogout().finally(() => navigate(paths.kokugo.login));
                    }}
                  >
                    <RubyHtml html={L.navLogout} />
                  </button>
                </div>
              </>
            ) : null}
            {inSansu ? (
              <div className="sidebar-secondary sidebar-secondary--sansu">
                <Link to={paths.kokugo.remind} className="sidebar-secondary-link">
                  <RubyHtml html={L.navMonthlyReview} />
                </Link>
                <Link to={paths.kokugo.settings} className="sidebar-secondary-link sidebar-secondary-link--parent">
                  <RubyHtml html={L.navParentOnly} />
                </Link>
                <button
                  type="button"
                  className="sidebar-secondary-link"
                  onClick={() => {
                    void postLogout().finally(() => navigate(paths.kokugo.login));
                  }}
                >
                  <RubyHtml html={L.navLogout} />
                </button>
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
          <div className="topbar-badge-slot">
            {showSettingsBadge ? (
              <span
                className={"badge" + (!apiReachable ? " bad" : geminiOk ? " ok" : " warn")}
              >
                <RubyHtml
                  html={
                    !apiReachable
                      ? L.badgeApiDownParent
                      : geminiOk
                        ? L.badgeAiOk
                        : L.badgeParentGeminiHint
                  }
                />
              </span>
            ) : null}
          </div>
          <RubyHtml as="h1" html={L.titleHtmlForPath(location.pathname)} />
        </header>
        <Outlet context={{ childName }} />
      </main>
    </div>
  );
}
