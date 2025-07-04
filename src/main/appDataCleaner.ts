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
export async function deleteDirectory(
  dirPath: string
): Promise<boolean | "partial"> {
  try {
    const stats = await fs.stat(dirPath);
    if (!stats.isDirectory()) {
      return false; // It's a file, not a directory.
    }
  } catch (err) {
    // stat fails, e.g., path doesn't exist.
    // Consider this a success since there's nothing to delete.
    return true;
  }

  console.log("Deleting directory:", dirPath);
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  console.log("Entries:", entries);
  const results = await Promise.all(
    entries.map(entry => {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        return deleteDirectory(fullPath);
      } else {
        return fs
          .unlink(fullPath)
          .then(() => true)
          .catch(() => false);
      }
    })
  );

  console.log("Results:", results);

  let successCount = results.filter(res => res === true).length;
  let partialCount = results.filter(res => res === "partial").length;
  let failedCount = results.length - successCount - partialCount;

  console.log("Success count:", successCount);
  console.log("Partial count:", partialCount);
  console.log("Failed count:", failedCount);

  // After attempting to delete contents, try to remove the directory itself.
  if (failedCount === 0 && partialCount === 0) {
    try {
      await fs.rm(dirPath);
      return true; // Everything deleted, including the root.
    } catch {
      console.log("Failed to delete the root, but contents are gone.");
      // Failed to delete the root, but contents are gone.
      return "partial";
    }
  }

  if (partialCount > 0 || (successCount > 0 && failedCount > 0)) {
    console.log("Partial count:", partialCount);
    console.log("Success count:", successCount);
    console.log("Failed count:", failedCount);
    return "partial";
  }

  return false; // All children failed to delete.
}

export async function getDirectorySize(dirPath: string): Promise<number> {
  let size = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += await getDirectorySize(fullPath);
      } else {
        const stats = await fs.stat(fullPath);
        size += stats.size;
      }
    }
  } catch (err) {
    // Ignore errors (e.g., permission denied) and return size of what we can access.
    console.log("Error getting directory size:", err);
  }
  return size;
}
