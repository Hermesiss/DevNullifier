const fs = require("fs").promises;
const path = require("path");

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

// Calculate directory size (used by calculateCacheSizes)
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

// Recursive function to search for glob pattern matches
async function searchGlobPattern(
  currentPath,
  patternParts,
  partIndex,
  results
) {
  if (partIndex >= patternParts.length) {
    // We've matched all parts, add to results
    results.push(currentPath);
    return;
  }

  const currentPart = patternParts[partIndex];

  if (currentPart === "**") {
    // Double asterisk - match zero or more directories
    const nextPartIndex = partIndex + 1;

    if (nextPartIndex >= patternParts.length) {
      // ** is the last part, match current directory
      results.push(currentPath);
      return;
    }

    const nextPart = patternParts[nextPartIndex];

    // Try matching without consuming any directories (zero match)
    await searchGlobPattern(currentPath, patternParts, nextPartIndex, results);

    // Try matching by going into subdirectories (one or more match)
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = path.join(currentPath, entry.name);

          // Check if this directory matches the next part after **
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
    } catch (error) {
      // Can't read directory, skip
    }
  } else if (currentPart === "*") {
    // Single asterisk - match any single directory name
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = path.join(currentPath, entry.name);
          await searchGlobPattern(
            subPath,
            patternParts,
            partIndex + 1,
            results
          );
        }
      }
    } catch (error) {
      // Can't read directory, skip
    }
  } else {
    // Literal directory name
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
}

// Helper function to calculate cache sizes for a project
async function calculateCacheSizes(projectPath, categories) {
  const allMatches = new Map(); // Map by actual path to collect all pattern info
  let totalSize = 0;

  // First pass: collect all matches grouped by actual path
  for (const category of categories) {
    for (const pattern of category.cachePatterns) {
      try {
        // Expand glob pattern to get all matching paths
        const matchingPaths = await expandGlobPattern(projectPath, pattern);

        for (const cachePath of matchingPaths) {
          // Check if cache directory/file exists
          let exists = false;
          let isDirectory = false;

          try {
            const stats = await fs.stat(cachePath);
            exists = true;
            isDirectory = stats.isDirectory();
          } catch (error) {
            // Path doesn't exist, skip
            continue;
          }

          if (exists) {
            let size = 0;
            if (isDirectory) {
              size = await getDirSize(cachePath);
            } else {
              const stats = await fs.stat(cachePath);
              size = stats.size;
            }

            if (size > 0) {
              const normalizedPath = cachePath.toLowerCase();
              const relativePath = path.relative(projectPath, cachePath);

              if (allMatches.has(normalizedPath)) {
                // Path already found by another pattern, combine the pattern info
                const existing = allMatches.get(normalizedPath);

                // Add category and pattern if not already included
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
                totalSize += size;
              }
            }
          }
        }
      } catch (error) {
        // Skip cache patterns that can't be processed
        console.error(
          `Error processing cache pattern '${pattern}' in ${projectPath}:`,
          error
        );
      }
    }
  }

  // Second pass: group by primary pattern for display
  const patternGroups = new Map();

  for (const match of allMatches.values()) {
    // Use the first pattern as the primary grouping key
    const primaryPattern = match.patterns[0];
    const primaryCategory = match.categories[0];
    const patternKey = `${primaryCategory}:${primaryPattern}`;

    // Create display name showing all patterns if multiple
    const displayPattern = primaryPattern;

    // Create display category showing all categories if multiple
    const displayCategory = primaryCategory;

    if (patternGroups.has(patternKey)) {
      // Add to existing group
      const existing = patternGroups.get(patternKey);
      existing.matches.push(match);
      existing.totalSize += match.size;
    } else {
      // Create new pattern group
      patternGroups.set(patternKey, {
        pattern: displayPattern,
        category: displayCategory,
        matches: [match],
        totalSize: match.size,
        selectedSize: 0,
        expanded: false
      });
    }
  }

  // Convert map to array
  const caches = Array.from(patternGroups.values());

  return { caches, totalSize };
}

// Recursive function to scan for developer projects
async function scanDeveloperProjectsRecursive(
  dirPath,
  enabledCategories,
  projects,
  currentDepth,
  maxDepth,
  progressCallback
) {
  if (currentDepth > maxDepth) return;

  try {
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

        // Send real-time update via callback
        if (progressCallback) {
          progressCallback.onProjectFound(project);
        }

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
          maxDepth,
          progressCallback
        );
      }
    }
  } catch (error) {
    // Skip directories that can't be accessed
  }
}

// Scan for developer projects
async function scanDeveloperProjects(
  basePaths,
  enabledCategories,
  progressCallback
) {
  const projects = [];

  for (const basePath of basePaths) {
    try {
      await scanDeveloperProjectsRecursive(
        basePath,
        enabledCategories,
        projects,
        0,
        10, // Max depth of 10
        progressCallback
      );
    } catch (error) {
      console.error(`Error scanning ${basePath}:`, error);
    }
  }

  return projects;
}

module.exports = {
  checkProjectType,
  calculateCacheSizes,
  scanDeveloperProjects,
  scanDeveloperProjectsRecursive,
  expandGlobPattern,
  searchGlobPattern
};
