import { v4 as uuidv4 } from "uuid";
import { Message, AgentTurn, ToolCallRecord, ResponseType } from "@/types";
import { MemoryProvider } from "../memory/provider";
import { LLMClient, createLLMClient, createConfigFromEnv } from "../llm/client";
import { buildSystemPrompt } from "./context";
import { handleRecordObservation, handleMemorySearch } from "./tools";

const MAX_ITERATIONS = 5;

/**
 * Agent loop — Hermes-inspired iteration budget + tool dispatch.
 *
 * Flow per turn:
 *   1. PREFETCH memory
 *   2. ASSEMBLE context (system prompt + memory + conversation)
 *   3. LOOP: LLM call → if final response: break / if tool calls: execute, loop
 *   4. SYNC: persist messages to Tier 1
 *   5. DELIVER: return final response with type marker
 */

export async function runAgentTurn(
  memoryProvider: MemoryProvider,
  kidId: string,
  sessionId: string,
  userMessage: Message,
  existingMessages: Message[]
): Promise<AgentTurn> {
  const llm = createLLMClient(createConfigFromEnv());

  // 1. PREFETCH
  const systemPrompt = await buildSystemPrompt(memoryProvider, kidId);

  // 2. ASSEMBLE messages for LLM
  const llmMessages: { role: string; content: string; imageUrl?: string }[] =
    existingMessages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
      // Pass through image URLs from past messages so the model
      // retains context of previously captured worksheets
      imageUrl: m.imageUrl,
    }));

  // Add the new user message (may carry a camera capture)
  llmMessages.push({
    role: "user",
    content: userMessage.content,
    imageUrl: userMessage.imageUrl,
  });

  // 3. AGENT LOOP
  let iterationCount = 0;
  const toolCalls: ToolCallRecord[] = [];
  let finalResponse: AgentTurn["finalResponse"] | null = null;

  while (iterationCount < MAX_ITERATIONS) {
    iterationCount++;

    const toolSchemas = memoryProvider.getToolSchemas();
    const geminiTools = toolSchemas.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    const response = await llm.generate(
      systemPrompt,
      llmMessages,
      geminiTools
    );

    // If the model calls tools
    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const tc of response.toolCalls) {
        let result: string;
        switch (tc.name) {
          case "record_observation":
            result = await handleRecordObservation(
              memoryProvider as any, // internal access for now
              kidId,
              tc.args.observation as string,
              tc.args.category as any
            );
            break;
          case "memory_search":
            result = "Tool not available in agent loop v1 — memory is already in context";
            break;
          case "compact_session":
            result = "Session compaction is handled automatically at session end";
            break;
          default:
            result = `Unknown tool: ${tc.name}`;
        }

        toolCalls.push({ name: tc.name, args: tc.args, result });

        // Append tool result to conversation
        llmMessages.push({
          role: "user",
          content: `Tool result for ${tc.name}: ${result}`,
        });
      }
      continue; // loop again for the model to process tool results
    }

    // No tool calls → this is the final response
    // Parse response type from content
    const { responseType, content, exerciseHtml } = parseResponseType(
      response.text
    );

    finalResponse = { content, responseType, exerciseHtml };
    break;
  }

  // If we exceeded iteration budget, force a response
  if (!finalResponse) {
    finalResponse = {
      content:
        "ごめんね、ちょっと かんがえすぎちゃった！もういちど おしえてくれる？ 🐻",
      responseType: "chat",
    };
  }

  // 4. SYNC — persist both messages
  const assistantMessage: Message = {
    id: uuidv4(),
    sessionId,
    role: "assistant",
    content: finalResponse.content,
    responseType: finalResponse.responseType,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    timestamp: new Date().toISOString(),
  };

  await memoryProvider.syncTurn(kidId, sessionId, userMessage, assistantMessage);

  // 5. DELIVER
  return {
    userMessage,
    iterationCount,
    toolCalls,
    finalResponse,
  };
}

/**
 * Parse the AI response to determine output format.
 *
 * The AI marks its response type in the content:
 * - [type:chat] or no marker → chat bubble
 * - [type:exercise] → exercise card
 *
 * For exercise cards, the AI wraps the interactive HTML in ```exercise blocks.
 */
function parseResponseType(text: string): {
  responseType: ResponseType;
  content: string;
  exerciseHtml?: string;
} {
  // Check for exercise marker
  if (text.includes("[type:exercise]")) {
    const content = text.replace(/\[type:exercise\]\s*/i, "");

    // Extract exercise HTML block
    const htmlMatch = content.match(/```exercise\n([\s\S]*?)```/);
    const cleanContent = content
      .replace(/```exercise\n[\s\S]*?```/, "")
      .trim();

    return {
      responseType: "exercise",
      content: cleanContent,
      exerciseHtml: htmlMatch?.[1]?.trim(),
    };
  }

  // Default: chat
  const content = text.replace(/\[type:chat\]\s*/i, "").trim();
  return { responseType: "chat", content };
}
