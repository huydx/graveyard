import fs from "fs/promises";
import path from "path";
import { MemoryProvider } from "../memory/provider";
import { ToolSchema } from "@/types";

/**
 * ContextAssembler — builds the full system prompt + context for each agent turn.
 *
 * Layout (from memory-architecture.md):
 *   [SOUL.md]        — static persona (~1200 tokens)
 *   [AGENTS.md]      — static operating instructions (~1500 tokens)
 *   [Safety Rules]   — static, always present
 *   [Tier 3: MEMORY.md] — always injected (~500 tokens)
 *   [Tier 2: Sessions]  — last 5 daily notes (1500 token budget)
 *   [Tool Schemas]   — agent tools
 *   [Tier 1: Conversation] — current messages
 *
 * Stable prefix (~4250 tokens) never changes mid-session,
 * enabling Gemini prompt caching.
 */

const PROMPTS_DIR = path.join(process.cwd(), "lib", "agent", "prompts");

let soulCache: string | null = null;
let agentsCache: string | null = null;

async function loadPromptFile(filename: string): Promise<string> {
  const cache = filename === "soul.md" ? soulCache : agentsCache;
  if (cache !== null) return cache;

  const filePath = path.join(PROMPTS_DIR, filename);
  const content = await fs.readFile(filePath, "utf-8");

  if (filename === "soul.md") soulCache = content;
  else agentsCache = content;

  return content;
}

const SAFETY_RULES = `## Safety Rules (MUST FOLLOW)

1. **Content filtering**: Refuse inappropriate topics. Redirect to learning.
2. **Grounding**: No hallucinated harmful advice. No medical/financial claims.
3. **Emotional safety**: Never shame, mock, or frustrate. De-escalate on repeated failure. Suggest breaks.
4. **Parent audit**: All interactions are reviewable by parents.
5. **Child-appropriate**: そうすけ is 6. Keep responses age-appropriate.

If the kid says anything concerning or asks about boundary topics, respond calmly, redirect to learning, and record your concern via record_observation.`;

export async function buildSystemPrompt(
  memoryProvider: MemoryProvider,
  kidId: string
): Promise<string> {
  const [soul, agents] = await Promise.all([
    loadPromptFile("soul.md"),
    loadPromptFile("agents.md"),
  ]);

  const memoryBlock = await memoryProvider.buildSystemPromptBlock(kidId);

  const toolSchemas = memoryProvider.getToolSchemas();
  const toolsBlock = formatToolsForPrompt(toolSchemas);

  return [soul, agents, SAFETY_RULES, memoryBlock, toolsBlock]
    .filter(Boolean)
    .join("\n\n---\n\n");
}

export function getStablePrefixLength(): number {
  // SOUL + AGENTS + Safety ~ 4250 tokens
  // Used for prefix caching decision
  return 4250;
}

function formatToolsForPrompt(tools: ToolSchema[]): string {
  if (tools.length === 0) return "";

  const lines: string[] = ["## Available Tools"];
  lines.push(
    "You have these tools. Use them when needed — each call adds latency for the kid, so only call when it adds real value."
  );
  lines.push("");

  for (const tool of tools) {
    lines.push(`### ${tool.name}`);
    lines.push(tool.description);
    lines.push("");

    const params = tool.parameters as Record<string, unknown>;
    if (params.properties) {
      lines.push("Parameters:");
      const props = params.properties as Record<string, Record<string, unknown>>;
      for (const [name, schema] of Object.entries(props)) {
        const required = (params.required as string[])?.includes(name)
          ? " (required)"
          : "";
        lines.push(`  - ${name}: ${schema.description}${required}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
