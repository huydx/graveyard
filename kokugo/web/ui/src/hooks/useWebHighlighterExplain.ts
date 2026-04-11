import { useCallback, useEffect, useRef } from "react";
import Highlighter from "web-highlighter";

const CREATE_FROM_INPUT = "from-input";

export const KOKUGO_EXPLAIN_HIGHLIGHT_CLASS = "kokugo-explain-highlight";

/** Skip furigana chrome so splitText does not pull rt/rp into odd ranges (do not except highlight wraps — selections can overlap the current mark). */
const HIGHLIGHTER_EXCEPT_SELECTORS = ["rt", "rp"];

type UseWebHighlighterExplainOpts = {
  enabled: boolean;
  /** Passage container (e.g. .passage-body) — use callback ref so this is non-null after paint. */
  root: HTMLElement | null;
  /** Bumps when passage text changes so highlights are reset. */
  passageKey: string;
  maxRunes: number;
  onSelectText: (text: string) => void;
};

/**
 * Wraps alienzhou/web-highlighter for 説明モード.
 * Uses a coalesced pointer/touch/mouse end handler instead of the library default (mouseup XOR touchend
 * from UA sniffing), so selection settles reliably on hybrid devices and touch laptops.
 */
export function useWebHighlighterExplain(opts: UseWebHighlighterExplainOpts) {
  const hlRef = useRef<Highlighter | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const onSelectTextRef = useRef(opts.onSelectText);
  const maxRunesRef = useRef(opts.maxRunes);
  onSelectTextRef.current = opts.onSelectText;
  maxRunesRef.current = opts.maxRunes;

  const clearVisual = useCallback(() => {
    const h = hlRef.current;
    if (!h) return;
    h.removeAll();
    lastIdRef.current = null;
  }, []);

  useEffect(() => {
    if (!opts.enabled || !opts.root) {
      if (hlRef.current) {
        hlRef.current.dispose();
        hlRef.current = null;
      }
      lastIdRef.current = null;
      return;
    }

    const root = opts.root;
    const h = new Highlighter({
      $root: root,
      style: { className: KOKUGO_EXPLAIN_HIGHLIGHT_CLASS },
      verbose: false,
      exceptSelectors: HIGHLIGHTER_EXCEPT_SELECTORS,
    });

    h.on(Highlighter.event.CREATE, (data) => {
      if (data.type !== CREATE_FROM_INPUT || !data.sources?.length) return;
      const src = data.sources[0];
      const prev = lastIdRef.current;
      if (prev && prev !== src.id) {
        try {
          h.remove(prev);
        } catch {
          /* ignore */
        }
      }
      lastIdRef.current = src.id;
      let t = (src.text || "").replace(/\s+/g, " ").trim();
      const runes = [...t];
      const max = maxRunesRef.current;
      if (runes.length > max) {
        t = runes.slice(0, max).join("");
      }
      onSelectTextRef.current(t);
    });

    let rafId = 0;

    const applySelection = () => {
      const inst = hlRef.current;
      if (!inst || !root.isConnected) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return;

      try {
        const source = inst.fromRange(range);
        if (source) {
          sel.removeAllRanges();
        }
      } catch {
        /* invalid range across ruby / wrappers */
      }
    };

    const scheduleApply = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        applySelection();
      });
    };

    // Do not use h.run(): it only listens to mouseup OR touchend based on UA, which breaks many devices.
    root.addEventListener("pointerup", scheduleApply);
    root.addEventListener("touchend", scheduleApply, { passive: true });
    root.addEventListener("mouseup", scheduleApply);

    hlRef.current = h;

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      root.removeEventListener("pointerup", scheduleApply);
      root.removeEventListener("touchend", scheduleApply);
      root.removeEventListener("mouseup", scheduleApply);
      h.dispose();
      hlRef.current = null;
      lastIdRef.current = null;
    };
  }, [opts.enabled, opts.root, opts.passageKey]);

  return { clearVisual };
}
