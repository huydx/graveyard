import { Tier2SessionNote, Observation } from "@/types";
import { kidPath, ensureDir, readFileSafe } from "../storage";
import fs from "fs/promises";

/**
 * Tier 2: Session Memory (daily notes)
 * One markdown file per day: memory/YYYY-MM-DD.md
 */
export interface Tier2Provider {
  getSessionNote(kidId: string, date: string): Promise<Tier2SessionNote | null>;
  getRecentNotes(kidId: string, count: number): Promise<Tier2SessionNote[]>;
  appendObservation(kidId: string, date: string, observation: Observation): Promise<void>;
  writeSessionNote(kidId: string, date: string, note: Tier2SessionNote): Promise<void>;
  searchNotes(kidId: string, query: string): Promise<string[]>;
}

export function createTier2(): Tier2Provider {
  return {
    async getSessionNote(kidId, date) {
      const filePath = kidPath(kidId, "memory", `${date}.md`);
      const content = await readFileSafe(filePath);
      if (!content) return null;
      return parseDailyNote(content, date);
    },

    async getRecentNotes(kidId, count) {
      const dir = kidPath(kidId, "memory");
      await ensureDir(dir);

      const files = await fs.readdir(dir);
      const mdFiles = files
        .filter((f) => f.endsWith(".md"))
        .sort()
        .reverse()
        .slice(0, count);

      const notes: Tier2SessionNote[] = [];
      for (const file of mdFiles) {
        const date = file.replace(".md", "");
        const content = await readFileSafe(kidPath(kidId, "memory", file));
        if (content) {
          notes.push(parseDailyNote(content, date));
        }
      }
      return notes;
    },

    async appendObservation(kidId, date, observation) {
      const filePath = kidPath(kidId, "memory", `${date}.md`);
      await ensureDir(kidPath(kidId, "memory"));

      const existing = await readFileSafe(filePath);
      const obsLine = `- [${observation.category}] ${observation.content} (${observation.timestamp})\n`;

      if (existing) {
        // Insert before the closing section or append
        await fs.appendFile(filePath, obsLine, "utf-8");
      } else {
        const header = `# Session — ${date}\n\n## Observations\n\n${obsLine}\n`;
        await fs.writeFile(filePath, header, "utf-8");
      }
    },

    async writeSessionNote(kidId, date, note) {
      const filePath = kidPath(kidId, "memory", `${date}.md`);
      await ensureDir(kidPath(kidId, "memory"));

      const md = formatDailyNote(note);
      await fs.writeFile(filePath, md, "utf-8");
    },

    async searchNotes(kidId, query) {
      const dir = kidPath(kidId, "memory");
      await ensureDir(dir);

      const files = await fs.readdir(dir);
      const mdFiles = files.filter((f) => f.endsWith(".md")).sort().reverse();

      const results: string[] = [];
      const keywords = query.toLowerCase().split(/\s+/);

      for (const file of mdFiles) {
        const content = await readFileSafe(kidPath(kidId, "memory", file));
        if (!content) continue;

        const lowerContent = content.toLowerCase();
        if (keywords.some((kw) => lowerContent.includes(kw))) {
          // Return relevant snippet
          const lines = content.split("\n");
          const matchLines = lines.filter((line) =>
            keywords.some((kw) => line.toLowerCase().includes(kw))
          );
          results.push(`--- ${file} ---\n${matchLines.slice(0, 5).join("\n")}`);
        }
      }

      return results;
    },
  };
}

function parseDailyNote(content: string, date: string): Tier2SessionNote {
  const note: Tier2SessionNote = {
    date,
    topics: [],
    skillsPracticed: [],
    observations: [],
    mood: "unknown",
    whatWorked: "",
    whatDidnt: "",
  };

  // Simple markdown parsing — extract what we can
  const obsSection = content.match(/## Observations\n([\s\S]*?)(?=\n##|$)/);
  if (obsSection) {
    const obsLines = obsSection[1].trim().split("\n").filter(Boolean);
    for (const line of obsLines) {
      const match = line.match(
        /- \[(\w+)\] (.+) \((\d{4}-\d{2}-\d{2}T[\d:]+)/
      );
      if (match) {
        note.observations.push({
          category: match[1] as Observation["category"],
          content: match[2],
          timestamp: match[3],
        });
      }
    }
  }

  const topicsMatch = content.match(/## Topics\n([\s\S]*?)(?=\n##|$)/);
  if (topicsMatch) {
    note.topics = topicsMatch[1]
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => l.replace(/^-\s*/, ""));
  }

  const moodMatch = content.match(/## Mood\n(.+)/);
  if (moodMatch) note.mood = moodMatch[1].trim();

  const workedMatch = content.match(/## What Worked\n([\s\S]*?)(?=\n##|$)/);
  if (workedMatch) note.whatWorked = workedMatch[1].trim();

  const didntMatch = content.match(/## What Didn't\n([\s\S]*?)(?=\n##|$)/);
  if (didntMatch) note.whatDidnt = didntMatch[1].trim();

  return note;
}

function formatDailyNote(note: Tier2SessionNote): string {
  const lines: string[] = [];
  lines.push(`# Session — ${note.date}`);
  lines.push("");

  if (note.topics.length > 0) {
    lines.push("## Topics");
    note.topics.forEach((t) => lines.push(`- ${t}`));
    lines.push("");
  }

  if (note.skillsPracticed.length > 0) {
    lines.push("## Skills Practiced");
    note.skillsPracticed.forEach((s) =>
      lines.push(`- ${s.skill}: ${s.result}`)
    );
    lines.push("");
  }

  if (note.observations.length > 0) {
    lines.push("## Observations");
    note.observations.forEach((o) =>
      lines.push(`- [${o.category}] ${o.content} (${o.timestamp})`)
    );
    lines.push("");
  }

  lines.push("## Mood");
  lines.push(note.mood);
  lines.push("");

  lines.push("## What Worked");
  lines.push(note.whatWorked || "—");
  lines.push("");

  lines.push("## What Didn't");
  lines.push(note.whatDidnt || "—");
  lines.push("");

  return lines.join("\n");
}
