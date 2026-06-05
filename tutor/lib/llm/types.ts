import { LLMResponse } from "@/types";

/**
 * Standardized message format that all adapters understand internally.
 * Each adapter converts this to its provider-specific format.
 *
 * imageUrl supports multimodal vision requests.
 * It should be a base64 data URL: data:image/jpeg;base64,...
 */
export interface StandardMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  imageUrl?: string;
  toolCallId?: string;
}

/**
 * Lightweight message shape used by callers (loop.ts, client.ts).
 * Keeps the public API simple while allowing image data to pass through.
 */
export interface ChatMessage {
  role: string;
  content: string;
  imageUrl?: string;
}

/**
 * Every LLM adapter implements this interface.
 * To add a new provider (Ollama, Claude, OpenAI, etc.),
 * implement this interface in a new adapters/<name>.ts file
 * and register it in client.ts factory.
 */
export interface LLMAdapter {
  readonly provider: string;

  generate(
    systemPrompt: string,
    messages: StandardMessage[],
    tools?: Record<string, unknown>[]
  ): Promise<LLMResponse>;

  generateStream(
    systemPrompt: string,
    messages: StandardMessage[]
  ): AsyncIterable<string>;
}

/**
 * Convert our public message format to the adapter's internal format.
 */
export function toStandardMessages(
  messages: ChatMessage[]
): StandardMessage[] {
  return messages.map((m) => ({
    role: m.role as StandardMessage["role"],
    content: m.content,
    imageUrl: m.imageUrl,
  }));
}
