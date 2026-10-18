import { contextBridge, ipcRenderer } from "electron";
import { Category, Project } from "../types/developer-cleaner";
import type { FolderItem, ProjectInfo, ElectronAPI, Folder } from "../renderer/types";

interface ScanFoldersOptions {
  paths: string[];
  maxDepth: number;
}

interface ScanDeveloperOptions {
  basePaths: string[];
  enabledCategories: Category[];
  maxDepth?: number;
  resetAllowlist?: boolean;
}

// Export the API type for use in other files
export type { ElectronAPI };

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const api: ElectronAPI = {
  // Get AppData paths
  getAppDataPaths: () => ipcRenderer.invoke("get-appdata-paths"),

  // Scan for folders
  scanFolders: (paths: string[], maxDepth: number, resetAllowlist = false) =>
    ipcRenderer.invoke("scan-folders", { paths, maxDepth, resetAllowlist } as ScanFoldersOptions & { resetAllowlist: boolean }),

  // Scan for developer caches
  scanDeveloperCaches: (
    basePaths: string[],
    enabledCategories: Category[],
    maxDepth?: number,
    resetAllowlist = false
  ) =>
    ipcRenderer.invoke("scan-developer-caches", {
      basePaths,
      enabledCategories,
      maxDepth,
      resetAllowlist
    } as ScanDeveloperOptions),

  scanGlobalCaches: (locale) => ipcRenderer.invoke("scan-global-caches", locale),
  getToolCacheCatalog: (locale) => ipcRenderer.invoke("get-tool-cache-catalog", locale),
  pruneContainerEngine: (engine) => ipcRenderer.invoke("prune-container-engine", engine),
  scanSystemCaches: (locale) => ipcRenderer.invoke("scan-system-caches", locale),
  getSystemCacheCatalog: (locale) => ipcRenderer.invoke("get-system-cache-catalog", locale),
  scanGames: () => ipcRenderer.invoke("scan-games"),
  uninstallGame: (request) => ipcRenderer.invoke("uninstall-game", request),
  onToolCacheScanProgress: (callback) => {
    ipcRenderer.on("tool-cache-scan-progress", (_event, progress) => callback(progress));
  },
  onToolCacheFound: (callback) => {
    ipcRenderer.on("tool-cache-found", (_event, item) => callback(item));
  },
  onSystemCacheScanProgress: (callback) => {
    ipcRenderer.on("system-cache-scan-progress", (_event, progress) => callback(progress));
  },
  onSystemCacheFound: (callback) => {
    ipcRenderer.on("system-cache-found", (_event, item) => callback(item));
  },

  // Stop scanning
  stopAppDataScan: () => ipcRenderer.invoke("stop-appdata-scan"),

  // Stop developer scanning
  stopDeveloperScan: () => ipcRenderer.invoke("stop-developer-scan"),

  // Delete folders. Permanent mode is a saved main-process setting, not an argument.
  deleteFolders: (folderPaths: string[]) =>
    ipcRenderer.invoke("delete-folders", folderPaths),

  getDeletionLog: () => ipcRenderer.invoke("get-deletion-log"),
  appendDeletionLog: entries => ipcRenderer.invoke("append-deletion-log", entries),
  exportDeletionLog: () => ipcRenderer.invoke("export-deletion-log"),

  getCleanerRules: () => ipcRenderer.invoke("get-cleaner-rules"),
  setCleanerRules: rules => ipcRenderer.invoke("set-cleaner-rules", rules),
  getCustomScanRules: () => ipcRenderer.invoke("get-custom-scan-rules"),
  setCustomScanRules: rules => ipcRenderer.invoke("set-custom-scan-rules", rules),

  // Select directory
  selectDirectory: () => ipcRenderer.invoke("select-directory"),

  // Get user home directory
  getUserHome: () => ipcRenderer.invoke("get-user-home"),

  // Get folder contents
  getFolderContents: (folderPath: string) =>
    ipcRenderer.invoke("get-folder-contents", folderPath),

  // Listen for directories entered during a scan
  onScanProgress: (callback: (count: number) => void) => {
    ipcRenderer.on("scan-progress", (_event, count) => callback(count));
  },

  // Listen for current path being scanned
  onScanCurrentPath: (callback: (path: string, visited?: number) => void) => {
    ipcRenderer.on("scan-current-path", (_event, path: string, visited?: number) =>
      callback(path, visited)
    );
  },

  onDeveloperScanCurrentPath: (callback: (path: string, visited?: number) => void) => {
    ipcRenderer.on("developer-scan-current-path", (_event, path: string, visited?: number) =>
      callback(path, visited)
    );
  },

  onDeveloperScanVisited: (callback: (count: number) => void) => {
    ipcRenderer.on("developer-scan-visited", (_event, count: number) => callback(count));
  },

  // Listen for delete progress
  onDeleteProgress: (callback: (count: number) => void) => {
    ipcRenderer.on("delete-progress", (_event, count) => callback(count));
  },

  // Listen for scan-folder-found (real-time folder updates)
  onScanFolderFound: (callback: (folders: Folder[]) => void) => {
    ipcRenderer.on("scan-folder-found", (_event, folders) => callback(folders));
  },

  // Listen for developer-project-found (real-time project updates)
  onDeveloperProjectFound: (callback: (project: ProjectInfo) => void) => {
    ipcRenderer.on("developer-project-found", (_event, mainProject: Project) => {
      // Convert Project to ProjectInfo
      const project: ProjectInfo = {
        path: mainProject.path,
        type: mainProject.type,
        lastModified: mainProject.lastModified || "",
        totalCacheSize: mainProject.totalCacheSize,
        selectedCacheSize: 0, // Default to 0 since main process doesn't track this
        caches: mainProject.caches.map(cache => ({
          ...cache,
          category: cache.category || "Unknown" as any, // Convert string to CacheCategory
          selectedSize: 0 // Default to 0 since main process doesn't track this
        }))
      };
      callback(project);
    });
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Add new handlers
  saveFolders: (folders: FolderItem[]) => ipcRenderer.invoke("save-folders", folders),
  loadSavedFolders: () => ipcRenderer.invoke("load-saved-folders"),
  getSavedFoldersCount: () => ipcRenderer.invoke("get-saved-folders-count"),
  getDirectorySize: (path: string) => ipcRenderer.invoke("get-directory-size", path),
  diskFree: (path: string) => ipcRenderer.invoke("disk-free", path),
  
  // Developer cleaner handlers
  saveDeveloperProjects: (projects: ProjectInfo[]) => ipcRenderer.invoke("save-developer-projects", projects),
  loadSavedDeveloperProjects: () => ipcRenderer.invoke("load-saved-developer-projects"),
  getSavedDeveloperProjectsCount: () => ipcRenderer.invoke("get-saved-developer-projects-count"),

  // Update handlers
  onUpdateStatus: (callback: (status: { message: string; data?: any }) => void) => {
    ipcRenderer.on("update-status", (_event, status) => callback(status));
  },
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  quitAndInstall: () => ipcRenderer.invoke("quit-and-install"),

  // New handler
  setUpdateChannel: (channel: 'latest' | 'latest-dev') => ipcRenderer.invoke('set-update-channel', channel),
  getLocale: () => ipcRenderer.invoke('get-locale'),

  openPath: (target: string) => ipcRenderer.invoke("open-path", target),
  copyText: (text: string) => ipcRenderer.invoke("copy-text", text),
  platform: process.platform,
  getPlatform: () => ipcRenderer.invoke("get-platform"),
  lockingProcess: (target: string) => ipcRenderer.invoke("locking-process", target),

  onScanAccessDenied: (callback: (deniedPath: string) => void) => {
    ipcRenderer.on("scan-access-denied", (_event, deniedPath: string) => callback(deniedPath));
  },

  relaunchElevated: () => ipcRenderer.invoke("relaunch-elevated"),
};

contextBridge.exposeInMainWorld("electronAPI", api);
