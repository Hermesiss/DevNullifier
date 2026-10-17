import { app, BrowserWindow, ipcMain, dialog, shell, clipboard } from "electron";
import { spawn } from "child_process";
import type { OpenDialogOptions, OpenDialogReturnValue } from "electron";
import path from "path";
import type { Dirent } from "fs";
import { promises as fsPromises } from "fs";
import os from "os";
import { Worker } from "worker_threads";
import * as appDataCleaner from "./appDataCleaner";
import * as fileUtils from "./fileUtils";
import { loadCleanerRules, permanentRemove, saveCleanerRules, type CleanerRules } from "./cleanerRules";
import {
  loadCustomScanRules,
  mergeKeywords,
  saveCustomScanRules,
  type CustomScanRulesUpdate
} from "./customScanRules";
import {
  appendDeletionLog,
  deletionLogToCsv,
  loadDeletionLog,
  type DeletionLogEntry
} from "./deletionLog";
import type { Project, Category, WorkerMessage, WorkerResponse } from "../types/developer-cleaner";
import { UpdateService } from "./updateService";
import {
  ScanAllowlist,
  canDelete,
  canRead,
  collectDeveloperPaths,
  isProtectedPath,
  normalizePathKey,
  type ProtectionContext
} from "./deletionPolicy";
import {
  collectExistingToolCaches,
  presentToolCaches,
  toolCacheCandidates,
  toolCacheCatalog,
  type ToolCacheFound,
  type ToolCacheLocale
} from "./globalToolCaches";
import { pathMatchesExclude } from "./excludeGlobs";
import { queryLockingProcess } from "./lockingProcess";
import { elevationCommandEnv } from "./elevation";
import { scanGames, uninstallGame } from "./games/scanGames";
import type { UninstallGameRequest } from "./games/types";

// Set user data path early
fileUtils.setUserDataPath(app.getPath('userData'));

let mainWindow: BrowserWindow | null = null;
let currentAppDataScanWorker: Worker | null = null;
let currentDeveloperScanWorker: Worker | null = null;
let updateService: UpdateService | null = null;
const scanAllowlist = new ScanAllowlist();
let acceptedToolCaches: string[] = [];

async function protectionContext(
  rules?: Pick<CleanerRules, "protectedPaths" | "excludeGlobs">
): Promise<ProtectionContext> {
  const loaded = rules ?? (await loadCleanerRules());
  return {
    home: os.homedir(),
    userData: app.getPath("userData"),
    protectedPaths: loaded.protectedPaths,
    excludeGlobs: loaded.excludeGlobs
  };
}

function excludeGlobsOf(protection: ProtectionContext): readonly string[] {
  return protection.excludeGlobs ?? [];
}

function dropExcludedProject<T extends {
  path: string;
  caches?: Array<{
    matches?: Array<{ path: string; size: number; selected?: boolean }>;
    totalSize: number;
    selectedSize: number;
  }>;
  totalCacheSize: number;
  selectedCacheSize?: number;
}>(project: T, globs: readonly string[]): T | null {
  if (!project?.path || pathMatchesExclude(project.path, globs)) return null;
  if (globs.length === 0 || project.caches == null) return project;

  const caches = [];
  for (const group of project.caches ?? []) {
    const matches = (group.matches ?? []).filter(
      match => match?.path && !pathMatchesExclude(match.path, globs)
    );
    if (matches.length === 0) continue;
    const totalSize = matches.reduce((sum, match) => sum + (match.size || 0), 0);
    const selectedSize = matches.reduce(
      (sum, match) => sum + (match.selected ? match.size || 0 : 0),
      0
    );
    caches.push({ ...group, matches, totalSize, selectedSize });
  }
  if (caches.length === 0) return null;

  const totalCacheSize = caches.reduce((sum, group) => sum + group.totalSize, 0);
  const next = { ...project, caches, totalCacheSize };
  if (typeof project.selectedCacheSize === "number") {
    next.selectedCacheSize = caches.reduce((sum, group) => sum + group.selectedSize, 0);
  }
  return next;
}

function sendToRenderer(channel: string, ...payload: unknown[]) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, ...payload);
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
  const [protection, customRules] = await Promise.all([
    protectionContext(),
    loadCustomScanRules()
  ]);

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
      if (message.type === "current-path") {
        sendToRenderer("scan-current-path", message.path, message.visited);
        if (typeof message.visited === "number") {
          sendToRenderer("scan-progress", message.visited);
        }
      } else if (message.type === "folder-found") {
        const folders = (message.folders as { path: string }[]).filter(
          folder =>
            folder?.path &&
            !isProtectedPath(folder.path, protection) &&
            !pathMatchesExclude(folder.path, excludeGlobsOf(protection))
        );
        scanAllowlist.addAppData(
          folders.map(folder => folder.path),
          protection
        );
        if (folders.length > 0) sendToRenderer("scan-folder-found", folders);
        allResults.push(...folders);
      } else if (message.type === "access-denied") {
        sendToRenderer("scan-access-denied", message.path);
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
      keywords: mergeKeywords(appDataCleaner.KEYWORDS, customRules.keywords),
      userDataPath: app.getPath("userData"),
      protectedPaths: protection.protectedPaths,
      excludeGlobs: protection.excludeGlobs
    });
  });
});

ipcMain.handle("get-cleaner-rules", () => loadCleanerRules());

ipcMain.handle("set-cleaner-rules", (_event, partial: Partial<CleanerRules>) => {
  return saveCleanerRules(partial);
});

ipcMain.handle("get-custom-scan-rules", () => loadCustomScanRules());

ipcMain.handle("set-custom-scan-rules", (_event, partial: CustomScanRulesUpdate) => {
  return saveCustomScanRules(partial);
});

ipcMain.handle("delete-folders", async (event, folderPaths: string[]) => {
  const results = [];
  const allowed = scanAllowlist.keys();
  const rules = await loadCleanerRules();
  const protection = await protectionContext(rules);
  const remove = rules.permanentDelete
    ? permanentRemove
    : (target: string) => shell.trashItem(target);

  for (let i = 0; i < folderPaths.length; i++) {
    const folderPath = folderPaths[i];
    results.push(
      await appDataCleaner.deletePathResult(
        folderPath,
        canDelete(folderPath, allowed, protection),
        remove
      )
    );
    sendToRenderer("delete-progress", i + 1);
  }

  return results;
});

ipcMain.handle("locking-process", async (_event, target: unknown) => {
  if (process.platform !== "win32") return null;
  if (typeof target !== "string" || target.length === 0) return null;

  const allowed = scanAllowlist.keys();
  const protection = await protectionContext();
  const permitted =
    canDelete(target, allowed, protection) || allowed.has(normalizePathKey(target));
  if (!permitted) return null;

  return queryLockingProcess(target);
});

ipcMain.handle("get-deletion-log", () => loadDeletionLog());

ipcMain.handle("append-deletion-log", async (_event, entries: unknown) => {
  const list = Array.isArray(entries) ? (entries as DeletionLogEntry[]) : [];
  await appendDeletionLog(list);
  return loadDeletionLog();
});

ipcMain.handle("export-deletion-log", async () => {
  if (!mainWindow) return { saved: false };

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: "devnullifier-deletions.csv"
  });

  if (result.canceled || !result.filePath) return { saved: false };

  await fsPromises.writeFile(result.filePath, deletionLogToCsv(await loadDeletionLog()), "utf-8");
  return { saved: true };
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

ipcMain.handle("scan-global-caches", async (_event, locale?: ToolCacheLocale) => {
  const resolved: ToolCacheLocale = locale === "ru" ? "ru" : "en";
  const home = os.homedir();
  const protection = await protectionContext();
  const fsOps = {
    stat: (target: string) => fsPromises.lstat(target),
    getDirSize: (target: string) => fileUtils.getDirSize(target),
    readdir: async (dir: string) => {
      const entries = await fsPromises.readdir(dir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory() || entry.isFile())
        .map(entry => entry.name);
    }
  };
  const candidates = await toolCacheCandidates(home, process.platform, fsOps);
  const total = candidates.length;
  const accepted: string[] = [];
  const visible: ToolCacheFound[] = [];

  sendToRenderer("tool-cache-scan-progress", { checked: 0, total, path: "" });

  await collectExistingToolCaches(
    home,
    process.platform,
    fsOps,
    async (progress, hit) => {
      sendToRenderer("tool-cache-scan-progress", progress);
      if (!hit) return;
      if (!canDelete(hit.path, new Set([normalizePathKey(hit.path)]), protection)) return;
      accepted.push(hit.path);
      visible.push(hit);
      sendToRenderer("tool-cache-found", presentToolCaches([hit], resolved)[0]);
    }
  );

  acceptedToolCaches = accepted;
  scanAllowlist.addDeveloper(accepted, protection);
  return presentToolCaches(visible, resolved);
});

ipcMain.handle("get-tool-cache-catalog", async (_event, locale?: ToolCacheLocale) => {
  const resolved: ToolCacheLocale = locale === "ru" ? "ru" : "en";
  return toolCacheCatalog(os.homedir(), process.platform, resolved);
});

ipcMain.handle("scan-games", async () => {
  return scanGames();
});

ipcMain.handle("uninstall-game", async (_event, request: UninstallGameRequest) => {
  if (!request || typeof request !== "object") {
    return { ok: false, error: "Invalid uninstall request" };
  }
  return uninstallGame(request);
});

// Scan for developer caches
ipcMain.handle(
  "scan-developer-caches",
  async (event, { basePaths, enabledCategories, maxDepth, resetAllowlist }: { basePaths: string[], enabledCategories: Category[], maxDepth?: number, resetAllowlist?: boolean }): Promise<Project[]> => {
    // If there's an existing scan, terminate it
    if (currentDeveloperScanWorker) {
      currentDeveloperScanWorker.terminate();
    }

    const protection = await protectionContext();
    if (resetAllowlist) {
      scanAllowlist.beginDeveloperScan();
      scanAllowlist.addDeveloper(acceptedToolCaches, protection);
    }

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
          sendToRenderer("developer-scan-current-path", message.path, message.visited);
          if (typeof message.visited === "number") {
            sendToRenderer("developer-scan-visited", message.visited);
          }
        } else if (message.type === "project-found") {
          if (isProtectedPath(message.project.path, protection)) return;
          const project = dropExcludedProject(message.project, excludeGlobsOf(protection));
          if (!project) return;
          foundProjects.push(project);
          scanAllowlist.addDeveloper(collectDeveloperPaths([project]), protection);
          sendToRenderer("developer-project-found", project);
        } else if (message.type === "access-denied") {
          sendToRenderer("scan-access-denied", message.path);
        } else if (message.type === "done") {
          if (foundProjects.length === 0) {
            const projects = message.projects.flatMap(project => {
              if (!project?.path || isProtectedPath(project.path, protection)) return [];
              const visible = dropExcludedProject(project, excludeGlobsOf(protection));
              return visible ? [visible] : [];
            });
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
        protectedPaths: protection.protectedPaths,
        excludeGlobs: protection.excludeGlobs
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
  const protection = await protectionContext();
  const folders = (await fileUtils.loadSavedFolders()).filter(
    folder => folder?.path && !pathMatchesExclude(folder.path, excludeGlobsOf(protection))
  );
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

function statfsBytes(bsize: number, blocks: number): number | null {
  if (!Number.isFinite(bsize) || bsize <= 0) return null;
  if (!Number.isFinite(blocks) || blocks < 0) return null;
  return bsize * blocks;
}

ipcMain.handle("disk-free", async (_event, path: unknown) => {
  if (typeof path !== "string" || !path.trim()) {
    return null;
  }
  try {
    const stats = await fsPromises.statfs(path);
    const free = statfsBytes(stats.bsize, stats.bfree) ?? statfsBytes(stats.bsize, stats.bavail);
    const total = statfsBytes(stats.bsize, stats.blocks);
    if (free === null) return null;
    return { free, total };
  } catch {
    return null;
  }
});

ipcMain.handle("save-developer-projects", async (event, projects) => {
  await fileUtils.saveDeveloperProjects(projects);
  return true;
});

ipcMain.handle("load-saved-developer-projects", async () => {
  const protection = await protectionContext();
  const projects = (await fileUtils.loadSavedDeveloperProjects()).flatMap(project => {
    const visible = dropExcludedProject(project, excludeGlobsOf(protection));
    return visible ? [visible] : [];
  });
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

ipcMain.handle("open-path", (_event, target: string) => {
  if (!target) return "";
  return shell.openPath(target);
});

ipcMain.handle("copy-text", (_event, text: string) => {
  if (!text) return;
  clipboard.writeText(text);
});

ipcMain.handle("get-platform", () => process.platform);

ipcMain.handle("relaunch-elevated", () => {
  if (process.platform !== "win32") return;

  const env = elevationCommandEnv(process.execPath, process.argv.slice(1));
  spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "Start-Process -FilePath $env:DEVNULLIFIER_EXE -ArgumentList $env:DEVNULLIFIER_ARGS -Verb RunAs"
    ],
    {
      detached: true,
      shell: false,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env, ...env }
    }
  ).unref();
  app.quit();
}); 