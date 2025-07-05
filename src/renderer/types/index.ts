// Export all types from different modules
export * from "./developer-cleaner";
export * from "./common";
import type { FolderItem } from "./common";
import type { ProjectInfo, DeveloperCategory } from "./developer-cleaner";

interface Folder {
  path: string;
  size: number;
  name: string;
}

interface ElectronAPI {
  getAppDataPaths: () => Promise<string[]>;
  scanFolders: (paths: string[], maxDepth: number) => Promise<void>;
  scanDeveloperCaches: (basePaths: string[], enabledCategories: DeveloperCategory[]) => Promise<void>;
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
  onScanFolderFound: (callback: (folders: Folder[]) => void) => void;
  onDeveloperProjectFound: (callback: (project: ProjectInfo) => void) => void;
  onUpdateStatus: (callback: (status: { message: string; data?: any }) => void) => void;
  checkForUpdates: () => Promise<void>;
  quitAndInstall: () => Promise<void>;
  removeAllListeners: (channel: string) => void;
  saveFolders: (folders: FolderItem[]) => Promise<void>;
  loadSavedFolders: () => Promise<FolderItem[]>;
  getSavedFoldersCount: () => Promise<number>;
  getDirectorySize: (path: string) => Promise<number>;
  saveDeveloperProjects: (projects: ProjectInfo[]) => Promise<void>;
  loadSavedDeveloperProjects: () => Promise<ProjectInfo[]>;
  getSavedDeveloperProjectsCount: () => Promise<number>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export type { ElectronAPI, Folder }
