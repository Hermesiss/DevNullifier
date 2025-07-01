const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const os = require("os");
const { Worker } = require("worker_threads");

let mainWindow;
let currentScanWorker = null;

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
