import { Message, Observation, Tier2SessionNote } from "@/types";
import { Tier2Provider } from "../memory/tier2";
import { Tier3Provider } from "../memory/tier3";

/**
 * Tool implementations called by the agent loop.
 * These are the runtime handlers for the 3 v1 tools.
 */

export async function handleRecordObservation(
  tier2: Tier2Provider,
  kidId: string,
  observation: string,
  category: Observation["category"]
): Promise<string> {
  const date = new Date().toISOString().split("T")[0];
  const obs: Observation = {
    category,
    content: observation,
    timestamp: new Date().toISOString(),
  };
  await tier2.appendObservation(kidId, date, obs);
  return `Recorded: [${category}] ${observation}`;
}

export async function handleMemorySearch(
  tier2: Tier2Provider,
  kidId: string,
  query: string
): Promise<string> {
  const results = await tier2.searchNotes(kidId, query);
  if (results.length === 0) return "No matching memories found.";
  return results.join("\n\n");
}

export async function compactSessionToDailyNote(
  kidId: string,
  messages: Message[],
  tier2: Tier2Provider,
  tier3: Tier3Provider
): Promise<string> {
  const date = new Date().toISOString().split("T")[0];

  // Extract observations from the session
  const observations: Observation[] = [];
  const topics = new Set<string>();
  let mood = "neutral";

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
    // Infer topic from content keywords
    const content = msg.content.toLowerCase();
    if (content.includes("さんすう") || content.includes("たしざん") || content.includes("ひきざん")) {
      topics.add("算数");
    }
    if (content.includes("こくご") || content.includes("ひらがな") || content.includes("かんじ")) {
      topics.add("国語");
    }
    // Detect mood from assistant messages
    if (msg.role === "assistant" && content.includes("がんば")) {
      mood = "engaged";
    }
    if (msg.role === "assistant" && content.includes("やす")) {
      mood = "tired";
    }
  }

  // Build the daily note
  const note: Tier2SessionNote = {
    date,
    topics: Array.from(topics),
    skillsPracticed: [],
    observations,
    mood,
    whatWorked: "See observations for details",
    whatDidnt: "",
  };

  await tier2.writeSessionNote(kidId, date, note);

  // Also update T3 if we extracted durable facts
  for (const obs of observations) {
    if (obs.category === "skill") {
      // Update skill map if observation mentions a known skill
      const memory = await tier3.getMemory(kidId);
      const matchingSkill = memory.skillMap.find(
        (s) => obs.content.includes(s.skill)
      );
      if (matchingSkill) {
        matchingSkill.lastPracticed = date;
        await tier3.upsertSkill(kidId, matchingSkill);
      }
    }
  }

  return `Session compacted: ${date}. ${observations.length} observations recorded.`;
}
