import fs from "fs/promises";
import path from "path";
import os from "os";

const TUTOR_HOME = path.join(os.homedir(), ".tutor");

export function tutorPath(...segments: string[]): string {
  return path.join(TUTOR_HOME, ...segments);
}

export function kidPath(kidId: string, ...segments: string[]): string {
  return path.join(TUTOR_HOME, "kids", kidId, ...segments);
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function ensureTutorDirs(kidId: string): Promise<void> {
  await ensureDir(kidPath(kidId, "memory"));
  await ensureDir(kidPath(kidId, "sessions"));
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}
