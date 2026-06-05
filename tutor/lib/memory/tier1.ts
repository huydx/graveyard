import { Message } from "@/types";
import { kidPath, ensureDir, fileExists, readFileSafe } from "../storage";
import fs from "fs/promises";
import path from "path";

/**
 * Tier 1: Working Memory
 * Current session's raw messages stored as append-only JSONL.
 */
export interface Tier1Provider {
  appendMessage(kidId: string, sessionId: string, message: Message): Promise<void>;
  getMessages(kidId: string, sessionId: string): Promise<Message[]>;
  getSessionPath(kidId: string, date: string): string;
}

export function createTier1(): Tier1Provider {
  return {
    async appendMessage(kidId, sessionId, message) {
      const date = sessionId.split("-").slice(0, 3).join("-"); // Extract YYYY-MM-DD
      const filePath = kidPath(kidId, "sessions", `${date}.jsonl`);
      await ensureDir(path.dirname(filePath));
      const line = JSON.stringify(message) + "\n";
      await fs.appendFile(filePath, line, "utf-8");
    },

    async getMessages(kidId, sessionId) {
      const date = sessionId.split("-").slice(0, 3).join("-");
      const filePath = kidPath(kidId, "sessions", `${date}.jsonl`);
      const raw = await readFileSafe(filePath);
      if (!raw) return [];

      return raw
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Message)
        .filter((m) => m.sessionId === sessionId);
    },

    getSessionPath(kidId, date) {
      return kidPath(kidId, "sessions", `${date}.jsonl`);
    },
  };
}
