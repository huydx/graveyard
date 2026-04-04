import type {
  AppSettingsResponse,
  Exercise,
  HealthResponse,
  LearningSummary,
  OllamaCheckResponse,
  Question,
  QuestionCheckResult,
  SubmitResult,
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
  ollamaModel?: string;
  ollamaChatModel?: string;
  parseStrategy?: string;
  ocrServerUrl?: string;
  summaryChatBackend?: string;
  judgeChatBackend?: string;
  rubyBackend?: string;
  /** @deprecated まとめて3ロールに同じ値を書くときだけ */
  chatBackend?: string;
  googleApiKey?: string;
  clearGoogleApiKey?: boolean;
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
  return api(`/api/exercises/${encodeURIComponent(id)}/parse`, { method: "POST" });
}

export function getExercise(id: string) {
  return api<{ exercise: Exercise; questions: Question[] }>(`/api/exercises/${encodeURIComponent(id)}`);
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

export function generateSummary(id: string) {
  return api<{ summary: LearningSummary }>(`/api/exercises/${encodeURIComponent(id)}/summary`, {
    method: "POST",
  });
}

export function getSummary(id: string) {
  return api<LearningSummary>(`/api/exercises/${encodeURIComponent(id)}/summary`);
}

export function listHistory() {
  return api<{ exercises: Exercise[] }>("/api/history");
}

export function monthlyReminders() {
  return api<{ cards: VocabCard[] }>("/api/reminders/monthly");
}

export function reviewVocabCard(id: string) {
  return api(`/api/vocab/${encodeURIComponent(id)}/review`, { method: "POST" });
}

export function transcribeAudio(blob: Blob, mimeHint: string) {
  const fd = new FormData();
  const name = mimeHint.includes("mp4") || mimeHint.includes("aac") ? "answer.m4a" : "answer.webm";
  fd.append("audio", blob, name);
  return api<{ text: string }>("/api/transcribe", { method: "POST", body: fd });
}
