import RubyHtml from "./RubyHtml";
import { sanitizeVisualizationHtml } from "../lib/ruby";
import * as L from "../lib/uiLabelsRuby";
import type { SansuKotsuSummary } from "../types";

export default function SansuKotsuVisualSection({ summary }: { summary: SansuKotsuSummary }) {
  const raw = summary.visualization_html?.trim() ?? "";
  const safe = raw ? sanitizeVisualizationHtml(raw) : "";
  const hasViz = Boolean(safe.trim());
  const stripped = Boolean(raw) && !hasViz;
  const ideas = summary.visualization_ideas ?? [];

  return (
    <>
      <h3>
        <RubyHtml html={L.sansuVisualHead} />
      </h3>
      {stripped ? (
        <p className="status">
          <RubyHtml html={L.sansuVizSanitizeBlocked} />
        </p>
      ) : null}
      {hasViz ? (
        <div
          className="sansu-visual-html sansu-viz-embed"
          // Sanitized LLM HTML (no script); prefer light DOM so diagrams always paint.
          dangerouslySetInnerHTML={{ __html: safe }}
        />
      ) : null}
      {!hasViz && ideas.length > 0 ? (
        <>
          <p className="muted">
            <RubyHtml html={L.sansuVisualIdeasLead} />
          </p>
          <ul className="sansu-care-list">
            {ideas.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        </>
      ) : null}
      {!hasViz && !stripped && ideas.length === 0 ? (
        <p className="muted">
          <RubyHtml html={L.sansuVisualNone} />
        </p>
      ) : null}
    </>
  );
}
