import { contextBridge, ipcRenderer } from "electron";
import { Category, Project } from "../types/developer-cleaner";
import type { FolderItem, ProjectInfo } from "../renderer/types";

interface Folder {
  path: string;
  size: number;
  name: string;
}

interface ScanFoldersOptions {
  paths: string[];
  maxDepth: number;
}

interface ScanDeveloperOptions {
  basePaths: string[];
  enabledCategories: Category[];
}

// Define the shape of our API
interface ElectronAPI {
  getAppDataPaths: () => Promise<string[]>;
  scanFolders: (paths: string[], maxDepth: number) => Promise<void>;
  scanDeveloperCaches: (basePaths: string[], enabledCategories: Category[]) => Promise<void>;
  stopAppDataScan: () => Promise<void>;
  stopDeveloperScan: () => Promise<void>;
  deleteFolders: (folderPaths: string[]) => Promise<void>;
  checkAdmin: () => Promise<boolean>;
  selectDirectory: () => Promise<string | null>;
  getUserHome: () => Promise<string>;
  getFolderContents: (folderPath: string) => Promise<string[]>;
  onScanProgress: (callback: (count: number) => void) => void;
  onScanCurrentPath: (callback: (path: string) => void) => void;
  onDeleteProgress: (callback: (count: number) => void) => void;
  onScanFolderFound: (callback: (folder: Folder) => void) => void;
  onDeveloperProjectFound: (callback: (project: Project) => void) => void;
  removeAllListeners: (channel: string) => void;
  saveFolders: (folders: FolderItem[]) => Promise<void>;
  loadSavedFolders: () => Promise<FolderItem[]>;
  getSavedFoldersCount: () => Promise<number>;
  getDirectorySize: (path: string) => Promise<number>;
  saveDeveloperProjects: (projects: ProjectInfo[]) => Promise<void>;
  loadSavedDeveloperProjects: () => Promise<ProjectInfo>;
  getSavedDeveloperProjectsCount: () => Promise<number>;
}

// Export the API type for use in other files
export type { ElectronAPI };

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const api: ElectronAPI = {
  // Get AppData paths
  getAppDataPaths: () => ipcRenderer.invoke("get-appdata-paths"),

  // Scan for folders
  scanFolders: (paths: string[], maxDepth: number) =>
    ipcRenderer.invoke("scan-folders", { paths, maxDepth } as ScanFoldersOptions),

  // Scan for developer caches
  scanDeveloperCaches: (basePaths: string[], enabledCategories: Category[]) =>
    ipcRenderer.invoke("scan-developer-caches", {
      basePaths,
      enabledCategories
    } as ScanDeveloperOptions),

  // Stop scanning
  stopAppDataScan: () => ipcRenderer.invoke("stop-appdata-scan"),

  // Stop developer scanning
  stopDeveloperScan: () => ipcRenderer.invoke("stop-developer-scan"),

  // Delete folders
  deleteFolders: (folderPaths: string[]) =>
    ipcRenderer.invoke("delete-folders", folderPaths),

  // Check admin privileges
  checkAdmin: () => ipcRenderer.invoke("check-admin"),

  // Select directory
  selectDirectory: () => ipcRenderer.invoke("select-directory"),

  // Get user home directory
  getUserHome: () => ipcRenderer.invoke("get-user-home"),

  // Get folder contents
  getFolderContents: (folderPath: string) =>
    ipcRenderer.invoke("get-folder-contents", folderPath),

  // Listen for scan progress
  onScanProgress: (callback: (count: number) => void) => {
    ipcRenderer.on("scan-progress", (_event, count) => callback(count));
  },

  // Listen for current path being scanned
  onScanCurrentPath: (callback: (path: string) => void) => {
    ipcRenderer.on("scan-current-path", (_event, path) => callback(path));
  },

  // Listen for delete progress
  onDeleteProgress: (callback: (count: number) => void) => {
    ipcRenderer.on("delete-progress", (_event, count) => callback(count));
  },

  // Listen for scan-folder-found (real-time folder updates)
  onScanFolderFound: (callback: (folder: Folder) => void) => {
    ipcRenderer.on("scan-folder-found", (_event, folder) => callback(folder));
  },

  // Listen for developer-project-found (real-time project updates)
  onDeveloperProjectFound: (callback: (project: Project) => void) => {
    ipcRenderer.on("developer-project-found", (_event, project) =>
      callback(project)
    );
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
  
  // Developer cleaner handlers
  saveDeveloperProjects: (projects: any[]) => ipcRenderer.invoke("save-developer-projects", projects),
  loadSavedDeveloperProjects: () => ipcRenderer.invoke("load-saved-developer-projects"),
  getSavedDeveloperProjectsCount: () => ipcRenderer.invoke("get-saved-developer-projects-count"),
};

contextBridge.exposeInMainWorld("electronAPI", api);
