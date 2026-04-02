export type JaSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
};

type SRConstructor = new () => JaSpeechRecognition;

/** Web Speech API (Chrome desktop). Returns null if unavailable. */
export function createJaSpeechRecognition(): JaSpeechRecognition | null {
  const w = window as Window & { webkitSpeechRecognition?: SRConstructor };
  const Ctor = (window as Window & { SpeechRecognition?: SRConstructor }).SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = "ja-JP";
  r.interimResults = false;
  r.maxAlternatives = 1;
  return r;
}

/** True when we should prefer browser speech (e.g. desktop Chrome). */
export function shouldUseBrowserSpeechRecognition(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const hasSR = !!(window as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition || "SpeechRecognition" in window;
  return hasSR && !isIOS;
}
