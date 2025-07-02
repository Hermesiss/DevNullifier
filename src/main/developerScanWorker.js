const { parentPort } = require("worker_threads");
const fs = require("fs").promises;
const path = require("path");

// Categories will be passed from the frontend - no hardcoded categories needed

// Helper function to check if directory contains detection files
async function checkProjectType(projectPath, categories) {
  const foundCategories = [];

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
    // Skip directories that can't be accessed
  }

  return foundCategories;
}

// Calculate directory size
async function getDirSize(dirPath) {
  let size = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        size += await getDirSize(fullPath);
      } else {
        try {
          const stats = await fs.stat(fullPath);
          size += stats.size;
        } catch (err) {
          // Skip files that can't be accessed
        }
      }
    }
  } catch (err) {
    // Skip directories that can't be accessed
  }

  return size;
}

// Helper function to expand glob patterns like "Plugins/**/Binaries/"
async function expandGlobPattern(projectPath, pattern) {
  // Check if pattern contains glob wildcards
  if (!pattern.includes("*")) {
    // Simple pattern, return single path
    const fullPath = path.join(projectPath, pattern);
    return [fullPath];
  }

  const results = [];
  const parts = pattern.split("/").filter(part => part !== "");

  // Start searching from project root
  await searchGlobPattern(projectPath, parts, 0, results);

  // Remove duplicates by converting to Set and back to Array
  const uniqueResults = [...new Set(results)];

  return uniqueResults;
}

// Helper function to safely read directory entries
async function readDirectoryEntries(dirPath) {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    return [];
  }
}

// Helper function to handle double asterisk (**) pattern
async function handleDoubleAsteriskPattern(
  currentPath,
  patternParts,
  partIndex,
  results
) {
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
async function processDoubleAsteriskSubdirectories(
  currentPath,
  patternParts,
  partIndex,
  nextPartIndex,
  nextPart,
  results
) {
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
async function handleSingleAsteriskPattern(
  currentPath,
  patternParts,
  partIndex,
  results
) {
  const entries = await readDirectoryEntries(currentPath);

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subPath = path.join(currentPath, entry.name);
      await searchGlobPattern(subPath, patternParts, partIndex + 1, results);
    }
  }
}

// Helper function to handle literal directory pattern
async function handleLiteralPattern(
  currentPath,
  currentPart,
  patternParts,
  partIndex,
  results
) {
  const nextPath = path.join(currentPath, currentPart);
  try {
    const stats = await fs.stat(nextPath);
    if (stats.isDirectory()) {
      await searchGlobPattern(nextPath, patternParts, partIndex + 1, results);
    }
  } catch (error) {
    // Directory doesn't exist or can't be accessed, skip
  }
}

// Recursive function to search for glob pattern matches
async function searchGlobPattern(
  currentPath,
  patternParts,
  partIndex,
  results
) {
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
async function processMatchingPath(
  cachePath,
  projectPath,
  category,
  pattern,
  allMatches
) {
  let exists = false;
  let isDirectory = false;

  try {
    const stats = await fs.stat(cachePath);
    exists = true;
    isDirectory = stats.isDirectory();
  } catch (error) {
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
function addMatchToCollection(
  cachePath,
  projectPath,
  size,
  category,
  pattern,
  allMatches
) {
  const normalizedPath = cachePath.toLowerCase();
  const relativePath = path.relative(projectPath, cachePath);

  if (allMatches.has(normalizedPath)) {
    // Path already found by another pattern, combine the pattern info
    const existing = allMatches.get(normalizedPath);

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
async function processCachePattern(projectPath, category, pattern, allMatches) {
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
  } catch (error) {
    console.error(
      `Error processing cache pattern '${pattern}' in ${projectPath}:`,
      error
    );
  }

  return patternSize;
}

// Helper function to create pattern groups from matches
function createPatternGroups(allMatches) {
  const patternGroups = new Map();

  for (const match of allMatches.values()) {
    const primaryPattern = match.patterns[0];
    const primaryCategory = match.categories[0];
    const patternKey = `${primaryCategory}:${primaryPattern}`;

    if (patternGroups.has(patternKey)) {
      const existing = patternGroups.get(patternKey);
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
async function calculateCacheSizes(projectPath, categories) {
  const allMatches = new Map();
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
async function scanDeveloperProjectsRecursive(
  dirPath,
  enabledCategories,
  projects,
  currentDepth,
  maxDepth
) {
  if (currentDepth > maxDepth) return;

  try {
    parentPort.postMessage({ type: "current-path", path: dirPath });

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
        let lastModified;
        try {
          const stats = await fs.stat(dirPath);
          lastModified = stats.mtime.toISOString();
        } catch (error) {
          lastModified = null;
        }

        const project = {
          path: dirPath,
          type: foundCategories.map(cat => cat.name).join(", "),
          caches: caches,
          totalCacheSize: totalSize,
          lastModified: lastModified
        };

        projects.push(project);

        // Send real-time update
        parentPort.postMessage({ type: "project-found", project });

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
    // Skip directories that can't be accessed
  }
}

// Main scan function
async function scanDeveloperProjects(basePaths, enabledCategories) {
  const projects = [];

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
parentPort.on("message", async ({ basePaths, enabledCategories }) => {
  try {
    console.log("Developer scan worker started with:", {
      basePaths: basePaths,
      categoryCount: enabledCategories.length,
      categoryNames: enabledCategories.map(cat => cat.name)
    });

    // enabledCategories already contains the full category objects from the frontend
    const projects = await scanDeveloperProjects(basePaths, enabledCategories);

    console.log(`Developer scan completed. Found ${projects.length} projects`);
    parentPort.postMessage({ type: "done", projects });
  } catch (error) {
    console.error("Developer scan worker error:", error);
    parentPort.postMessage({ type: "error", error: error.message });
  }
});
