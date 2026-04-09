import DOMPurify from "dompurify";

const RUBY_PURIFY: import("dompurify").Config = {
  ALLOWED_TAGS: ["ruby", "rt", "rp", "br", "span", "strong", "em", "code"],
  ALLOWED_ATTR: ["class"],
};

const VIS_PURIFY: import("dompurify").Config = {
  ALLOWED_TAGS: [
    "div",
    "p",
    "span",
    "strong",
    "em",
    "br",
    "ul",
    "ol",
    "li",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "figure",
    "figcaption",
    "code",
    "pre",
    "ruby",
    "rt",
    "rp",
    "svg",
    "g",
    "path",
    "line",
    "rect",
    "circle",
    "ellipse",
    "polygon",
    "polyline",
    "text",
  ],
  ALLOWED_ATTR: [
    "class",
    "role",
    "aria-label",
    "viewBox",
    "width",
    "height",
    "x",
    "y",
    "x1",
    "y1",
    "x2",
    "y2",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "d",
    "points",
    "fill",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-dasharray",
    "font-size",
    "font-family",
    "font-weight",
    "text-anchor",
    "opacity",
    "transform",
    "xmlns",
  ],
};

/** Safe HTML for display: only ruby-related tags. */
export function sanitizeRubyHtml(html: string): string {
  return DOMPurify.sanitize(html, RUBY_PURIFY);
}

/** Safe HTML for visualization block (supports simple tables/svg diagrams). */
export function sanitizeVisualizationHtml(html: string): string {
  return DOMPurify.sanitize(html, VIS_PURIFY);
}

/** Plain text for speech: each <ruby> block becomes its <rt> reading, then strip tags. */
export function furiganaToSpeechText(html: string): string {
  if (typeof document === "undefined") return html;
  const clean = DOMPurify.sanitize(html, RUBY_PURIFY);
  const div = document.createElement("div");
  div.innerHTML = clean;
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    if (el.tagName === "RUBY") {
      const rt = el.querySelector("rt");
      if (rt?.textContent) return rt.textContent;
    }
    if (el.tagName === "BR") return "\n";
    return Array.from(el.childNodes).map(walk).join("");
  };
  return walk(div);
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Build ruby HTML from plain kanji word + reading when AI did not return markup. */
export function rubyFromWordReading(word: string, reading: string): string {
  const w = word.trim();
  const r = reading.trim();
  if (!w) return "";
  if (w.includes("<ruby") || w.includes("<Ruby")) return w;
  if (!r) return escapeHtml(w);
  return `<ruby>${escapeHtml(w)}<rt>${escapeHtml(r)}</rt></ruby>`;
}
