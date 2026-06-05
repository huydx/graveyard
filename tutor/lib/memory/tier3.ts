import { Tier3Memory, SkillEntry, StrugglePattern, Preferences, CurriculumEntry } from "@/types";
import { kidPath, readFileSafe, fileExists, ensureDir } from "../storage";
import fs from "fs/promises";

/**
 * Tier 3: Long-Term Memory (MEMORY.md)
 * Single curated file always injected into context.
 *
 * Contains four sections:
 * - Skill Map
 * - Struggle Patterns
 * - Preferences
 * - Curriculum Progress
 */

export interface Tier3Provider {
  getMemory(kidId: string): Promise<Tier3Memory>;
  updateMemory(kidId: string, updates: Partial<Tier3Memory>): Promise<void>;
  upsertSkill(kidId: string, skill: SkillEntry): Promise<void>;
  appendStruggle(kidId: string, pattern: StrugglePattern): Promise<void>;
  updatePreferences(kidId: string, prefs: Partial<Preferences>): Promise<void>;
  updateCurriculum(kidId: string, entry: CurriculumEntry): Promise<void>;
}

const DEFAULT_MEMORY: Tier3Memory = {
  skillMap: [],
  strugglePatterns: [],
  preferences: {
    interests: [],
    formatPreference: "mixed",
    attentionSpanMinutes: 8,
    gamificationResponse: "high",
  },
  curriculumProgress: [],
};

export function createTier3(): Tier3Provider {
  return {
    async getMemory(kidId) {
      const filePath = kidPath(kidId, "MEMORY.md");
      const exists = await fileExists(filePath);
      if (!exists) {
        await ensureDir(kidPath(kidId));
        await fs.writeFile(filePath, formatMEMORYmd(DEFAULT_MEMORY), "utf-8");
        return DEFAULT_MEMORY;
      }

      const content = await readFileSafe(filePath);
      if (!content) return DEFAULT_MEMORY;
      return parseMEMORYmd(content);
    },

    async updateMemory(kidId, updates) {
      const current = await this.getMemory(kidId);
      const merged: Tier3Memory = {
        skillMap: updates.skillMap ?? current.skillMap,
        strugglePatterns:
          updates.strugglePatterns ?? current.strugglePatterns,
        preferences: { ...current.preferences, ...updates.preferences },
        curriculumProgress:
          updates.curriculumProgress ?? current.curriculumProgress,
      };

      const filePath = kidPath(kidId, "MEMORY.md");
      await fs.writeFile(filePath, formatMEMORYmd(merged), "utf-8");
    },

    async upsertSkill(kidId, skill) {
      const current = await this.getMemory(kidId);
      const idx = current.skillMap.findIndex(
        (s) => s.skill === skill.skill
      );
      if (idx >= 0) {
        current.skillMap[idx] = skill;
      } else {
        current.skillMap.push(skill);
      }
      await this.updateMemory(kidId, { skillMap: current.skillMap });
    },

    async appendStruggle(kidId, pattern) {
      const current = await this.getMemory(kidId);
      const existing = current.strugglePatterns.find(
        (p) => p.description === pattern.description
      );
      if (existing) {
        existing.frequency += 1;
        existing.whatHelps = pattern.whatHelps || existing.whatHelps;
      } else {
        current.strugglePatterns.push(pattern);
      }
      await this.updateMemory(kidId, {
        strugglePatterns: current.strugglePatterns,
      });
    },

    async updatePreferences(kidId, prefs) {
      const current = await this.getMemory(kidId);
      await this.updateMemory(kidId, {
        preferences: { ...current.preferences, ...prefs },
      });
    },

    async updateCurriculum(kidId, entry) {
      const current = await this.getMemory(kidId);
      const idx = current.curriculumProgress.findIndex(
        (c) => c.subject === entry.subject && c.topic === entry.topic
      );
      if (idx >= 0) {
        current.curriculumProgress[idx] = entry;
      } else {
        current.curriculumProgress.push(entry);
      }
      await this.updateMemory(kidId, {
        curriculumProgress: current.curriculumProgress,
      });
    },
  };
}

// ── Markdown Parser / Formatter ──

function parseMEMORYmd(content: string): Tier3Memory {
  const memory: Tier3Memory = {
    skillMap: [],
    strugglePatterns: [],
    preferences: {
      interests: [],
      formatPreference: "mixed",
      attentionSpanMinutes: 8,
      gamificationResponse: "high",
    },
    curriculumProgress: [],
  };

  // Parse skill map table
  const skillSection = content.match(/## Skill Map\n([\s\S]*?)(?=\n##|$)/);
  if (skillSection) {
    const rows = skillSection[1].match(/\|.+\|/g);
    if (rows) {
      rows.slice(1).forEach((row) => {
        // skip alignment row
        if (row.includes("---")) return;
        const cols = row.split("|").map((c) => c.trim()).filter(Boolean);
        if (cols.length >= 6) {
          memory.skillMap.push({
            skill: cols[0],
            status: cols[1] as SkillEntry["status"],
            proficiency: parseInt(cols[2]) || 0,
            lastPracticed: cols[3],
            notes: cols[4],
            subject: cols[0].includes("kokugo") ? "kokugo" : "sansuu",
          } as SkillEntry);
        }
      });
    }
  }

  // Parse struggle patterns
  const struggleSection = content.match(
    /## Struggle Patterns\n([\s\S]*?)(?=\n##|$)/
  );
  if (struggleSection) {
    const patterns = struggleSection[1].split(/(?=### )/);
    patterns.forEach((p) => {
      const match = p.match(
        /### (.+)\n- \*\*Since\*\*: (.+)\n- \*\*Frequency\*\*: (\d+)/
      );
      if (match) {
        const helpsMatch = p.match(/- \*\*What helps\*\*: (.+)/);
        memory.strugglePatterns.push({
          description: match[1].trim(),
          since: match[2].trim(),
          frequency: parseInt(match[3]),
          whatHelps: helpsMatch?.[1]?.trim() ?? "",
        });
      }
    });
  }

  // Parse preferences
  const prefSection = content.match(/## Preferences\n([\s\S]*?)(?=\n##|$)/);
  if (prefSection) {
    const text = prefSection[1];

    const interestMatches = text.matchAll(
      /- \*\*(.+?)\*\* \(([\d.]+)\)/g
    );
    for (const m of interestMatches) {
      memory.preferences.interests.push({
        topic: m[1].trim(),
        score: parseFloat(m[2]),
      });
    }

    const formatMatch = text.match(/- \*\*Format\*\*: (.+)/);
    if (formatMatch)
      memory.preferences.formatPreference = formatMatch[1].trim() as any;

    const spanMatch = text.match(/- \*\*Attention span\*\*: (.+)/);
    if (spanMatch) {
      memory.preferences.attentionSpanMinutes = parseInt(spanMatch[1]);
    }

    const gamifyMatch = text.match(/- \*\*Gamification response\*\*: (.+)/);
    if (gamifyMatch)
      memory.preferences.gamificationResponse = gamifyMatch[1].trim() as any;
  }

  // Parse curriculum progress
  const currSection = content.match(
    /## Curriculum Progress\n([\s\S]*?)(?=\n##|$)/
  );
  if (currSection) {
    const rows = currSection[1].match(/\|.+\|/g);
    if (rows) {
      rows.forEach((row) => {
        if (row.includes("---") || row.includes("Subject")) return;
        const cols = row.split("|").map((c) => c.trim()).filter(Boolean);
        if (cols.length >= 4) {
          memory.curriculumProgress.push({
            subject: cols[0] as CurriculumEntry["subject"],
            topic: cols[1],
            status: cols[2] as CurriculumEntry["status"],
            lastUpdated: cols[3],
          });
        }
      });
    }
  }

  return memory;
}

function formatMEMORYmd(memory: Tier3Memory): string {
  const lines: string[] = [];
  lines.push("# そうすけ — Memory");
  lines.push("");

  // Skill map
  lines.push("## Skill Map");
  lines.push("| Skill | Status | Proficiency | Last Practiced | Notes |");
  lines.push("|-------|--------|-------------|----------------|-------|");
  memory.skillMap.forEach((s) => {
    lines.push(
      `| ${s.skill} | ${s.status} | ${s.proficiency}/5 | ${s.lastPracticed} | ${s.notes} |`
    );
  });
  lines.push("");

  // Struggle patterns
  lines.push("## Struggle Patterns");
  memory.strugglePatterns.forEach((p) => {
    lines.push(`### ${p.description}`);
    lines.push(`- **Since**: ${p.since}`);
    lines.push(`- **Frequency**: ${p.frequency} sessions`);
    lines.push(`- **What helps**: ${p.whatHelps}`);
    lines.push("");
  });
  if (memory.strugglePatterns.length === 0) lines.push("*None yet*\n");

  // Preferences
  lines.push("## Preferences");
  memory.preferences.interests.forEach((i) => {
    lines.push(`- **${i.topic}** (${i.score})`);
  });
  lines.push(`- **Format**: ${memory.preferences.formatPreference}`);
  lines.push(`- **Attention span**: ${memory.preferences.attentionSpanMinutes} minutes`);
  lines.push(`- **Gamification response**: ${memory.preferences.gamificationResponse}`);
  lines.push("");

  // Curriculum
  lines.push("## Curriculum Progress");
  lines.push("| Subject | Topic | Status | Last Updated |");
  lines.push("|---------|-------|--------|--------------|");
  memory.curriculumProgress.forEach((c) => {
    lines.push(
      `| ${c.subject} | ${c.topic} | ${c.status} | ${c.lastUpdated} |`
    );
  });
  lines.push("");

  return lines.join("\n");
}
