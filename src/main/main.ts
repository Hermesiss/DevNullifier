import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import type { OpenDialogOptions, OpenDialogReturnValue } from "electron";
import path from "path";
import type { Dirent } from "fs";
import { promises as fsPromises } from "fs";
import os from "os";
import { Worker } from "worker_threads";
import * as appDataCleaner from "./appDataCleaner";
import * as fileUtils from "./fileUtils";
import { loadCleanerRules, permanentRemove, saveCleanerRules, type CleanerRules } from "./cleanerRules";
import type { Project, Category, WorkerMessage, WorkerResponse } from "../types/developer-cleaner";
import { UpdateService } from "./updateService";
import {
  ScanAllowlist,
  canDelete,
  canRead,
  collectDeveloperPaths,
  isProtectedPath,
  type ProtectionContext
} from "./deletionPolicy";

// Set user data path early
fileUtils.setUserDataPath(app.getPath('userData'));

let mainWindow: BrowserWindow | null = null;
let currentAppDataScanWorker: Worker | null = null;
let currentDeveloperScanWorker: Worker | null = null;
let updateService: UpdateService | null = null;
const scanAllowlist = new ScanAllowlist();

async function protectionContext(protectedPaths?: string[]): Promise<ProtectionContext> {
  const paths = protectedPaths ?? (await loadCleanerRules()).protectedPaths;
  return {
    home: os.homedir(),
    userData: app.getPath("userData"),
    protectedPaths: paths
  };
}

function sendToRenderer(channel: string, payload: unknown) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

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
      sandbox: true,
      preload: path.join(__dirname, "preload.js")
    },
    icon: path.join(__dirname, "../assets/icon-256.png")
  });

  mainWindow.on("closed", () => {
    void currentAppDataScanWorker?.terminate();
    void currentDeveloperScanWorker?.terminate();
    mainWindow = null;
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
    void currentAppDataScanWorker.terminate();
  }
  return true;
});

ipcMain.handle("get-appdata-paths", () => {
  return appDataCleaner.getAppDataPaths();
});

ipcMain.handle("scan-folders", async (event, { paths, maxDepth, resetAllowlist }) => {
  // If there's an existing scan, terminate it
  if (currentAppDataScanWorker) {
    currentAppDataScanWorker.terminate();
    currentAppDataScanWorker = null;
  }

  if (resetAllowlist) scanAllowlist.beginAppDataScan();
  const protection = await protectionContext();

  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, "appDataScanWorker.js");

    const worker = new Worker(workerPath);
    currentAppDataScanWorker = worker;
    const allResults: any[] = [];
    let wasTerminated = false;
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (currentAppDataScanWorker === worker) currentAppDataScanWorker = null;
      if (error && !wasTerminated) reject(error);
      else resolve(allResults);
    };

    currentAppDataScanWorker.on("message", message => {
      if (message.type === "progress") {
        sendToRenderer("scan-progress", message.count);
      } else if (message.type === "current-path") {
        sendToRenderer("scan-current-path", message.path);
      } else if (message.type === "folder-found") {
        const folders = (message.folders as { path: string }[]).filter(
          folder => folder?.path && !isProtectedPath(folder.path, protection)
        );
        scanAllowlist.addAppData(
          folders.map(folder => folder.path),
          protection
        );
        if (folders.length > 0) sendToRenderer("scan-folder-found", folders);
        allResults.push(...folders);
      } else if (message.type === "done") {
        finish();
      }
    });

    currentAppDataScanWorker.on("error", error => {
      finish(error);
    });

    currentAppDataScanWorker.on("exit", code => {
      if (code !== 0 && !wasTerminated) {
        finish(new Error(`Worker stopped with exit code ${code}`));
      } else {
        finish();
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
      userDataPath: app.getPath("userData"),
      protectedPaths: protection.protectedPaths
    });
  });
});

ipcMain.handle("get-cleaner-rules", () => loadCleanerRules());

ipcMain.handle("set-cleaner-rules", (_event, partial: Partial<CleanerRules>) => {
  return saveCleanerRules(partial);
});

ipcMain.handle("delete-folders", async (event, folderPaths: string[]) => {
  const results = [];
  const allowed = scanAllowlist.keys();
  const rules = await loadCleanerRules();
  const protection = await protectionContext(rules.protectedPaths);
  const remove = rules.permanentDelete
    ? permanentRemove
    : (target: string) => shell.trashItem(target);

  for (let i = 0; i < folderPaths.length; i++) {
    const folderPath = folderPaths[i];
    const success = canDelete(folderPath, allowed, protection)
      ? await appDataCleaner.deleteDirectory(folderPath, remove)
      : false;
    results.push({ path: folderPath, success });
    sendToRenderer("delete-progress", i + 1);
  }

  return results;
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
  if (!canRead(folderPath, scanAllowlist.keys(), await protectionContext())) {
    throw new Error("Folder is outside the current scan results");
  }

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
  async (event, { basePaths, enabledCategories, maxDepth, resetAllowlist }: { basePaths: string[], enabledCategories: Category[], maxDepth?: number, resetAllowlist?: boolean }): Promise<Project[]> => {
    // If there's an existing scan, terminate it
    if (currentDeveloperScanWorker) {
      currentDeveloperScanWorker.terminate();
    }

    if (resetAllowlist) scanAllowlist.beginDeveloperScan();
    const protection = await protectionContext();

    return new Promise((resolve, reject) => {
      const workerPath = path.join(__dirname, "developerScanWorker.js");

      const worker = new Worker(workerPath);
      currentDeveloperScanWorker = worker;
      let wasTerminated = false;
      let settled = false;
      const foundProjects: Project[] = [];

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (currentDeveloperScanWorker === worker) currentDeveloperScanWorker = null;
        if (error && !wasTerminated) reject(error);
        else resolve(foundProjects);
      };

      currentDeveloperScanWorker.on("message", (message: WorkerResponse) => {
        if (message.type === "current-path") {
          sendToRenderer("developer-scan-current-path", message.path);
        } else if (message.type === "project-found") {
          if (isProtectedPath(message.project.path, protection)) return;
          foundProjects.push(message.project);
          scanAllowlist.addDeveloper(collectDeveloperPaths([message.project]), protection);
          sendToRenderer("developer-project-found", message.project);
        } else if (message.type === "done") {
          if (foundProjects.length === 0) {
            const projects = message.projects.filter(
              project => project?.path && !isProtectedPath(project.path, protection)
            );
            foundProjects.push(...projects);
            scanAllowlist.addDeveloper(collectDeveloperPaths(projects), protection);
          }
          finish();
        } else if (message.type === "error") {
          finish(new Error(message.error));
        }
      });

      currentDeveloperScanWorker.on("error", error => {
        finish(error);
      });

      currentDeveloperScanWorker.on("exit", code => {
        if (code !== 0 && !wasTerminated) {
          finish(new Error(`Developer scan worker stopped with exit code ${code}`));
        } else {
          finish();
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
        userDataPath: app.getPath("userData"),
        maxDepth: maxDepth,
        protectedPaths: protection.protectedPaths
      } as WorkerMessage);
    });
  }
);

// Stop developer scan
ipcMain.handle("stop-developer-scan", () => {
  if (currentDeveloperScanWorker) {
    currentDeveloperScanWorker.postMessage({ type: "stop" });
    void currentDeveloperScanWorker.terminate();
  }
  return true;
});

// Add new IPC handlers after other handlers
ipcMain.handle("save-folders", async (event, folders) => {
  await fileUtils.saveFolders(folders);
  return true;
});

ipcMain.handle("load-saved-folders", async () => {
  const folders = await fileUtils.loadSavedFolders();
  const protection = await protectionContext();
  scanAllowlist.addAppData(
    folders.map(folder => folder.path),
    protection
  );
  return folders;
});

ipcMain.handle("get-saved-folders-count", async () => {
  return fileUtils.getSavedFoldersCount();
});

ipcMain.handle("get-directory-size", async (event, targetPath: string) => {
  if (!canRead(targetPath, scanAllowlist.keys(), await protectionContext())) {
    throw new Error("Path is outside the current scan results");
  }
  return appDataCleaner.getDirectorySize(targetPath);
});

ipcMain.handle("save-developer-projects", async (event, projects) => {
  await fileUtils.saveDeveloperProjects(projects);
  return true;
});

ipcMain.handle("load-saved-developer-projects", async () => {
  const projects = await fileUtils.loadSavedDeveloperProjects();
  const protection = await protectionContext();
  scanAllowlist.addDeveloper(collectDeveloperPaths(projects), protection);
  return projects;
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

ipcMain.handle('get-locale', () => {
  return app.getLocale();
}); 