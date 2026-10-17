import { parentPort } from "worker_threads";
import { promises as fs, Dirent } from "fs";
import path from "path";
import * as fileUtils from "./fileUtils";
import { mapPool, SIZE_CONCURRENCY } from "./mapPool";
import { Category, CacheMatch, PatternGroup, Project, WorkerMessage, WorkerResponse } from "../types/developer-cleaner";
import { isUnderUserPath } from "./deletionPolicy";
import { directoryExcludedByMarker, pathMatchesExclude } from "./excludeGlobs";

let isScanning = true;
let visitedDirectories = 0;

// Helper function to check if directory contains detection files
export async function checkProjectType(projectPath: string, categories: Category[]): Promise<Category[]> {
  const foundCategories: Category[] = [];

  try {
    const entries = await fs.readdir(projectPath, { withFileTypes: true });
    const fileNames = entries.map(entry => entry.name);

    for (const category of categories) {
      const hasDetectionFile = category.detectionFiles.some(pattern => {
        if (pattern.includes("*")) {
          return fileNames.some(file => globToRegExp(pattern).test(file));
        } else if (pattern.endsWith("/")) {
          // Check for directory
          return entries.some(
            entry => entry.isDirectory() && entry.name === pattern.slice(0, -1)
          );
        } else {
          // Check for exact file match
          return fileNames.includes(pattern);
        }
      });

      if (hasDetectionFile) {
        foundCategories.push(category);
      }
    }
  } catch (error) {
    console.warn("Error checking project type:", error);
  }

  return foundCategories;
}

export function globToRegExp(pattern: string): RegExp {
  const body = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${body}$`);
}

const SKIP_DIRECTORY_NAMES = new Set([
  "node_modules",
  ".git",
  "vendor",
  "Library",
  "Binaries",
  "Intermediate",
  "DerivedDataCache",
  "target",
  ".gradle",
  "Pods",
  "bower_components",
  ".venv",
  "venv"
]);

export const DEFAULT_DEV_SCAN_DEPTH = 6;

function isVendorPattern(pattern: string): boolean {
  const normalized = pattern.replace(/\\/g, "/").replace(/\/+$/, "");
  return normalized === "vendor" || normalized.endsWith("/vendor");
}

async function projectHasComposerLock(projectPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(path.join(projectPath, "composer.lock"));
    return stats.isFile();
  } catch {
    return false;
  }
}

// Helper function to expand glob patterns like "Plugins/**/Binaries/"
export async function expandGlobPattern(projectPath: string, pattern: string): Promise<string[]> {
  // Check if pattern contains glob wildcards
  if (!pattern.includes("*")) {
    // Simple pattern, return single path
    const fullPath = path.join(projectPath, pattern);
    return [fullPath];
  }

  const results: string[] = [];
  const parts = pattern.split("/").filter(part => part !== "");

  // Start searching from project root
  await searchGlobPattern(projectPath, parts, 0, results);

  // Remove duplicates by converting to Set and back to Array
  const uniqueResults = [...new Set(results)];

  return uniqueResults;
}

// Helper function to safely read directory entries
export async function readDirectoryEntries(dirPath: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

// Helper function to handle double asterisk (**) pattern
export async function handleDoubleAsteriskPattern(
  currentPath: string,
  patternParts: string[],
  partIndex: number,
  results: string[]
): Promise<void> {
  const nextPartIndex = partIndex + 1;

  if (nextPartIndex >= patternParts.length) {
    results.push(currentPath);
    return;
  }

  const nextPart = patternParts[nextPartIndex];

  // Try matching without consuming any directories (zero match)
  await searchGlobPattern(currentPath, patternParts, nextPartIndex, results);

  // Try matching by going into subdirectories (one or more match)
  await processDoubleAsteriskSubdirectories(
    currentPath,
    patternParts,
    partIndex,
    nextPartIndex,
    nextPart,
    results
  );
}

// Helper function to process subdirectories for double asterisk pattern
export async function processDoubleAsteriskSubdirectories(
  currentPath: string,
  patternParts: string[],
  partIndex: number,
  nextPartIndex: number,
  nextPart: string,
  results: string[]
): Promise<void> {
  const entries = await readDirectoryEntries(currentPath);

  for (const entry of entries) {
    if (!isScanning) return;
    if (entry.isDirectory()) {
      const subPath = path.join(currentPath, entry.name);

      if (entry.name === nextPart) {
        // Direct match with next part, skip **
        await searchGlobPattern(
          subPath,
          patternParts,
          nextPartIndex + 1,
          results
        );
      } else {
        // Continue searching deeper with ** still active
        await searchGlobPattern(subPath, patternParts, partIndex, results);
      }
    }
  }
}

// Helper function to handle single asterisk (*) pattern
export async function handleSingleAsteriskPattern(
  currentPath: string,
  patternParts: string[],
  partIndex: number,
  results: string[]
): Promise<void> {
  const entries = await readDirectoryEntries(currentPath);

  for (const entry of entries) {
    if (!isScanning) return;
    if (entry.isDirectory()) {
      const subPath = path.join(currentPath, entry.name);
      await searchGlobPattern(subPath, patternParts, partIndex + 1, results);
    }
  }
}

// Helper function to handle literal directory pattern
export async function handleLiteralPattern(
  currentPath: string,
  currentPart: string,
  patternParts: string[],
  partIndex: number,
  results: string[]
): Promise<void> {
  const nextPath = path.join(currentPath, currentPart);
  try {
    const stats = await fs.stat(nextPath);
    if (stats.isDirectory()) {
      await searchGlobPattern(nextPath, patternParts, partIndex + 1, results);
    }
  } catch (error) {
    console.warn("Error handling literal pattern:", error);
  }
}

// Recursive function to search for glob pattern matches
export async function searchGlobPattern(
  currentPath: string,
  patternParts: string[],
  partIndex: number,
  results: string[]
): Promise<void> {
  if (partIndex >= patternParts.length) {
    results.push(currentPath);
    return;
  }

  const currentPart = patternParts[partIndex];

  if (currentPart === "**") {
    await handleDoubleAsteriskPattern(
      currentPath,
      patternParts,
      partIndex,
      results
    );
  } else if (currentPart === "*") {
    await handleSingleAsteriskPattern(
      currentPath,
      patternParts,
      partIndex,
      results
    );
  } else {
    await handleLiteralPattern(
      currentPath,
      currentPart,
      patternParts,
      partIndex,
      results
    );
  }
}

type CacheMeasurement = {
  size: number;
  modifiedAt: string | null;
};

async function measureCachePath(cachePath: string): Promise<CacheMeasurement | null> {
  try {
    const stats = await fs.stat(cachePath);
    const modifiedAt = stats.mtime instanceof Date ? stats.mtime.toISOString() : null;
    if (!stats.isDirectory()) {
      return { size: stats.size, modifiedAt };
    }
    const size = await fileUtils.getDirSize(cachePath, () => isScanning);
    return { size, modifiedAt };
  } catch {
    return null;
  }
}

// Helper function to process a single matching path
export async function processMatchingPath(
  cachePath: string,
  projectPath: string,
  category: Category,
  pattern: string,
  allMatches: Map<string, CacheMatch>
): Promise<number> {
  const measured = await measureCachePath(cachePath);
  if (!measured) return 0;

  if (measured.size > 0) {
    addMatchToCollection(
      cachePath,
      projectPath,
      measured.size,
      category,
      pattern,
      allMatches,
      measured.modifiedAt
    );
  }

  return measured.size;
}

// Helper function to add a match to the collection
export function addMatchToCollection(
  cachePath: string,
  projectPath: string,
  size: number,
  category: Category,
  pattern: string,
  allMatches: Map<string, CacheMatch>,
  modifiedAt?: string | null
): void {
  const normalizedPath = cachePath.toLowerCase();
  const relativePath = path.relative(projectPath, cachePath);

  if (allMatches.has(normalizedPath)) {
    // Path already found by another pattern, combine the pattern info
    const existing = allMatches.get(normalizedPath)!;

    if (!existing.categories.includes(category.name)) {
      existing.categories.push(category.name);
    }
    if (!existing.patterns.includes(pattern)) {
      existing.patterns.push(pattern);
    }
    if (existing.modifiedAt == null && modifiedAt != null) {
      existing.modifiedAt = modifiedAt;
    }
  } else {
    // New path, add it
    allMatches.set(normalizedPath, {
      path: cachePath,
      relativePath: relativePath,
      size: size,
      selected: false,
      categories: [category.name],
      patterns: [pattern],
      modifiedAt: modifiedAt ?? null
    });
  }
}

// Helper function to process a single cache pattern
export async function processCachePattern(
  projectPath: string,
  category: Category,
  pattern: string,
  allMatches: Map<string, CacheMatch>
): Promise<number> {
  if (isVendorPattern(pattern) && !(await projectHasComposerLock(projectPath))) {
    return 0;
  }

  let patternSize = 0;

  try {
    const matchingPaths = await expandGlobPattern(projectPath, pattern);
    const measured = await mapPool(
      matchingPaths,
      SIZE_CONCURRENCY,
      cachePath => measureCachePath(cachePath),
      () => isScanning
    );

    // Record matches only after the pool so one path cannot be inserted twice.
    for (let index = 0; index < measured.length; index++) {
      const item = measured[index];
      if (!item || typeof item.size !== "number") continue;
      patternSize += item.size;
      if (item.size <= 0) continue;
      addMatchToCollection(
        matchingPaths[index],
        projectPath,
        item.size,
        category,
        pattern,
        allMatches,
        item.modifiedAt
      );
    }
  } catch {  }

  return patternSize;
}

// Helper function to create pattern groups from matches
export function createPatternGroups(allMatches: Map<string, CacheMatch>): PatternGroup[] {
  const patternGroups = new Map<string, PatternGroup>();

  for (const match of allMatches.values()) {
    const primaryPattern = match.patterns[0];
    const primaryCategory = match.categories[0];
    const patternKey = `${primaryCategory}:${primaryPattern}`;

    if (patternGroups.has(patternKey)) {
      const existing = patternGroups.get(patternKey)!;
      existing.matches.push(match);
      existing.totalSize += match.size;
    } else {
      patternGroups.set(patternKey, {
        pattern: primaryPattern,
        category: primaryCategory,
        matches: [match],
        totalSize: match.size,
        selectedSize: 0,
        expanded: false
      });
    }
  }

  return Array.from(patternGroups.values());
}

// Helper function to calculate cache sizes for a project
export async function calculateCacheSizes(projectPath: string, categories: Category[]): Promise<{ caches: PatternGroup[]; totalSize: number }> {
  const allMatches = new Map<string, CacheMatch>();

  for (const category of categories) {
    for (const pattern of category.cachePatterns) {
      await processCachePattern(projectPath, category, pattern, allMatches);
    }
  }

  const totalSize = Array.from(allMatches.values()).reduce(
    (sum, match) => sum + match.size,
    0
  );

  // Second pass: group by primary pattern for display
  const caches = createPatternGroups(allMatches);

  return { caches, totalSize };
}

function cachesOutsideProtectedPaths(
  caches: PatternGroup[],
  totalSize: number,
  protectedPaths: readonly string[],
  excludeGlobs: readonly string[] = []
): { caches: PatternGroup[]; totalSize: number } {
  if (protectedPaths.length === 0 && excludeGlobs.length === 0) return { caches, totalSize };

  const hidden = (matchPath: string) =>
    isUnderUserPath(matchPath, protectedPaths) || pathMatchesExclude(matchPath, excludeGlobs);

  const visible: PatternGroup[] = [];
  for (const group of caches) {
    const matches = group.matches.filter(match => !hidden(match.path));
    if (matches.length === 0) continue;
    const groupSize = matches.reduce((sum, match) => sum + match.size, 0);
    const selectedSize = matches.reduce(
      (sum, match) => sum + (match.selected ? match.size : 0),
      0
    );
    visible.push({ ...group, matches, totalSize: groupSize, selectedSize });
  }

  const seen = new Set<string>();
  let visibleSize = 0;
  for (const group of visible) {
    for (const match of group.matches) {
      if (seen.has(match.path)) continue;
      seen.add(match.path);
      visibleSize += match.size;
    }
  }

  return { caches: visible, totalSize: visibleSize };
}

// Recursive function to scan for developer projects
export async function scanDeveloperProjectsRecursive(
  dirPath: string,
  enabledCategories: Category[],
  projects: Project[],
  currentDepth: number,
  maxDepth: number,
  protectedPaths: readonly string[] = [],
  excludeGlobs: readonly string[] = []
): Promise<void> {
  if (currentDepth > maxDepth) return;
  if (isUnderUserPath(dirPath, protectedPaths) || pathMatchesExclude(dirPath, excludeGlobs)) return;

  try {
    if (!parentPort) throw new Error("Worker thread parent port not available");
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    visitedDirectories += 1;
    parentPort.postMessage({
      type: "current-path",
      path: dirPath,
      visited: visitedDirectories
    } as WorkerResponse);
    const fileNames = entries.filter(entry => !entry.isDirectory()).map(entry => entry.name);
    if (directoryExcludedByMarker(fileNames, excludeGlobs)) return;

    // Check if current directory is a project
    const foundCategories = await checkProjectType(dirPath, enabledCategories);

    if (foundCategories.length > 0) {
      // This is a development project
      const sized = await calculateCacheSizes(dirPath, foundCategories);
      const { caches, totalSize } = cachesOutsideProtectedPaths(
        sized.caches,
        sized.totalSize,
        protectedPaths,
        excludeGlobs
      );

      if (totalSize > 0) {
        // Get directory's last modified time
        let lastModified: string | null;
        try {
          const stats = await fs.stat(dirPath);
          lastModified = stats.mtime.toISOString();
        } catch {
          lastModified = null;
        }

        const project: Project = {
          path: dirPath,
          type: foundCategories.map(cat => cat.name).join(", "),
          caches: caches,
          totalCacheSize: totalSize,
          lastModified: lastModified
        };

        projects.push(project);

        // Send real-time update
        parentPort.postMessage({ type: "project-found", project } as WorkerResponse);
      }

      // If this directory matches project detection but has no caches,
      // continue scanning subdirectories (might be a parent directory with projects inside)
    }

    // Recurse into subdirectories
    for (const entry of entries) {
      if (!isScanning) return;
      if (entry.isDirectory() && !SKIP_DIRECTORY_NAMES.has(entry.name)) {
        const fullPath = path.join(dirPath, entry.name);
        await scanDeveloperProjectsRecursive(
          fullPath,
          enabledCategories,
          projects,
          currentDepth + 1,
          maxDepth,
          protectedPaths,
          excludeGlobs
        );
      }
    }
  } catch (error) {
    console.warn("Error scanning directory:", error);
  }
}

// Main scan function
export async function scanDeveloperProjects(
  basePaths: string[],
  enabledCategories: Category[],
  maxDepth = DEFAULT_DEV_SCAN_DEPTH,
  protectedPaths: readonly string[] = [],
  excludeGlobs: readonly string[] = []
): Promise<Project[]> {
  const projects: Project[] = [];

  isScanning = true;
  visitedDirectories = 0;
  for (const basePath of basePaths) {
    try {
      if (!isScanning) return projects;
      await scanDeveloperProjectsRecursive(
        basePath,
        enabledCategories,
        projects,
        0,
        maxDepth,
        protectedPaths,
        excludeGlobs
      );
    } catch (error) {
      console.error(`Error scanning ${basePath}:`, error);
    }
  }

  return projects;
}

// Listen for messages from the main thread
if (parentPort) {
  parentPort.on("message", async (message: WorkerMessage) => {
    try {
      if (message.type === "stop") {
        isScanning = false;
        return;
      }

      // Set userDataPath if provided
      if (message.userDataPath) {
        fileUtils.setUserDataPath(message.userDataPath);
      }

      // enabledCategories already contains the full category objects from the frontend
      const maxDepth =
        typeof message.maxDepth === "number" ? message.maxDepth : DEFAULT_DEV_SCAN_DEPTH;
      const projects = await scanDeveloperProjects(
        message.basePaths,
        message.enabledCategories,
        maxDepth,
        message.protectedPaths ?? [],
        message.excludeGlobs ?? []
      );

      console.log(`Developer scan completed. Found ${projects.length} projects`);
      parentPort?.postMessage({ type: "done", projects } as WorkerResponse);
    } catch (error) {
      console.error("Developer scan worker error:", error);
      parentPort?.postMessage({ type: "error", error: (error as Error).message } as WorkerResponse);
    }
  });
} 