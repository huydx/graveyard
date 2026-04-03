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
  llmProvider?: string;
  parseStrategy?: string;
  chatBackend?: string;
  chatBackendSummary?: string;
  chatBackendJudge?: string;
  rubyBackend?: string;
  ollamaBaseUrl?: string;
}

export interface AppSettingsResponse {
  ollamaBaseUrl: string;
  parseStrategy: string;
  summaryChatBackend: string;
  judgeChatBackend: string;
  rubyBackend: string;
  chatBackend?: string;
  hasGeminiKey: boolean;
  geminiKeyEffective: boolean;
  parseStrategyEffective: string;
  summaryChatBackendEffective: string;
  judgeChatBackendEffective: string;
  rubyBackendEffective: string;
  chatBackendEffective: string;
  envOllamaBaseUrl: string;
  envParseStrategy: string;
  envSummaryChatBackend: string;
  envJudgeChatBackend: string;
  envRubyBackend: string;
  updatedAt?: string;
}

export interface VocabSummary {
  word: string;
  reading: string;
  meaning: string;
  examples: string[];
}

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
