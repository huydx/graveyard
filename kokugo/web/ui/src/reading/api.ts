import { api } from "../api/client";

export type PassageExplainResult = {
  importantKeywords: string[];
  shortMeaning: string;
  explanation: string;
};

/** Explain a highlight for arbitrary passage HTML (same judge stack as exercise explain). */
export function explainReadingSelection(body: { title?: string; passage: string; selection: string }) {
  return api<PassageExplainResult>("/api/reading/explain-selection", {
    method: "POST",
    body: JSON.stringify({
      title: body.title ?? "",
      passage: body.passage,
      selection: body.selection,
    }),
  });
}

export type SpeedReadSegmentsResponse = { htmlSegments: string[] };

/** Bunsetsu HTML segments for any passage (no DB; same AI path as exercise speed-read). */
export function readingSpeedReadSegments(passage: string) {
  return api<SpeedReadSegmentsResponse>("/api/reading/speed-read-segments", {
    method: "POST",
    body: JSON.stringify({ passage }),
  });
}

export type MaterializedQuestion = {
  type: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  focusWord: string;
  scorable?: boolean;
};

export type ReadingMaterializeResponse = {
  title: string;
  passage: string;
  questions: MaterializedQuestion[];
};

/** Plain text → ruby passage + questions (requires Gemini worksheet parser). */
export function readingMaterialize(body: { title?: string; plainText: string }) {
  return api<ReadingMaterializeResponse>("/api/reading/materialize", {
    method: "POST",
    body: JSON.stringify({ title: body.title ?? "", plainText: body.plainText }),
  });
}
