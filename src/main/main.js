const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const os = require("os");

let mainWindow;

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
async function scanDirectory(dirPath, maxDepth, currentDepth = 0) {
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
      if (KEYWORDS.some(keyword => folderName.includes(keyword))) {
        try {
          const size = await getDirSize(fullPath);
          if (size > 0) {
            results.push({
              path: fullPath,
              size: size,
              name: entry.name
            });

            // Send progress update
            mainWindow.webContents.send("scan-progress", results.length);
            // Send each found folder in real-time
            mainWindow.webContents.send("scan-folder-found", {
              path: fullPath,
              size: size,
              name: entry.name
            });
          }
        } catch (err) {
          // Skip folders that can't be accessed
        }

        // Don't recurse into matched folders
        continue;
      }

      // Recurse into subdirectories
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
  } catch (err) {
    // Skip directories that can't be accessed
  }

  return results;
}

// Delete directory recursively
async function deleteDirectory(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    return true;
  } catch (err) {
    console.error(`Failed to delete ${dirPath}:`, err);
    return false;
  }
}

// IPC Handlers
ipcMain.handle("get-appdata-paths", () => {
  return getAppDataPaths();
});

ipcMain.handle("scan-folders", async (event, { paths, maxDepth }) => {
  const allResults = [];

  for (const basePath of paths) {
    mainWindow.webContents.send("scan-current-path", basePath);
    const results = await scanDirectory(basePath, maxDepth);
    allResults.push(...results);
  }

  return allResults;
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
