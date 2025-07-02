const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");

// Keywords to search for in folder names
const KEYWORDS = [
  "cache",
  "temp",
  "crash",
  "report",
  "dump",
  "crashes",
  "pending"
];

// Add scan cancellation flag
let isScanCancelled = false;

// Get AppData paths
function getAppDataPaths() {
  const paths = [];

  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    const localAppData = process.env.LOCALAPPDATA;
    const localLowAppData = localAppData
      ? localAppData.replace("Local", "LocalLow")
      : null;

    if (appData && fsSync.existsSync(appData)) paths.push(appData);
    if (localAppData && fsSync.existsSync(localAppData))
      paths.push(localAppData);
    if (localLowAppData && fsSync.existsSync(localLowAppData))
      paths.push(localLowAppData);
  }

  return paths;
}

// Calculate directory size
async function getDirSize(dirPath) {
  if (isScanCancelled) return 0;
  let size = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (isScanCancelled) return size;
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
async function scanDirectory(
  dirPath,
  maxDepth,
  currentDepth = 0,
  progressCallback
) {
  // Reset cancellation flag at the start of a new scan
  if (currentDepth === 0) {
    isScanCancelled = false;
  }

  // Check for scan cancellation
  if (isScanCancelled) {
    return [];
  }

  const results = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (isScanCancelled) return results;
      if (!entry.isDirectory()) continue;

      const fullPath = path.join(dirPath, entry.name);
      const folderName = entry.name.toLowerCase();

      // Check if folder name contains any keywords
      if (KEYWORDS.some(keyword => folderName.includes(keyword))) {
        if (isScanCancelled) return results;
        try {
          const size = await getDirSize(fullPath);
          if (size > 0) {
            const result = {
              path: fullPath,
              size: size,
              name: entry.name
            };

            results.push(result);

            // Send progress update via callback
            if (progressCallback && !isScanCancelled) {
              progressCallback.onProgress(results.length);
              progressCallback.onFolderFound(result);
            }
          }
        } catch (err) {
          // Skip folders that can't be accessed
        }

        // Don't recurse into matched folders
        continue;
      }

      // Recurse into subdirectories
      if (!isScanCancelled) {
        try {
          const subResults = await scanDirectory(
            fullPath,
            maxDepth,
            currentDepth + 1,
            progressCallback
          );
          results.push(...subResults);
        } catch (err) {
          // Skip directories that can't be accessed
        }
      }
    }
  } catch (err) {
    // Skip directories that can't be accessed
  }

  return results;
}

// Delete directory recursively with partial deletion detection
async function deleteDirectory(dirPath) {
  try {
    // First, check if directory exists
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      return false;
    }

    let totalItems = 0;
    let deletedItems = 0;
    let hasErrors = false;

    async function deleteRecursively(currentPath) {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          totalItems++;

          try {
            if (entry.isDirectory()) {
              // Recursively delete subdirectory contents first
              await deleteRecursively(fullPath);
              // Then try to delete the empty directory
              await fs.rmdir(fullPath);
            } else {
              // Delete file
              await fs.unlink(fullPath);
            }
            deletedItems++;
          } catch (err) {
            console.error(`Failed to delete ${fullPath}:`, err);
            hasErrors = true;
          }
        }
      } catch (err) {
        console.error(`Failed to read directory ${currentPath}:`, err);
        hasErrors = true;
      }
    }

    // Delete all contents
    await deleteRecursively(dirPath);

    // Try to delete the root directory itself
    try {
      await fs.rmdir(dirPath);
      deletedItems++; // Count the root directory
      totalItems++;
    } catch (err) {
      console.error(`Failed to delete root directory ${dirPath}:`, err);
      hasErrors = true;
    }

    // Determine result based on what was deleted
    if (totalItems === 0) {
      // Empty directory - consider it successfully deleted
      return true;
    } else if (deletedItems === totalItems && !hasErrors) {
      // Everything deleted successfully
      return true;
    } else if (deletedItems === 0) {
      // Nothing was deleted
      return false;
    } else {
      // Some items were deleted, some weren't
      return "partial";
    }
  } catch (err) {
    console.error(`Failed to delete ${dirPath}:`, err);
    return false;
  }
}

// Cancel ongoing scan
function cancelScan() {
  isScanCancelled = true;
}

// Reset scan cancellation flag
function resetScanCancellation() {
  isScanCancelled = false;
}

module.exports = {
  getAppDataPaths,
  getDirSize,
  scanDirectory,
  deleteDirectory,
  cancelScan,
  resetScanCancellation,
  KEYWORDS
};
