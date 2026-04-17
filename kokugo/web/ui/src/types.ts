export interface Exercise {
  id: string;
  title: string;
  passage: string;
  imagePath: string;
  imagePaths?: string[];
  status: string;
  createdAt: string;
  completedAt?: string;
  scorePercent?: number;
  assignmentId?: string;
  assignmentSort?: number;
  /** Cached 速読 文節 (HTML fragments), when present and passage unchanged */
  speedReadHtmlSegments?: string[];
}

/** One scan session (e.g. weekly homework) containing one or more exercises. */
export interface AssignmentGroup {
  id: string;
  /** User-editable label for the print; when empty, UI falls back to だい1 title. */
  title?: string;
  createdAt: string;
  exercises: Exercise[];
}

export interface AssignmentExerciseRef {
  id: string;
  title: string;
  assignmentSort: number;
  status: string;
  scorePercent?: number;
}

export interface Question {
  id: string;
  exerciseId: string;
  sortOrder: number;
  type: string;
  prompt: string;
  options: string[];
  focusWord: string;
  /** サーバーが正解をもち、自動採点・かくにんできる */
  scorable?: boolean;
}

export interface HealthResponse {
  geminiConnected: boolean;
  speechTranscribeOK?: boolean;
  childName: string;
  chatBackend?: string;
  chatBackendSummary?: string;
  chatBackendJudge?: string;
  ollamaBaseUrl?: string;
}

export interface AppSettingsResponse {
  ollamaBaseUrl: string;
  ollamaChatModel: string;
  summaryChatBackend: string;
  judgeChatBackend: string;
  chatBackend?: string;
  hasGeminiKey: boolean;
  geminiKeyEffective: boolean;
  summaryChatBackendEffective: string;
  judgeChatBackendEffective: string;
  chatBackendEffective: string;
  envOllamaBaseUrl: string;
  envOllamaChatModel: string;
  ollamaChatModelEffective: string;
  envSummaryChatBackend: string;
  envJudgeChatBackend: string;
  updatedAt?: string;
  digestTopic?: string;
}

export interface OllamaCheckResponse {
  ok: boolean;
  message?: string;
  models?: string[];
  baseUrl?: string;
}

export interface VocabSummary {
  word: string;
  reading: string;
  meaning: string;
  examples: string[];
}

/** One flashcard row: short phrase (front) + explanation (back). */
export interface PrintKeywordCard {
  phrase: string;
  nuance: string;
}

/** Whole-print AI summary (all だい together). */
export interface PrintLearningSummary {
  overview: string;
  keyword_cards: PrintKeywordCard[];
}

export interface SansuKotsuSummary {
  main_idea: string;
  pattern: string;
  care_points: string[];
  visualization_ideas?: string[];
  visualization_html?: string;
}

/** API response for POST/GET …/sansu/…/kotsu */
export interface SansuKotsuPagesResponse {
  pages: SansuKotsuSummary[];
}

/** @deprecated Per-exercise summary; API uses print-level summary now. */
export interface LearningSummary {
  key_points: string[];
  vocabulary: VocabSummary[];
}

export interface VocabCard {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  examples: string[];
}

export interface WeeklyDigest {
  id: string;
  topic: string;
  subTopic: string;
  content: string;
  status: string;
  createdAt: string;
  completedAt?: string;
}

export interface QuestionCheckResult {
  questionId: string;
  prompt: string;
  isCorrect: boolean;
  feedback: string;
}

export interface QuestionResultRow {
  questionId: string;
  prompt: string;
  userAnswer: string;
  isCorrect: boolean;
  feedback: string;
}

export interface SubmitResult {
  scorePercent: number;
  correct: number;
  total: number;
  questionResults?: QuestionResultRow[];
}
