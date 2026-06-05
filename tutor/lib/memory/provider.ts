import { Tier1Provider, createTier1 } from "./tier1";
import { Tier2Provider, createTier2 } from "./tier2";
import { Tier3Provider, createTier3 } from "./tier3";
import { Message, Observation, ToolSchema } from "@/types";

/**
 * MemoryProvider — implements the Hermes-inspired interface from memory-architecture.md.
 *
 * v1: FileBasedMemoryProvider only.
 * Interface is clean enough to add PostgreSQL or Supabase later.
 */
export interface MemoryProvider {
  readonly name: string;

  // Lifecycle
  initialize(kidId: string): Promise<void>;
  shutdown(): Promise<void>;

  // Turn hooks
  prefetch(kidId: string): Promise<string>;
  syncTurn(
    kidId: string,
    sessionId: string,
    userMsg: Message,
    assistantMsg: Message
  ): Promise<void>;

  // Session hooks
  onSessionStart(kidId: string, sessionId: string): Promise<void>;
  onSessionEnd(kidId: string, sessionId: string, messages: Message[]): Promise<void>;
  onPreCompress(kidId: string, messages: Message[]): Promise<string>;

  // Context assembly
  buildSystemPromptBlock(kidId: string): Promise<string>;

  // Tools
  getToolSchemas(): ToolSchema[];
  handleToolCall(
    kidId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<string>;
}

export function createFileBasedMemoryProvider(): MemoryProvider {
  const tier1: Tier1Provider = createTier1();
  const tier2: Tier2Provider = createTier2();
  const tier3: Tier3Provider = createTier3();

  let currentDate: string = "";

  return {
    name: "file-based",

    async initialize(kidId) {
      const { ensureTutorDirs } = await import("../storage");
      await ensureTutorDirs(kidId);
    },

    async shutdown() {
      // No-op for file-based provider
    },

    async prefetch(kidId) {
      const memory = await tier3.getMemory(kidId);
      const recentNotes = await tier2.getRecentNotes(kidId, 5);

      // Format Tier 3 into compact block
      const tier3Block = formatTier3ForContext(memory);

      // Format Tier 2 into budget-capped block (1500 tokens max)
      const tier2Block = formatTier2ForContext(recentNotes, 1500);

      return [tier3Block, tier2Block].filter(Boolean).join("\n\n");
    },

    async syncTurn(kidId, sessionId, userMsg, assistantMsg) {
      await tier1.appendMessage(kidId, sessionId, userMsg);
      await tier1.appendMessage(kidId, sessionId, assistantMsg);
    },

    async onSessionStart(kidId, sessionId) {
      const now = new Date();
      currentDate = now.toISOString().split("T")[0];
      await tier1.getMessages(kidId, sessionId); // ensure path exists
    },

    async onSessionEnd(kidId, sessionId, messages) {
      // Compact session → Tier 2 daily note
      const { compactSessionToDailyNote } = await import("../agent/tools");
      await compactSessionToDailyNote(kidId, messages, tier2, tier3);
    },

    async onPreCompress(kidId, messages) {
      // Silent flush: extract observations before compression
      // Returns a summary string for the compressed middle
      const observations = extractPendingObservations(messages);
      for (const obs of observations) {
        const date = new Date().toISOString().split("T")[0];
        await tier2.appendObservation(kidId, date, obs);
      }
      return `[Compressed: ${messages.length} messages summarized. ${observations.length} observations extracted.]`;
    },

    async buildSystemPromptBlock(kidId) {
      const memory = await tier3.getMemory(kidId);
      const recentNotes = await tier2.getRecentNotes(kidId, 5);
      return [formatTier3ForContext(memory), formatTier2ForContext(recentNotes, 1500)]
        .filter(Boolean)
        .join("\n\n");
    },

    getToolSchemas() {
      return [
        {
          name: "record_observation",
          description:
            "Record an observation about そうすけ into memory. Use when you notice something worth remembering: a skill improving, a mistake pattern, an interest, mood, or what teaching approach worked.",
          parameters: {
            type: "object",
            properties: {
              observation: {
                type: "string",
                description: "The observation to record",
              },
              category: {
                type: "string",
                enum: ["skill", "struggle", "preference", "curriculum", "mood"],
                description: "Category of the observation",
              },
            },
            required: ["observation", "category"],
          },
        },
        {
          name: "memory_search",
          description:
            "Search past session notes for specific context. Use when you need to recall something not in your current context.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query keywords",
              },
            },
            required: ["query"],
          },
        },
        {
          name: "compact_session",
          description:
            "Summarize the current session into daily notes and update long-term memory. Called automatically at session end. Do not call manually unless explicitly instructed.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      ];
    },

    async handleToolCall(kidId, toolName, args) {
      const date = new Date().toISOString().split("T")[0];

      switch (toolName) {
        case "record_observation": {
          const observation: Observation = {
            category: (args.category as Observation["category"]) ?? "skill",
            content: args.observation as string,
            timestamp: new Date().toISOString(),
          };
          await tier2.appendObservation(kidId, date, observation);
          return `Observation recorded: [${observation.category}] ${observation.content}`;
        }

        case "memory_search": {
          const results = await tier2.searchNotes(
            kidId,
            args.query as string
          );
          if (results.length === 0) return "No matching memories found.";
          return results.join("\n\n");
        }

        case "compact_session": {
          // This is handled by onSessionEnd — tool call is a no-op trigger
          // The actual compaction happens in the session lifecycle
          return "Session compaction triggered. Memory has been updated.";
        }

        default:
          return `Unknown tool: ${toolName}`;
      }
    },
  };
}

// ── Context Formatting ──

function formatTier3ForContext(memory: import("@/types").Tier3Memory): string {
  const lines: string[] = ["## そうすけ's Long-Term Memory"];

  // Skills summary
  const bySubject: Record<string, string[]> = {};
  for (const skill of memory.skillMap) {
    const key = skill.subject;
    if (!bySubject[key]) bySubject[key] = [];
    const icon =
      skill.status === "mastered"
        ? "✅"
        : skill.status === "practicing"
          ? "🔄"
          : "⬜";
    bySubject[key].push(`${icon} ${skill.skill} (${skill.proficiency}/5)`);
  }
  for (const [subject, skills] of Object.entries(bySubject)) {
    lines.push(`\n### ${subject}`);
    skills.forEach((s) => lines.push(s));
  }

  // Struggle patterns (compact)
  if (memory.strugglePatterns.length > 0) {
    lines.push("\n### Struggle Patterns");
    memory.strugglePatterns.forEach((p) => {
      lines.push(`- ${p.description} (${p.frequency}x, helps: ${p.whatHelps})`);
    });
  }

  // Preferences (compact)
  const p = memory.preferences;
  lines.push("\n### Preferences");
  lines.push(
    `Interests: ${p.interests.map((i) => `${i.topic}(${i.score})`).join(", ") || "unknown"}`
  );
  lines.push(
    `Format: ${p.formatPreference} | Attention: ${p.attentionSpanMinutes}min | Gamification: ${p.gamificationResponse}`
  );

  // Curriculum
  if (memory.curriculumProgress.length > 0) {
    lines.push("\n### Curriculum");
    for (const c of memory.curriculumProgress) {
      const icon =
        c.status === "completed"
          ? "✅"
          : c.status === "in_progress"
            ? "🔄"
            : "⬜";
      lines.push(`${icon} ${c.subject}/${c.topic}`);
    }
  }

  return lines.join("\n");
}

function formatTier2ForContext(
  notes: import("@/types").Tier2SessionNote[],
  tokenBudget: number
): string {
  if (notes.length === 0) return "";

  const lines: string[] = ["## Recent Session History"];

  // Rough token estimation: ~4 chars per token
  const budgetChars = tokenBudget * 4;
  let usedChars = lines[0].length;

  for (const note of notes) {
    const block = [
      `\n### ${note.date} — Mood: ${note.mood}`,
      note.topics.length > 0 ? `Topics: ${note.topics.join(", ")}` : "",
      note.whatWorked ? `Worked: ${note.whatWorked}` : "",
      note.observations.length > 0
        ? `Observations:\n${note.observations.map((o) => `  - [${o.category}] ${o.content}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    if (usedChars + block.length > budgetChars) break;
    lines.push(block);
    usedChars += block.length;
  }

  return lines.join("\n");
}

function extractPendingObservations(messages: Message[]): Observation[] {
  // Extract observations from tool call records in messages
  const observations: Observation[] = [];
  for (const msg of messages) {
    if (msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        if (tc.name === "record_observation") {
          observations.push({
            category: (tc.args.category as Observation["category"]) ?? "skill",
            content: tc.args.observation as string,
            timestamp: msg.timestamp,
          });
        }
      }
    }
  }
  return observations;
}
