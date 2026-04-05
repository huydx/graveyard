import type { AssignmentGroup, Exercise } from "../types";

/** User-set print (assignment) title; empty means fall back to だい1. */
export function customPrintTitle(a: AssignmentGroup): string {
  return (a.title ?? "").trim();
}

export function draftPageCount(ex: Exercise): number {
  const n = ex.imagePaths?.length ?? 0;
  if (n > 0) return n;
  return (ex.imagePath || "").trim() ? 1 : 0;
}

/** Draft with no images yet (the invisible “slot” before first scan). */
export function isBareEmptyDraft(ex: Exercise): boolean {
  return ex.status === "draft" && draftPageCount(ex) === 0;
}

/** New print: only the empty primary draft — no だい to show in a list yet. */
export function isOnlyBareEmptyPrint(a: AssignmentGroup): boolean {
  return a.exercises.length === 1 && isBareEmptyDraft(a.exercises[0]);
}

/** Short Japanese label for exercise.status in lists. */
export function exerciseStatusJa(status: string): string {
  switch (status) {
    case "draft":
      return "下書き";
    case "parsed":
      return "よみとりずみ";
    case "completed":
      return "れんしゅうおわり";
    default:
      return status;
  }
}

/** Label in だい lists when the exercise has no parser title yet. */
export function exerciseRowTitleHtml(ex: Exercise): string {
  const t = (ex.title || "").trim();
  if (t) return t;
  if (ex.status === "draft") {
    const pc = draftPageCount(ex);
    if (pc === 0) return "まだスキャンしていません";
    return `よみとりまえ（${pc}まい）`;
  }
  return "（むだい）";
}

/** Shown when there is no custom title; may contain ruby HTML from the parser. */
export function exerciseTitleFallbackHtml(a: AssignmentGroup): string {
  const first = a.exercises?.[0];
  if (!first) return "（むだい）";
  if (isBareEmptyDraft(first)) return "まだスキャンしていません";
  return exerciseRowTitleHtml(first);
}
