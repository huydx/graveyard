import { LLMConfig, LLMResponse } from "@/types";
import { LLMAdapter, StandardMessage } from "../types";

/**
 * Gemini adapter.
 *
 * Converts standard messages to Gemini's native format:
 * - System prompt → injected as first user/model exchange
 * - Roles: "assistant" → "model", "user" stays "user"
 * - Tools → Gemini functionDeclarations
 */
export function createGeminiAdapter(config: LLMConfig): LLMAdapter {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}`;

  return {
    provider: "gemini",

    async generate(systemPrompt, messages, tools) {
      const contents = buildContents(systemPrompt, messages);

      const body: Record<string, unknown> = {
        contents,
        generationConfig: {
          maxOutputTokens: config.maxTokens,
          temperature: config.temperature,
        },
      };

      if (tools && tools.length > 0) {
        body.tools = [{ functionDeclarations: tools }];
      }

      const response = await fetch(`${baseUrl}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${err}`);
      }

      const data = await response.json();
      return parseResponse(data);
    },

    async *generateStream(systemPrompt, messages) {
      const contents = buildContents(systemPrompt, messages);

      const body = {
        contents,
        generationConfig: {
          maxOutputTokens: config.maxTokens,
          temperature: config.temperature,
        },
      };

      const response = await fetch(
        `${baseUrl}:streamGenerateContent?alt=sse&key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini streaming error (${response.status}): ${err}`);
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
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) yield text;
          } catch {
            // Skip malformed SSE chunks
          }
        }
      }
    },
  };
}

// ── Gemini-specific format conversion ──

function buildContents(
  systemPrompt: string,
  messages: StandardMessage[]
): Record<string, unknown>[] {
  const contents: Record<string, unknown>[] = [];

  // Gemini has no native system role — inject as user/model pair
  contents.push({
    role: "user",
    parts: [{ text: systemPrompt }],
  });
  contents.push({
    role: "model",
    parts: [
      { text: "Understood. I am くま先生, ready to help そうすけ learn!" },
    ],
  });

  for (const msg of messages) {
    const role = msg.role === "assistant" ? "model" : "user";
    const parts: Record<string, unknown>[] = [{ text: msg.content }];

    // Attach image if present (worksheet capture)
    const imagePart = buildImagePart(msg.imageUrl);
    if (imagePart) {
      parts.push(imagePart);
    }

    contents.push({ role, parts });
  }

  return contents;
}

/**
 * Parse a base64 data URL into Gemini's inlineData part.
 * Input:  data:image/jpeg;base64,/9j/4AAQ...
 * Output: { inlineData: { mimeType: "image/jpeg", data: "/9j/4AAQ..." } }
 */
function buildImagePart(
  imageUrl?: string
): Record<string, unknown> | null {
  if (!imageUrl) return null;

  const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    console.warn("Image URL is not a valid data URL, skipping vision part");
    return null;
  }

  return {
    inlineData: {
      mimeType: match[1], // e.g. "image/jpeg"
      data: match[2],     // raw base64 string
    },
  };
}

function parseResponse(data: Record<string, unknown>): LLMResponse {
  const candidate = (data.candidates as Record<string, unknown>[])?.[0];
  if (!candidate) {
    return { text: "", finishReason: "error" };
  }

  const content = candidate.content as Record<string, unknown>;
  const parts = content?.parts as Record<string, unknown>[];

  const textParts =
    parts
      ?.filter((p) => "text" in p)
      .map((p) => p.text as string)
      .join("") ?? "";

  const toolCalls = parts
    ?.filter((p) => "functionCall" in p)
    .map((p) => {
      const fc = p.functionCall as Record<string, unknown>;
      return {
        name: fc.name as string,
        args: (fc.args ?? {}) as Record<string, unknown>,
      };
    });

  const finishReason =
    (candidate.finishReason as LLMResponse["finishReason"]) ?? "stop";

  return {
    text: textParts,
    toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
    finishReason,
  };
}
