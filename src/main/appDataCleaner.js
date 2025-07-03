const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const os = require("os");

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

// Get AppData paths (Windows) or equivalent user directories (Linux)
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
  } else if (process.platform === "linux") {
    const homeDir = os.homedir();

    // Common Linux user directories where apps store data
    const linuxPaths = [
      path.join(homeDir, ".config"), // User configuration files
      path.join(homeDir, ".cache"), // User cache files
      path.join(homeDir, ".local/share"), // User data files
      path.join(homeDir, ".local/state"), // User state files
      "/tmp" // System temporary files
    ];

    // Add paths that exist
    linuxPaths.forEach(dirPath => {
      if (fsSync.existsSync(dirPath)) {
        paths.push(dirPath);
      }
    });
  }

  return paths;
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

module.exports = {
  getAppDataPaths,
  deleteDirectory,
  KEYWORDS
};
