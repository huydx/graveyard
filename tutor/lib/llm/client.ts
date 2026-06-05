import { LLMConfig, LLMProvider } from "@/types";
import { LLMAdapter, toStandardMessages, StandardMessage, ChatMessage } from "./types";
import { createGeminiAdapter } from "./adapters/gemini";
import { createLlamaCppAdapter } from "./adapters/llama-cpp";
import { LLMResponse } from "@/types";

/**
 * LLM Client — thin wrapper that delegates to provider-specific adapters.
 *
 * All adapters share the same interface. Swap providers by changing
 * LLM_PROVIDER env var or passing a different config.
 *
 *   LLM_PROVIDER=gemini        → Gemini API
 *   LLM_PROVIDER=llama-cpp     → Local llama.cpp server
 */
export interface LLMClient {
  generate(
    systemPrompt: string,
    messages: ChatMessage[],
    tools?: Record<string, unknown>[]
  ): Promise<LLMResponse>;

  generateStream(
    systemPrompt: string,
    messages: ChatMessage[]
  ): AsyncIterable<string>;
}

export function createLLMClient(config: LLMConfig): LLMClient {
  const adapter = createAdapter(config);

  return {
    async generate(systemPrompt, messages, tools) {
      const standard = toStandardMessages(messages);
      return adapter.generate(systemPrompt, standard, tools);
    },

    async *generateStream(systemPrompt, messages) {
      const standard = toStandardMessages(messages);
      yield* adapter.generateStream(systemPrompt, standard);
    },
  };
}

function createAdapter(config: LLMConfig): LLMAdapter {
  switch (config.provider) {
    case "gemini":
      return createGeminiAdapter(config);
    case "llama-cpp":
      return createLlamaCppAdapter(config);
    default: {
      const _exhaustive: never = config.provider;
      throw new Error(`Unknown LLM provider: ${config.provider}`);
    }
  }
}

/**
 * Build LLMConfig from environment variables.
 * Use this in server code to avoid hardcoding provider choices.
 *
 *   LLM_PROVIDER=gemini (default)
 *   LLM_MODEL=gemini-2.5-flash
 *   LLAMA_CPP_BASE_URL=http://localhost:8080
 */
export function createConfigFromEnv(): LLMConfig {
  const provider = (process.env.LLM_PROVIDER as LLMProvider) ?? "gemini";

  const defaults: Record<LLMProvider, { model: string }> = {
    gemini: { model: "gemini-2.5-flash" },
    "llama-cpp": { model: "local-model" },
  };

  return {
    provider,
    model: process.env.LLM_MODEL ?? defaults[provider].model,
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS ?? "1024", 10),
    temperature: parseFloat(process.env.LLM_TEMPERATURE ?? "0.7"),
    baseUrl: process.env.LLAMA_CPP_BASE_URL,
  };
}
