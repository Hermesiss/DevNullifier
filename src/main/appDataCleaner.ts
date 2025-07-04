import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";

// Keywords to search for in folder names
export const KEYWORDS = [
  "cache",
  "temp",
  "crash",
  "report",
  "dump",
  "crashes",
  "pending"
];

// Get AppData paths (Windows) or equivalent user directories (Linux/macOS)
export function getAppDataPaths() {
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
  } else if (process.platform === "darwin") {
    const homeDir = os.homedir();

    // Common macOS user directories where apps store data
    const macOSPaths = [
      path.join(homeDir, "Library/Caches"), // Application caches
      path.join(homeDir, "Library/Application Support"), // Application data
      path.join(homeDir, "Library/Logs"), // Application logs
      path.join(homeDir, "Library/Preferences"), // Application preferences
      "/tmp" // System temporary files
    ];

    // Add paths that exist
    macOSPaths.forEach(dirPath => {
      if (fsSync.existsSync(dirPath)) {
        paths.push(dirPath);
      }
    });
  }

  return paths;
}

// Delete directory recursively with partial deletion detection
export async function deleteDirectory(dirPath: string) {
  try {
    // First, check if directory exists
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      return false;
    }

    let totalItems = 0;
    let deletedItems = 0;
    let hasErrors = false;

    async function deleteRecursively(currentPath: string) {
      try {
        const entries = await fs.readdir(currentPath);
        const entriesWithTypes = await Promise.all(
          entries.map(async entry => {
            const fullPath = path.join(currentPath, entry);
            const stat = await fs.stat(fullPath);
            return {
              name: entry,
              isDirectory: () => stat.isDirectory(),
              fullPath
            };
          })
        );

        for (const entry of entriesWithTypes) {
          totalItems++;

          try {
            if (entry.isDirectory()) {
              // Recursively delete subdirectory contents first
              await deleteRecursively(entry.fullPath);
              // Then try to delete the empty directory
              await fs.rm(entry.fullPath, { recursive: true, force: true });
            } else {
              // Delete file
              await fs.unlink(entry.fullPath);
            }
            deletedItems++;
          } catch (err) {
            console.error(`Failed to delete ${entry.fullPath}:`, err);
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
      await fs.rm(dirPath, { recursive: true, force: true });
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
