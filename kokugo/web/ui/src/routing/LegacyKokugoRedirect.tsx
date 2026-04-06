import { Navigate, useLocation, useParams } from "react-router-dom";
import { legacyKokugoTarget } from "./legacyKokugoTarget";

/** Redirects old top-level 国語 URLs to `/kokugo/...`. */
export function LegacyKokugoRedirect() {
  const location = useLocation();
  const to = legacyKokugoTarget(location.pathname);
  if (!to) return <Navigate to="/" replace />;
  return <Navigate to={to + location.search} replace />;
}

export function LegacyExerciseRedirect() {
  const { id } = useParams();
  const location = useLocation();
  if (!id) return <Navigate to="/kokugo/prints" replace />;
  return <Navigate to={`/kokugo/exercise/${encodeURIComponent(id)}${location.search}`} replace />;
}

export function LegacyResultRedirect() {
  const { id } = useParams();
  const location = useLocation();
  if (!id) return <Navigate to="/kokugo/prints" replace />;
  return <Navigate to={`/kokugo/result/${encodeURIComponent(id)}${location.search}`} replace />;
}
