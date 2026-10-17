export interface FolderItem {
  path: string;
  size: number;
}

export interface TreeItem {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  itemCount?: number;
  children: TreeItem[];
}

export interface FlatTreeItem {
  item: TreeItem;
  depth: number;
  isExpanded: boolean;
}

export interface DeleteResult {
  path: string;
  success: boolean | "partial";
}

export interface FolderContents {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  itemCount: number;
}

export interface Folder {
  path: string;
  size: number;
  name: string;
}

export interface ElectronAPI {
  getAppDataPaths: () => Promise<string[]>;
  scanFolders: (paths: string[], maxDepth: number, resetAllowlist?: boolean) => Promise<FolderItem[]>;
  scanDeveloperCaches: (
    basePaths: string[],
    enabledCategories: DeveloperCategory[],
    maxDepth?: number,
    resetAllowlist?: boolean
  ) => Promise<ProjectInfo[]>;
  stopAppDataScan: () => Promise<void>;
  stopDeveloperScan: () => Promise<void>;
  deleteFolders: (folderPaths: string[]) => Promise<DeleteResult[]>;
  getCleanerRules: () => Promise<CleanerRules>;
  setCleanerRules: (rules: Partial<CleanerRules>) => Promise<CleanerRules>;
  selectDirectory: () => Promise<string | null>;
  getUserHome: () => Promise<string>;
  getFolderContents: (folderPath: string) => Promise<FolderContents[]>;
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
  setUpdateChannel: (channel: 'latest' | 'latest-dev') => Promise<void>;
  getLocale: () => Promise<string>;
}

// Add global type augmentation for Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Import types needed for ElectronAPI
import type { ProjectInfo, DeveloperCategory } from "./developer-cleaner";
import type { CleanerRules } from "../../main/cleanerRules";
