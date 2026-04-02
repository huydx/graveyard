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
}

export interface HealthResponse {
  geminiConnected: boolean;
  speechTranscribeOK?: boolean;
  childName: string;
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

export interface SubmitResult {
  scorePercent: number;
  correct: number;
  total: number;
}
