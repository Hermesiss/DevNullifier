const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const os = require("os");
const { Worker } = require("worker_threads");
const appDataCleaner = require("./appDataCleaner");
const developerCleaner = require("./developerCleaner");

let mainWindow;
let currentScanWorker = null;
let currentDeveloperScanWorker = null;

const isDev =
  process.env.NODE_ENV === "development" || !!process.env.VITE_DEV_SERVER_URL;



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
    icon: path.join(__dirname, "../assets/icon-256.png")
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



















// IPC Handlers
ipcMain.handle("stop-scan", () => {
  if (currentScanWorker) {
    currentScanWorker.terminate();
    currentScanWorker = null;
  }
  return true;
});

ipcMain.handle("get-appdata-paths", () => {
  return appDataCleaner.getAppDataPaths();
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

    currentScanWorker.postMessage({ paths, maxDepth, keywords: appDataCleaner.KEYWORDS });
  });
});

ipcMain.handle("delete-folders", async (event, folderPaths) => {
  const results = [];

  for (let i = 0; i < folderPaths.length; i++) {
    const success = await appDataCleaner.deleteDirectory(folderPaths[i]);
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
      const progressCallback = {
        onProjectFound: (project) => {
          if (mainWindow) {
            mainWindow.webContents.send("developer-project-found", project);
          }
        }
      };
      
      const projects = await developerCleaner.scanDeveloperProjects(
        basePaths,
        enabledCategories,
        progressCallback
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
