const { parentPort } = require("worker_threads");
const path = require("path");
const fs = require("fs").promises;

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

// Scan directories for matching folders
async function scanDirectory(dirPath, maxDepth, keywords, currentDepth = 0) {
  const results = [];

  if (maxDepth > 0 && currentDepth > maxDepth) {
    return results;
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const fullPath = path.join(dirPath, entry.name);
      const folderName = entry.name.toLowerCase();

      // Check if folder name contains any keywords
      if (keywords.some(keyword => folderName.includes(keyword))) {
        try {
          const size = await getDirSize(fullPath);
          if (size > 0) {
            const folder = {
              path: fullPath,
              size: size,
              name: entry.name
            };

            results.push(folder);
            parentPort.postMessage({ type: "folder-found", folder });
          }
        } catch (err) {
          // Skip folders that can't be accessed
        }
        continue;
      }

      // Recurse into subdirectories
      try {
        const subResults = await scanDirectory(
          fullPath,
          maxDepth,
          keywords,
          currentDepth + 1
        );
        results.push(...subResults);
      } catch (err) {
        // Skip directories that can't be accessed
      }
    }
  } catch (err) {
    // Skip directories that can't be accessed
  }

  return results;
}

// Listen for messages from the main thread
parentPort.on("message", async ({ paths, maxDepth, keywords }) => {
  const allResults = [];
  let totalCount = 0;

  try {
    for (const basePath of paths) {
      parentPort.postMessage({ type: "current-path", path: basePath });
      const results = await scanDirectory(basePath, maxDepth, keywords);
      allResults.push(...results);
      totalCount += results.length;
      parentPort.postMessage({ type: "progress", count: totalCount });
    }

    parentPort.postMessage({ type: "done" });
  } catch (error) {
    parentPort.postMessage({ type: "error", error: error.message });
  }
});
