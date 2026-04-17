import type { AssignmentGroup, Exercise } from "../types";
import {
  exerciseRowFallbackBeforeParse,
  exerciseRowFallbackNoScan,
  exerciseRowNoTitle,
  exerciseStatusHtml,
} from "./uiLabelsRuby";

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

/** Short Japanese label for exercise.status in lists (HTML with optional ruby). */
export function exerciseStatusJa(status: string): string {
  return exerciseStatusHtml(status);
}

/** Label in だい lists when the exercise has no parser title yet. */
export function exerciseRowTitleHtml(ex: Exercise): string {
  const t = (ex.title || "").trim();
  if (t) return t;
  if (ex.status === "draft") {
    const pc = draftPageCount(ex);
    if (pc === 0) return exerciseRowFallbackNoScan;
    return exerciseRowFallbackBeforeParse(pc);
  }
  return exerciseRowNoTitle;
}

/** Shown when there is no custom title; may contain ruby HTML from the parser. */
export function exerciseTitleFallbackHtml(a: AssignmentGroup): string {
  const first = a.exercises?.[0];
  if (!first) return exerciseRowNoTitle;
  if (isBareEmptyDraft(first)) return exerciseRowFallbackNoScan;
  return exerciseRowTitleHtml(first);
}

/** Kid-facing list title: date + subject + そのn (serial is 1-based among sorted list). */
export function kidFriendlyPrintTitle(createdAt: string, subject: "kokugo" | "sansu", serial: number): string {
  try {
    const d = new Date(createdAt);
    if (!Number.isNaN(d.getTime())) {
      const subj = subject === "kokugo" ? "こくご" : "さんすう";
      return `${d.getMonth() + 1}/${d.getDate()} ${subj} れんしゅう その${serial}`;
    }
  } catch {
    /* ignore */
  }
  const subj = subject === "kokugo" ? "こくご" : "さんすう";
  return `${subj} れんしゅう その${serial}`;
}

export function sortAssignmentsNewestFirst<T extends { createdAt: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
}
