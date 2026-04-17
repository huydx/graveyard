import type {
  AppSettingsResponse,
  AssignmentExerciseRef,
  AssignmentGroup,
  Exercise,
  HealthResponse,
  OllamaCheckResponse,
  PrintLearningSummary,
  SansuKotsuPagesResponse,
  Question,
  QuestionCheckResult,
  SubmitResult,
  WeeklyDigest,
  VocabCard,
} from "../types";

async function parseJSON(text: string): Promise<Record<string, unknown>> {
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

export async function api<T = Record<string, unknown>>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = {
    Accept: "application/json",
    ...(opts.body && !(opts.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    ...opts.headers,
  };
  const r = await fetch(path, { ...opts, headers });
  const text = await r.text();
  const data = await parseJSON(text);
  if (!r.ok) {
    const err = (data.error as string) || r.statusText || "エラー";
    throw new Error(err);
  }
  return data as T;
}

export function getHealth() {
  return api<HealthResponse>("/api/health");
}

export function getAppSettings() {
  return api<AppSettingsResponse>("/api/settings");
}

export type PutAppSettingsBody = {
  ollamaBaseUrl?: string;
  ollamaChatModel?: string;
  summaryChatBackend?: string;
  judgeChatBackend?: string;
  /** @deprecated まとめと採点に同じ値を書くときだけ */
  chatBackend?: string;
  googleApiKey?: string;
  clearGoogleApiKey?: boolean;
  digestTopic?: string;
};

export function putAppSettings(body: PutAppSettingsBody) {
  return api<{ ok: boolean }>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function getOllamaCheck(baseUrl?: string) {
  const q =
    baseUrl !== undefined && baseUrl.trim() !== ""
      ? `?baseUrl=${encodeURIComponent(baseUrl.trim())}`
      : "";
  return api<OllamaCheckResponse>(`/api/settings/ollama-check${q}`);
}

/** Create an empty print (assignment + draft). Server requires a non-empty title in the body. */
export function createPrint(body: { title: string }) {
  return api<{ exerciseId: string; assignmentId: string }>("/api/prints", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createSansuPrint(body: { title: string }) {
  return api<{ exerciseId: string; assignmentId: string }>("/api/sansu/prints", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getPrint(assignmentId: string) {
  return api<{ print: AssignmentGroup; primaryExerciseId: string }>(
    `/api/prints/${encodeURIComponent(assignmentId)}`
  );
}

export function getSansuPrint(assignmentId: string) {
  return api<{ print: AssignmentGroup; primaryExerciseId: string }>(
    `/api/sansu/prints/${encodeURIComponent(assignmentId)}`
  );
}

export function patchPrintTitle(assignmentId: string, title: string) {
  return api<{ ok: boolean; title: string }>(`/api/prints/${encodeURIComponent(assignmentId)}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

/** Reuse last draft row or append a new draft; use returned id for addExercisePage on this print. */
export function ensureScanDraft(assignmentId: string) {
  return api<{ exerciseId: string }>(
    `/api/prints/${encodeURIComponent(assignmentId)}/ensure-scan-draft`,
    { method: "POST" }
  );
}

export function ensureSansuScanDraft(assignmentId: string) {
  return api<{ exerciseId: string }>(
    `/api/sansu/prints/${encodeURIComponent(assignmentId)}/ensure-scan-draft`,
    { method: "POST" }
  );
}

/** Legacy: first image creates a new draft in one step. Prefer createPrint + addExercisePage. */
export function uploadScan(file: File) {
  const fd = new FormData();
  fd.append("image", file);
  return api<{ exerciseId: string; imagePath: string; imagePaths?: string[] }>("/api/upload", {
    method: "POST",
    body: fd,
  });
}

export function addExercisePage(exerciseId: string, file: File) {
  const fd = new FormData();
  fd.append("image", file);
  return api<{ ok: boolean; imagePaths: string[] }>(
    `/api/exercises/${encodeURIComponent(exerciseId)}/pages`,
    { method: "POST", body: fd }
  );
}

export function deleteExercisePage(exerciseId: string, pageIndex: number) {
  return api<{ ok?: boolean; exerciseDeleted?: boolean; imagePaths?: string[] }>(
    `/api/exercises/${encodeURIComponent(exerciseId)}/pages/${pageIndex}`,
    { method: "DELETE" }
  );
}

export function parseExercise(id: string) {
  return api<{
    ok: boolean;
    exerciseCount?: number;
    exerciseIds?: string[];
    primaryExerciseId?: string;
    questionCount?: number;
    title?: string;
  }>(`/api/exercises/${encodeURIComponent(id)}/parse`, { method: "POST" });
}

export function getExercise(id: string) {
  return api<{
    exercise: Exercise;
    questions: Question[];
    assignment?: { id: string; exercises: AssignmentExerciseRef[] };
  }>(`/api/exercises/${encodeURIComponent(id)}`);
}

export function deleteExercise(id: string) {
  return api<{ ok: boolean }>(`/api/exercises/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function submitAnswers(id: string, answers: Record<string, string>) {
  return api<SubmitResult>(`/api/exercises/${encodeURIComponent(id)}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export function checkQuestionAnswer(exerciseId: string, questionId: string, answer: string) {
  return api<QuestionCheckResult>(
    `/api/exercises/${encodeURIComponent(exerciseId)}/questions/${encodeURIComponent(questionId)}/check`,
    { method: "POST", body: JSON.stringify({ answer }) }
  );
}

export function getQuestionSolution(exerciseId: string, questionId: string) {
  return api<{ correctAnswer: string }>(
    `/api/exercises/${encodeURIComponent(exerciseId)}/questions/${encodeURIComponent(questionId)}/solution`
  );
}

export type PassageExplainResult = {
  importantKeywords: string[];
  shortMeaning: string;
  explanation: string;
};

/** Uses the same chat backend as exercise scoring (Gemini judge model or Ollama チャット用 model). */
export function explainPassageSelection(exerciseId: string, selection: string) {
  return api<PassageExplainResult>(`/api/exercises/${encodeURIComponent(exerciseId)}/explain-selection`, {
    method: "POST",
    body: JSON.stringify({ selection }),
  });
}

export type SpeedReadSegmentsResponse = { htmlSegments: string[] };

/** Cached bunsetsu only; does not call AI. */
export function getSpeedReadSegments(exerciseId: string) {
  return api<SpeedReadSegmentsResponse>(
    `/api/exercises/${encodeURIComponent(exerciseId)}/speed-read-segments`
  );
}

/** Generate 文節 via AI, persist, and return segments. Returns cache immediately if already saved for this passage. */
export function generateSpeedReadSegments(exerciseId: string) {
  return api<SpeedReadSegmentsResponse>(
    `/api/exercises/${encodeURIComponent(exerciseId)}/speed-read-segments`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export function generatePrintSummary(assignmentId: string) {
  return api<{ summary: PrintLearningSummary }>(
    `/api/prints/${encodeURIComponent(assignmentId)}/summary`,
    { method: "POST" }
  );
}

/** GET returns the summary object directly (not wrapped). */
export function getPrintSummary(assignmentId: string) {
  return api<PrintLearningSummary>(`/api/prints/${encodeURIComponent(assignmentId)}/summary`);
}

export function listHistory() {
  return api<{ assignments: AssignmentGroup[] }>("/api/history");
}

export function listSansuHistory() {
  return api<{ assignments: AssignmentGroup[] }>("/api/sansu/history");
}

export function monthlyReminders() {
  return api<{ cards: VocabCard[] }>("/api/reminders/monthly");
}

export function reviewVocabCard(id: string) {
  return api(`/api/vocab/${encodeURIComponent(id)}/review`, { method: "POST" });
}

export function getWeeklyDigestTopic() {
  return api<{ topic: string }>("/api/digests/topic");
}

export function setWeeklyDigestTopic(topic: string) {
  return api<{ ok: boolean; topic: string }>("/api/digests/topic", {
    method: "PUT",
    body: JSON.stringify({ topic }),
  });
}

export function listWeeklyDigests() {
  return api<{ topic: string; digests: WeeklyDigest[]; stock: number; autoGeneratedOnOpen?: boolean }>(
    "/api/digests/weekly"
  );
}

export function completeWeeklyDigest(id: string) {
  return api<{ ok: boolean }>(`/api/digests/weekly/${encodeURIComponent(id)}/complete`, {
    method: "POST",
  });
}

export function transcribeAudio(blob: Blob, mimeHint: string) {
  const fd = new FormData();
  const name = mimeHint.includes("mp4") || mimeHint.includes("aac") ? "answer.m4a" : "answer.webm";
  fd.append("audio", blob, name);
  return api<{ text: string }>("/api/transcribe", { method: "POST", body: fd });
}

export function summarizeSansuKotsu(file: File) {
  const fd = new FormData();
  fd.append("image", file);
  return api<SansuKotsuPagesResponse>("/api/sansu/kotsu", { method: "POST", body: fd });
}

export function summarizeSansuExerciseKotsu(exerciseId: string) {
  return api<SansuKotsuPagesResponse>(
    `/api/sansu/exercises/${encodeURIComponent(exerciseId)}/kotsu`,
    { method: "POST" }
  );
}

export function getSansuExerciseKotsu(exerciseId: string) {
  return api<SansuKotsuPagesResponse>(`/api/sansu/exercises/${encodeURIComponent(exerciseId)}/kotsu`);
}
