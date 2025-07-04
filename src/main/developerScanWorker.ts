import { parentPort } from "worker_threads";
import { promises as fs, Dirent } from "fs";
import path from "path";
import { getDirSize } from "./fileUtils";
import { Category, CacheMatch, PatternGroup, Project, WorkerMessage, WorkerResponse } from "../types/developer-cleaner";

// Helper function to check if directory contains detection files
export async function checkProjectType(projectPath: string, categories: Category[]): Promise<Category[]> {
  const foundCategories: Category[] = [];

  try {
    const entries = await fs.readdir(projectPath, { withFileTypes: true });
    const fileNames = entries.map(entry => entry.name);

    for (const category of categories) {
      const hasDetectionFile = category.detectionFiles.some(pattern => {
        if (pattern.includes("*")) {
          // Handle wildcard patterns
          const regex = new RegExp(pattern.replace(/\*/g, ".*"));
          return fileNames.some(file => regex.test(file));
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

// Helper function to process a single matching path
export async function processMatchingPath(
  cachePath: string,
  projectPath: string,
  category: Category,
  pattern: string,
  allMatches: Map<string, CacheMatch>
): Promise<number> {
  let exists = false;
  let isDirectory = false;

  try {
    const stats = await fs.stat(cachePath);
    exists = true;
    isDirectory = stats.isDirectory();
  } catch {
    return 0; // Path doesn't exist, return 0 size
  }

  if (!exists) return 0;

  let size = 0;
  if (isDirectory) {
    size = await getDirSize(cachePath);
  } else {
    const stats = await fs.stat(cachePath);
    size = stats.size;
  }

  if (size > 0) {
    addMatchToCollection(
      cachePath,
      projectPath,
      size,
      category,
      pattern,
      allMatches
    );
  }

  return size;
}

// Helper function to add a match to the collection
export function addMatchToCollection(
  cachePath: string,
  projectPath: string,
  size: number,
  category: Category,
  pattern: string,
  allMatches: Map<string, CacheMatch>
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
  } else {
    // New path, add it
    allMatches.set(normalizedPath, {
      path: cachePath,
      relativePath: relativePath,
      size: size,
      selected: false,
      categories: [category.name],
      patterns: [pattern]
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
  let patternSize = 0;

  try {
    const matchingPaths = await expandGlobPattern(projectPath, pattern);

    for (const cachePath of matchingPaths) {
      const size = await processMatchingPath(
        cachePath,
        projectPath,
        category,
        pattern,
        allMatches
      );
      patternSize += size;
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
  let totalSize = 0;

  // First pass: collect all matches grouped by actual path
  for (const category of categories) {
    for (const pattern of category.cachePatterns) {
      const patternSize = await processCachePattern(
        projectPath,
        category,
        pattern,
        allMatches
      );
      totalSize += patternSize;
    }
  }

  // Second pass: group by primary pattern for display
  const caches = createPatternGroups(allMatches);

  return { caches, totalSize };
}

// Recursive function to scan for developer projects
export async function scanDeveloperProjectsRecursive(
  dirPath: string,
  enabledCategories: Category[],
  projects: Project[],
  currentDepth: number,
  maxDepth: number
): Promise<void> {
  if (currentDepth > maxDepth) return;

  try {
    if (!parentPort) throw new Error("Worker thread parent port not available");
    parentPort.postMessage({ type: "current-path", path: dirPath } as WorkerResponse);

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    // Check if current directory is a project
    const foundCategories = await checkProjectType(dirPath, enabledCategories);

    if (foundCategories.length > 0) {
      // This is a development project
      const { caches, totalSize } = await calculateCacheSizes(
        dirPath,
        foundCategories
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

        // Only stop recursing if we found a project WITH caches to avoid nested scans
        // If no caches found, continue scanning subdirectories
        return;
      }

      // If this directory matches project detection but has no caches,
      // continue scanning subdirectories (might be a parent directory with projects inside)
    }

    // Recurse into subdirectories
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(dirPath, entry.name);
        await scanDeveloperProjectsRecursive(
          fullPath,
          enabledCategories,
          projects,
          currentDepth + 1,
          maxDepth
        );
      }
    }
  } catch (error) {
    console.warn("Error scanning directory:", error);
  }
}

// Main scan function
export async function scanDeveloperProjects(basePaths: string[], enabledCategories: Category[]): Promise<Project[]> {
  const projects: Project[] = [];

  for (const basePath of basePaths) {
    try {
      await scanDeveloperProjectsRecursive(
        basePath,
        enabledCategories,
        projects,
        0,
        10 // Max depth of 10
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
      // enabledCategories already contains the full category objects from the frontend
      const projects = await scanDeveloperProjects(message.basePaths, message.enabledCategories);

      console.log(`Developer scan completed. Found ${projects.length} projects`);
      parentPort?.postMessage({ type: "done", projects } as WorkerResponse);
    } catch (error) {
      console.error("Developer scan worker error:", error);
      parentPort?.postMessage({ type: "error", error: (error as Error).message } as WorkerResponse);
    }
  });
} 