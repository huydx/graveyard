import { sanitizeRubyHtml } from "./ruby";

/** Split AI overview HTML into short lines for kid-friendly bullets (plain text, no ruby). */
export function splitOverviewToPlainBullets(html: string): string[] {
  if (typeof document === "undefined") return [];
  const clean = sanitizeRubyHtml(html);
  const div = document.createElement("div");
  div.innerHTML = clean;
  const text = (div.textContent || "").trim();
  if (!text) return [];
  return text
    .split(/[。\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
    .slice(0, 12);
}
