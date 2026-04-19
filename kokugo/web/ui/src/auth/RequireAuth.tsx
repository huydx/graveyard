import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { getAuthMe } from "../api/client";
import { paths } from "../lib/paths";
import RubyHtml from "../components/RubyHtml";
import * as L from "../lib/uiLabelsRuby";

/** Wraps Kokugo / Sansu shell routes; redirects to login when session is missing. */
export default function RequireAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAuthMe()
      .then(() => {
        if (!cancelled) setOk(true);
      })
      .catch(() => {
        if (cancelled) return;
        const next = encodeURIComponent(location.pathname + location.search);
        navigate(`${paths.kokugo.login}?next=${next}`, { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, location.pathname, location.search]);

  if (!ok) {
    return (
      <div className="card view">
        <p className="status">
          <RubyHtml html={L.authChecking} />
        </p>
      </div>
    );
  }

  return <Outlet />;
}
