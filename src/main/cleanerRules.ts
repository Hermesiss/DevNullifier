import { promises as fs } from "fs";
import path from "path";
import { getUserDataPath } from "./fileUtils";

export interface CleanerRules {
  permanentDelete: boolean; // default false
  protectedPaths: string[];
  excludeGlobs: string[];
  minAgeDays: number | null;
  minSizeMb: number | null;
}

function defaultCleanerRules(): CleanerRules {
  return {
    permanentDelete: false,
    protectedPaths: [],
    excludeGlobs: [],
    minAgeDays: null,
    minSizeMb: null
  };
}

function rulesPath(): string {
  return path.join(getUserDataPath(), "cleaner-rules.json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return value.filter((item): item is string => typeof item === "string");
}

function numberOrNull(value: unknown, fallback: number | null): number | null {
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

function mergeRules(base: CleanerRules, partial: unknown): CleanerRules {
  if (!isRecord(partial)) {
    return {
      ...base,
      protectedPaths: [...base.protectedPaths],
      excludeGlobs: [...base.excludeGlobs]
    };
  }

  return {
    permanentDelete:
      typeof partial.permanentDelete === "boolean" ? partial.permanentDelete : base.permanentDelete,
    protectedPaths: stringArray(partial.protectedPaths, base.protectedPaths),
    excludeGlobs: stringArray(partial.excludeGlobs, base.excludeGlobs),
    minAgeDays: numberOrNull(partial.minAgeDays, base.minAgeDays),
    minSizeMb: numberOrNull(partial.minSizeMb, base.minSizeMb)
  };
}

export async function loadCleanerRules(): Promise<CleanerRules> {
  const filePath = rulesPath();
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return mergeRules(defaultCleanerRules(), JSON.parse(data));
  } catch {
    return defaultCleanerRules();
  }
}

export async function saveCleanerRules(partial: Partial<CleanerRules> = {}): Promise<CleanerRules> {
  const next = mergeRules(await loadCleanerRules(), partial);
  await fs.writeFile(rulesPath(), JSON.stringify(next, null, 2), "utf-8");
  return next;
}

export async function permanentRemove(target: string): Promise<void> {
  await fs.rm(target, { recursive: true });
}
