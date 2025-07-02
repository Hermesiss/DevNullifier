const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const os = require("os");
const { Worker } = require("worker_threads");

let mainWindow;
let currentScanWorker = null;
let currentDeveloperScanWorker = null;

const isDev =
  process.env.NODE_ENV === "development" || !!process.env.VITE_DEV_SERVER_URL;

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

function createWindow() {
  console.log(
    "isDev:",
    isDev,
    "NODE_ENV:",
    process.env.NODE_ENV,
    "VITE_DEV_SERVER_URL:",
    process.env.VITE_DEV_SERVER_URL
  );
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    },
    icon: path.join(__dirname, "../renderer/assets/icon.png")
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist-renderer/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

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
async function scanDirectory(dirPath, maxDepth, currentDepth = 0) {
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
            results.push({
              path: fullPath,
              size: size,
              name: entry.name
            });

            // Send progress update
            if (!isScanCancelled) {
              mainWindow.webContents.send("scan-progress", results.length);
              // Send each found folder in real-time
              mainWindow.webContents.send("scan-folder-found", {
                path: fullPath,
                size: size,
                name: entry.name
              });
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
            currentDepth + 1
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
        console.error(`Error processing cache pattern '${pattern}' in ${projectPath}:`, error);
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

// Scan for developer projects
async function scanDeveloperProjects(basePaths, enabledCategories) {
  const projects = [];

  for (const basePath of basePaths) {
    try {
      await scanDeveloperProjectsRecursive(
        basePath,
        enabledCategories,
        projects,
        0,
        10
      ); // Max depth of 10
    } catch (error) {
      console.error(`Error scanning ${basePath}:`, error);
    }
  }

  return projects;
}

// Helper function to expand glob patterns like "Plugins/**/Binaries/"
async function expandGlobPattern(projectPath, pattern) {
  // Check if pattern contains glob wildcards
  if (!pattern.includes('*')) {
    // Simple pattern, return single path
    const fullPath = path.join(projectPath, pattern);
    return [fullPath];
  }

  const results = [];
  const parts = pattern.split('/').filter(part => part !== '');
  
  // Start searching from project root
  await searchGlobPattern(projectPath, parts, 0, results);
  
  // Remove duplicates by converting to Set and back to Array
  const uniqueResults = [...new Set(results)];
  
  return uniqueResults;
}

// Recursive function to search for glob pattern matches
async function searchGlobPattern(currentPath, patternParts, partIndex, results) {
  if (partIndex >= patternParts.length) {
    // We've matched all parts, add to results
    results.push(currentPath);
    return;
  }

  const currentPart = patternParts[partIndex];
  
  if (currentPart === '**') {
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
            await searchGlobPattern(subPath, patternParts, nextPartIndex + 1, results);
          } else {
            // Continue searching deeper with ** still active
            await searchGlobPattern(subPath, patternParts, partIndex, results);
          }
        }
      }
    } catch (error) {
      // Can't read directory, skip
    }
    
  } else if (currentPart === '*') {
    // Single asterisk - match any single directory name
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = path.join(currentPath, entry.name);
          await searchGlobPattern(subPath, patternParts, partIndex + 1, results);
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
        if (mainWindow) {
          mainWindow.webContents.send("developer-project-found", project);
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
          maxDepth
        );
      }
    }
  } catch (error) {
    // Skip directories that can't be accessed
  }
}

// IPC Handlers
ipcMain.handle("stop-scan", () => {
  if (currentScanWorker) {
    currentScanWorker.terminate();
    currentScanWorker = null;
  }
  return true;
});

ipcMain.handle("get-appdata-paths", () => {
  return getAppDataPaths();
});

ipcMain.handle("scan-folders", async (event, { paths, maxDepth }) => {
  // If there's an existing scan, terminate it
  if (currentScanWorker) {
    currentScanWorker.terminate();
  }

  return new Promise((resolve, reject) => {
    const workerPath = isDev
      ? path.join(__dirname, "scanWorker.js")
      : path.join(
          process.resourcesPath,
          "app.asar",
          "src",
          "main",
          "scanWorker.js"
        );

    currentScanWorker = new Worker(workerPath);
    const allResults = [];
    let wasTerminated = false;

    currentScanWorker.on("message", message => {
      if (message.type === "progress") {
        mainWindow.webContents.send("scan-progress", message.count);
      } else if (message.type === "current-path") {
        mainWindow.webContents.send("scan-current-path", message.path);
      } else if (message.type === "folder-found") {
        mainWindow.webContents.send("scan-folder-found", message.folder);
        allResults.push(message.folder);
      } else if (message.type === "done") {
        currentScanWorker = null;
        resolve(allResults);
      }
    });

    currentScanWorker.on("error", error => {
      currentScanWorker = null;
      if (!wasTerminated) {
        reject(error);
      }
    });

    currentScanWorker.on("exit", code => {
      currentScanWorker = null;
      if (code !== 0 && !wasTerminated) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      } else {
        resolve(allResults);
      }
    });

    // Store original terminate function
    const originalTerminate = currentScanWorker.terminate.bind(
      currentScanWorker
    );
    // Override terminate to set flag
    currentScanWorker.terminate = () => {
      wasTerminated = true;
      return originalTerminate();
    };

    currentScanWorker.postMessage({ paths, maxDepth, keywords: KEYWORDS });
  });
});

ipcMain.handle("delete-folders", async (event, folderPaths) => {
  const results = [];

  for (let i = 0; i < folderPaths.length; i++) {
    const success = await deleteDirectory(folderPaths[i]);
    results.push({ path: folderPaths[i], success });

    // Send progress update
    mainWindow.webContents.send("delete-progress", i + 1);
  }

  return results;
});

ipcMain.handle("check-admin", () => {
  // On Windows, check if running as admin
  if (process.platform === "win32") {
    try {
      // This is a simple check - in production you might want more robust checking
      return process.getuid && process.getuid() === 0;
    } catch (err) {
      return false;
    }
  }
  return true;
});

// Get user home directory
ipcMain.handle("get-user-home", () => {
  return os.homedir();
});

// Select directory
ipcMain.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Select Base Path for Scanning"
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }

  return null;
});

// Scan for developer caches
ipcMain.handle(
  "scan-developer-caches",
  async (event, { basePaths, enabledCategories }) => {
    try {
      const projects = await scanDeveloperProjects(
        basePaths,
        enabledCategories
      );
      return projects;
    } catch (error) {
      console.error("Developer scan error:", error);
      throw new Error(`Developer scan failed: ${error.message}`);
    }
  }
);

// Stop developer scan
ipcMain.handle("stop-developer-scan", () => {
  if (currentDeveloperScanWorker) {
    currentDeveloperScanWorker.terminate();
    currentDeveloperScanWorker = null;
  }
  return true;
});

// Get folder contents
ipcMain.handle("get-folder-contents", async (event, folderPath) => {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const contents = [];

    // Limit to first 1000 entries to prevent UI freezing
    const limitedEntries = entries.slice(0, 1000);

    for (const entry of limitedEntries) {
      const fullPath = path.resolve(path.join(folderPath, entry.name));
      let size = 0;
      let itemCount = undefined;

      try {
        if (entry.isDirectory()) {
          // For directories, count immediate children (limited to prevent slowdown)
          try {
            const subEntries = await fs.readdir(fullPath);
            itemCount = subEntries.length;
          } catch {
            itemCount = 0; // Can't access directory
          }
        } else {
          // For files, get size
          const stats = await fs.stat(fullPath);
          size = stats.size;
        }

        contents.push({
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          size: size,
          itemCount: itemCount
        });
      } catch (error) {
        // Skip files/folders that can't be accessed
        console.warn(`Cannot access ${fullPath}:`, error.message);
      }
    }

    // Sort: directories first, then by name
    contents.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return contents;
  } catch (error) {
    throw new Error(`Cannot read folder ${folderPath}: ${error.message}`);
  }
});
