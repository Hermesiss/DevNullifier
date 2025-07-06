import { app, BrowserWindow, ipcMain, dialog } from "electron";
import type { OpenDialogOptions, OpenDialogReturnValue } from "electron";
import path from "path";
import type { Dirent } from "fs";
import { promises as fsPromises } from "fs";
import os from "os";
import { Worker } from "worker_threads";
import * as appDataCleaner from "./appDataCleaner";
import * as fileUtils from "./fileUtils";
import type { Project, Category, WorkerMessage, WorkerResponse } from "../types/developer-cleaner";
import { UpdateService } from "./updateService";

// Set user data path early
fileUtils.setUserDataPath(app.getPath('userData'));

let mainWindow: BrowserWindow | null = null;
let currentAppDataScanWorker: Worker | null = null;
let currentDeveloperScanWorker: Worker | null = null;
let updateService: UpdateService | null = null;

const isDev =
  process.env.NODE_ENV === "development" || !!process.env.VITE_DEV_SERVER_URL;
  
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    autoHideMenuBar: true,
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

  // Initialize update service
  updateService = new UpdateService(mainWindow);
  if (!isDev) {
    updateService.checkForUpdates();
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
ipcMain.handle("stop-appdata-scan", () => {
  if (currentAppDataScanWorker) {
    currentAppDataScanWorker.postMessage({ type: "stop" });
  }
  return true;
});

ipcMain.handle("get-appdata-paths", () => {
  return appDataCleaner.getAppDataPaths();
});

ipcMain.handle("scan-folders", async (event, { paths, maxDepth }) => {
  // If there's an existing scan, terminate it
  if (currentAppDataScanWorker) {
    currentAppDataScanWorker.terminate();
    currentAppDataScanWorker = null;
  }

  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, "appDataScanWorker.js");

    currentAppDataScanWorker = new Worker(workerPath);
    const allResults: any[] = [];
    let wasTerminated = false;

    currentAppDataScanWorker.on("message", message => {
      if (!mainWindow) return;
      if (message.type === "progress") {
        mainWindow.webContents.send("scan-progress", message.count);
      } else if (message.type === "current-path") {
        mainWindow.webContents.send("scan-current-path", message.path);
      } else if (message.type === "folder-found") {
        mainWindow.webContents.send("scan-folder-found", message.folders);
        allResults.push(...message.folders);
      } else if (message.type === "done") {
        currentAppDataScanWorker = null;
        resolve(allResults);
      }
    });

    currentAppDataScanWorker.on("error", error => {
      currentAppDataScanWorker = null;
      if (!wasTerminated) {
        reject(error);
      }
    });

    currentAppDataScanWorker.on("exit", code => {
      currentAppDataScanWorker = null;
      if (code !== 0 && !wasTerminated) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      } else {
        resolve(allResults);
      }
    });

    // Store original terminate function
    const originalTerminate = currentAppDataScanWorker.terminate.bind(
      currentAppDataScanWorker
    );
    // Override terminate to set flag
    currentAppDataScanWorker.terminate = () => {
      wasTerminated = true;
      return originalTerminate();
    };

    currentAppDataScanWorker.postMessage({ 
      paths, 
      maxDepth, 
      keywords: appDataCleaner.KEYWORDS,
      userDataPath: app.getPath('userData')  // Pass userDataPath to worker
    });
  });
});

ipcMain.handle("delete-folders", async (event, folderPaths: string[]) => {
  const results = [];

  for (let i = 0; i < folderPaths.length; i++) {
    console.log("Deleting folder:", folderPaths[i]);
    const success = await appDataCleaner.deleteDirectory(folderPaths[i]);
    results.push({ path: folderPaths[i], success });

    // Send progress update
    if (mainWindow) {
      mainWindow.webContents.send("delete-progress", i + 1);
    }
  }

  return results;
});

ipcMain.handle("check-admin", () => {
  // On Windows, check if running as admin
  if (process.platform === "win32") {
    try {
      // This is a simple check - in production you might want more robust checking
      return process.getuid && process.getuid() === 0;
    } catch {
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
  if (!mainWindow) return null;

  const options: OpenDialogOptions = {
    properties: ["openDirectory"],
    title: "Select Base Path for Scanning"
  };

  try {
    const result: OpenDialogReturnValue = await dialog.showOpenDialog(mainWindow, options);
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
  } catch (error) {
    console.error('Error selecting directory:', error);
  }

  return null;
});

interface FolderContents {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  itemCount: number;
}

async function processDirectoryEntry(entry: Dirent, parentPath: string): Promise<FolderContents | null> {
  const fullPath = path.resolve(path.join(parentPath, entry.name));
  let size = 0;
  let itemCount = 0;

  try {
    if (entry.isDirectory()) {
      const subEntries = await fsPromises.readdir(fullPath);
      itemCount = subEntries.length;
    } else {
      const stats = await fsPromises.stat(fullPath);
      size = stats.size;
    }

    return {
      name: entry.name,
      path: fullPath,
      isDirectory: entry.isDirectory(),
      size,
      itemCount
    };
  } catch (error) {
    console.warn(`Cannot access ${fullPath}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

function sortFolderContents(contents: FolderContents[]): FolderContents[] {
  return contents.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

// Get folder contents
ipcMain.handle("get-folder-contents", async (event, folderPath: string): Promise<FolderContents[]> => {
  try {
    const entries = await fsPromises.readdir(folderPath, { withFileTypes: true });
    const limitedEntries = entries.slice(0, 1000); // Limit to first 1000 entries to prevent UI freezing
    
    const contents: FolderContents[] = [];
    const processedEntries = await Promise.all(
      limitedEntries.map(entry => processDirectoryEntry(entry, folderPath))
    );
    
    contents.push(...processedEntries.filter((entry): entry is FolderContents => entry !== null));
    return sortFolderContents(contents);
  } catch (error) {
    throw new Error(`Cannot read folder ${folderPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
});

// Scan for developer caches
ipcMain.handle(
  "scan-developer-caches",
  async (event, { basePaths, enabledCategories }: { basePaths: string[], enabledCategories: Category[] }): Promise<Project[]> => {
    // If there's an existing scan, terminate it
    if (currentDeveloperScanWorker) {
      currentDeveloperScanWorker.terminate();
    }

    return new Promise((resolve, reject) => {
      const workerPath = path.join(__dirname, "developerScanWorker.js");

      currentDeveloperScanWorker = new Worker(workerPath);
      let wasTerminated = false;

      currentDeveloperScanWorker.on("message", (message: WorkerResponse) => {
        if (!mainWindow) return;

        if (message.type === "current-path") {
          mainWindow.webContents.send("developer-scan-current-path", message.path);
        } else if (message.type === "project-found") {
          mainWindow.webContents.send("developer-project-found", message.project);
        } else if (message.type === "done") {
          currentDeveloperScanWorker = null;
          resolve(message.projects);
        } else if (message.type === "error") {
          currentDeveloperScanWorker = null;
          if (!wasTerminated) {
            reject(new Error(message.error));
          }
        }
      });

      currentDeveloperScanWorker.on("error", error => {
        currentDeveloperScanWorker = null;
        if (!wasTerminated) {
          reject(error);
        }
      });

      currentDeveloperScanWorker.on("exit", code => {
        currentDeveloperScanWorker = null;
        if (code !== 0 && !wasTerminated) {
          reject(new Error(`Developer scan worker stopped with exit code ${code}`));
        }
      });

      // Store original terminate function
      const originalTerminate = currentDeveloperScanWorker.terminate.bind(
        currentDeveloperScanWorker
      );
      // Override terminate to set flag
      currentDeveloperScanWorker.terminate = () => {
        wasTerminated = true;
        return originalTerminate();
      };

      currentDeveloperScanWorker.postMessage({ 
        basePaths, 
        enabledCategories,
        userDataPath: app.getPath('userData')  // Pass userDataPath to worker
      } as WorkerMessage);
    });
  }
);

// Stop developer scan
ipcMain.handle("stop-developer-scan", () => {
  if (currentDeveloperScanWorker) {
    currentDeveloperScanWorker.postMessage({ type: "stop" });
  }
  return true;
});

// Add new IPC handlers after other handlers
ipcMain.handle("save-folders", async (event, folders) => {
  await fileUtils.saveFolders(folders);
  return true;
});

ipcMain.handle("load-saved-folders", async () => {
  return fileUtils.loadSavedFolders();
});

ipcMain.handle("get-saved-folders-count", async () => {
  return fileUtils.getSavedFoldersCount();
});

ipcMain.handle("get-directory-size", async (event, path) => {
  return appDataCleaner.getDirectorySize(path);
});

ipcMain.handle("save-developer-projects", async (event, projects) => {
  await fileUtils.saveDeveloperProjects(projects);
  return true;
});

ipcMain.handle("load-saved-developer-projects", async () => {
  return fileUtils.loadSavedDeveloperProjects();
});

ipcMain.handle("get-saved-developer-projects-count", async () => {
  return fileUtils.getSavedDeveloperProjectsCount();
});

// Add IPC handlers for auto-update
ipcMain.handle('check-for-updates', () => {
  if (updateService) {
    updateService.checkForUpdates();
  }
});

ipcMain.handle('quit-and-install', () => {
  if (updateService) {
    updateService.quitAndInstall();
  }
}); 