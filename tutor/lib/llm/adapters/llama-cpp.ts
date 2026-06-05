import { LLMConfig, LLMResponse } from "@/types";
import { LLMAdapter, StandardMessage } from "../types";

/**
 * Llama.cpp adapter.
 *
 * llama.cpp server exposes an OpenAI-compatible API at:
 *   POST {baseUrl}/v1/chat/completions
 *
 * Setup:
 *   llama-server -m model.gguf --host 0.0.0.0 --port 8080
 *
 * Config:
 *   LLM_PROVIDER=llama-cpp
 *   LLAMA_CPP_BASE_URL=http://localhost:8080
 *   LLM_MODEL=meta-llama-3.1-8b  (any name, llama.cpp ignores it)
 */
export function createLlamaCppAdapter(config: LLMConfig): LLMAdapter {
  const baseUrl = config.baseUrl ?? process.env.LLAMA_CPP_BASE_URL ?? "http://localhost:8080";

  return {
    provider: "llama-cpp",

    async generate(systemPrompt, messages, tools) {
      const body = buildOpenAIRequest(systemPrompt, messages, config, false, tools);

      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`llama.cpp API error (${response.status}): ${err}`);
      }

      const data = await response.json();
      return parseOpenAIResponse(data);
    },

    async *generateStream(systemPrompt, messages) {
      const body = buildOpenAIRequest(systemPrompt, messages, config, true);

      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(
          `llama.cpp streaming error (${response.status}): ${err}`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body for streaming");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json || json === "[DONE]") continue;

          try {
            const data = JSON.parse(json);
            const delta = data.choices?.[0]?.delta;
            if (delta?.content) yield delta.content;
          } catch {
            // Skip malformed SSE chunks
          }
        }
      }
    },
  };
}

// ── OpenAI-compatible format conversion ──

function buildOpenAIRequest(
  systemPrompt: string,
  messages: StandardMessage[],
  config: LLMConfig,
  stream: boolean,
  tools?: Record<string, unknown>[]
): Record<string, unknown> {
  const msgs: Record<string, unknown>[] = [];

  // OpenAI supports native system role
  msgs.push({ role: "system", content: systemPrompt });

  for (const msg of messages) {
    msgs.push({
      role: msg.role,
      content: buildMessageContent(msg),
    });
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages: msgs,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    stream,
  };

  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: t,
    }));
  }

  return body;
}

/**
 * Build message content — plain text or multimodal array if an image is attached.
 *
 * Plain text:
 *   "さんすう やる！"
 *
 * Multimodal (for vision models like llava):
 *   [
 *     { type: "text", text: "さんすう やる！" },
 *     { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }
 *   ]
 */
function buildMessageContent(
  msg: StandardMessage
): string | Record<string, unknown>[] {
  if (!msg.imageUrl) {
    return msg.content;
  }

  // Multimodal content array
  return [
    { type: "text", text: msg.content },
    { type: "image_url", image_url: { url: msg.imageUrl } },
  ];
}

function parseOpenAIResponse(data: Record<string, unknown>): LLMResponse {
  const choice = (data.choices as Record<string, unknown>[])?.[0];
  if (!choice) {
    return { text: "", finishReason: "error" };
  }

  const message = choice.message as Record<string, unknown>;
  const content = (message?.content as string) ?? "";

  // Parse tool calls from OpenAI format
  const rawToolCalls = message?.tool_calls as Record<string, unknown>[];
  const toolCalls =
    rawToolCalls?.map((tc) => {
      const fn = tc.function as Record<string, unknown>;
      return {
        name: fn.name as string,
        args: (fn.arguments ? JSON.parse(fn.arguments as string) : {}) as Record<string, unknown>,
      };
    });

  const finishReason = toolCalls?.length
    ? "tool_calls"
    : ((choice.finish_reason as string) === "stop" || choice.finish_reason === null
      ? "stop"
      : (choice.finish_reason as LLMResponse["finishReason"]));

  return {
    text: content,
    toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
    finishReason: finishReason ?? "stop",
  };
}
