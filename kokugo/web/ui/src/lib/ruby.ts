import DOMPurify from "dompurify";

const RUBY_PURIFY: import("dompurify").Config = {
  ALLOWED_TAGS: ["ruby", "rt", "rp", "br", "span", "strong", "em", "code"],
  ALLOWED_ATTR: ["class"],
};

/** Safe HTML for display: only ruby-related tags. */
export function sanitizeRubyHtml(html: string): string {
  return DOMPurify.sanitize(html, RUBY_PURIFY);
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
