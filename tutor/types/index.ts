// ── Message & Chat ──

export type MessageRole = "user" | "assistant" | "system" | "tool";

export type InputMode = "voice" | "camera" | "keyboard";

export type ResponseType = "chat" | "exercise";

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  inputMode?: InputMode; // how the kid sent this (voice/camera/keyboard)
  responseType?: ResponseType; // how the AI chose to respond (chat/exercise)
  imageUrl?: string; // for camera captures
  toolCalls?: ToolCallRecord[];
  timestamp: string; // ISO 8601
}

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: string;
}

// ── Memory Tiers ──

export interface Tier2SessionNote {
  date: string;
  topics: string[];
  skillsPracticed: { skill: string; result: string }[];
  observations: Observation[];
  mood: string;
  whatWorked: string;
  whatDidnt: string;
}

export interface Tier3Memory {
  skillMap: SkillEntry[];
  strugglePatterns: StrugglePattern[];
  preferences: Preferences;
  curriculumProgress: CurriculumEntry[];
}

export interface SkillEntry {
  skill: string;
  subject: "kokugo" | "sansuu";
  status: "mastered" | "practicing" | "not_started";
  proficiency: number; // 1–5
  lastPracticed: string;
  notes: string;
}

export interface StrugglePattern {
  description: string;
  since: string;
  frequency: number;
  whatHelps: string;
}

export interface Preferences {
  interests: { topic: string; score: number }[];
  formatPreference: "visual" | "verbal" | "game" | "mixed";
  attentionSpanMinutes: number;
  gamificationResponse: "high" | "medium" | "low";
}

export interface CurriculumEntry {
  subject: "kokugo" | "sansuu";
  topic: string;
  status: "not_started" | "in_progress" | "completed";
  lastUpdated: string;
}

export interface Observation {
  category: "skill" | "struggle" | "preference" | "curriculum" | "mood";
  content: string;
  timestamp: string;
}

// ── Agent Loop ──

export interface AgentTurn {
  userMessage: Message;
  iterationCount: number;
  toolCalls: ToolCallRecord[];
  finalResponse: {
    content: string;
    responseType: ResponseType;
    exerciseHtml?: string; // for exercise cards
  };
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

// ── Session ──

export interface Session {
  id: string;
  kidId: string;
  startedAt: string;
  endedAt?: string;
  messages: Message[];
}

// ── LLM ──

export type LLMProvider = "gemini" | "llama-cpp";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  maxTokens: number;
  temperature: number;
  baseUrl?: string; // For llama-cpp: http://localhost:8080
}

export interface LLMResponse {
  text: string;
  toolCalls?: { name: string; args: Record<string, unknown> }[];
  finishReason: "stop" | "tool_calls" | "length" | "error";
}
