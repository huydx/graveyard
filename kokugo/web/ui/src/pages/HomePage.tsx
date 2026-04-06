import { Link } from "react-router-dom";
import RubyHtml from "../components/RubyHtml";
import { miniApps } from "../apps/registry";
import * as L from "../lib/uiLabelsRuby";

export default function HomePage() {
  return (
    <div className="app-hub">
      <header className="app-hub-header">
        <RubyHtml as="h1" className="app-hub-title" html={L.superAppTitle} />
        <p className="app-hub-lead">
          <RubyHtml html={L.superAppLead} />
        </p>
      </header>
      <ul className="app-hub-grid">
        {miniApps.map((app) => (
          <li key={app.id}>
            <Link
              to={app.href}
              className={
                "app-hub-card" + (app.comingSoon ? " app-hub-card--soon" : " app-hub-card--active")
              }
            >
              <span className="app-hub-card-icon" aria-hidden="true">
                {app.icon}
              </span>
              <RubyHtml as="span" className="app-hub-card-title" html={app.titleHtml} />
              <RubyHtml as="span" className="app-hub-card-desc" html={app.descriptionHtml} />
              {app.comingSoon ? (
                <span className="app-hub-soon-badge">
                  <RubyHtml html={L.soonBadge} />
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
