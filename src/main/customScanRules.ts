import { promises as fs } from "fs";
import path from "path";
import { KEYWORDS } from "./appDataCleaner";
import { getUserDataPath } from "./fileUtils";

export interface CustomCategory {
  id: string;
  name: string;
  detectionFiles: string[];
  cachePatterns: string[];
}

export interface CustomCategoryDraft {
  name: string;
  detectionFiles: string[];
  cachePatterns: string[];
}

export interface CustomScanRules {
  categories: CustomCategory[];
  keywords: string[];
}

export interface CustomScanRulesUpdate {
  categories?: CustomCategoryDraft[];
  keywords?: string[];
}

/** Ids from DeveloperCleaner.vue. A custom id must not replace one of these. */
export const builtinCategoryIds = new Set<string>([
  "python",
  "nodejs",
  "unity",
  "unreal",
  "rust",
  "java",
  "dotnet",
  "cpp",
  "xcode",
  "php",
  "symfony",
  "ml",
  "docker",
  "static",
  "testing",
  "ides"
]);

function defaultCustomScanRules(): CustomScanRules {
  return { categories: [], keywords: [] };
}

function rulesPath(): string {
  return path.join(getUserDataPath(), "custom-scan-rules.json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneCategory(category: CustomCategory): CustomCategory {
  return {
    id: category.id,
    name: category.name,
    detectionFiles: [...category.detectionFiles],
    cachePatterns: [...category.cachePatterns]
  };
}

function cloneRules(rules: CustomScanRules): CustomScanRules {
  return {
    categories: rules.categories.map(cloneCategory),
    keywords: [...rules.keywords]
  };
}

export function slugifyCategoryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function allocateId(slug: string, used: Set<string>): string | null {
  if (!slug) return null;

  for (let attempt = 1; attempt < 1000; attempt += 1) {
    const suffix = attempt === 1 ? "" : `-${attempt}`;
    const candidate = `custom-${slug}${suffix}`;
    const id = builtinCategoryIds.has(candidate) ? `${candidate}-custom` : candidate;
    if (!used.has(id) && !builtinCategoryIds.has(id)) {
      used.add(id);
      return id;
    }
  }

  return null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed) items.push(trimmed);
  }
  return items;
}

function sanitizeCategories(value: unknown): CustomCategory[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  const categories: CustomCategory[] = [];

  for (const item of value) {
    if (!isRecord(item) || typeof item.name !== "string") continue;
    const name = item.name.trim();
    if (!name) continue;
    const detectionFiles = stringList(item.detectionFiles);
    const cachePatterns = stringList(item.cachePatterns);
    if (detectionFiles.length === 0 || cachePatterns.length === 0) continue;
    const id = allocateId(slugifyCategoryName(name), used);
    if (!id) continue;
    categories.push({ id, name, detectionFiles, cachePatterns });
  }

  return categories;
}

export function mergeKeywords(builtIn: readonly string[], custom: readonly string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  const add = (keyword: string) => {
    if (typeof keyword !== "string") return;
    const trimmed = keyword.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(trimmed);
  };

  for (const keyword of builtIn) add(keyword);
  for (const keyword of custom) add(keyword);
  return merged;
}

function sanitizeKeywords(value: unknown): string[] {
  const incoming = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
  const builtIn = new Set(KEYWORDS.map(keyword => keyword.trim().toLowerCase()));
  return mergeKeywords([], incoming).filter(keyword => !builtIn.has(keyword.toLowerCase()));
}

function hasArrayField(partial: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(partial, key) && Array.isArray(partial[key]);
}

function mergeCustomScanRules(base: CustomScanRules, partial: unknown): CustomScanRules {
  if (!isRecord(partial)) return cloneRules(base);

  return {
    categories: hasArrayField(partial, "categories")
      ? sanitizeCategories(partial.categories)
      : base.categories.map(cloneCategory),
    keywords: hasArrayField(partial, "keywords")
      ? sanitizeKeywords(partial.keywords)
      : [...base.keywords]
  };
}

export async function loadCustomScanRules(): Promise<CustomScanRules> {
  try {
    const data = await fs.readFile(rulesPath(), "utf-8");
    return mergeCustomScanRules(defaultCustomScanRules(), JSON.parse(data));
  } catch {
    return defaultCustomScanRules();
  }
}

export async function saveCustomScanRules(
  partial: CustomScanRulesUpdate = {}
): Promise<CustomScanRules> {
  const next = mergeCustomScanRules(await loadCustomScanRules(), partial);
  await fs.writeFile(rulesPath(), JSON.stringify(next, null, 2), "utf-8");
  return next;
}
