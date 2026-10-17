export interface FolderItem {
  path: string;
  size: number;
  modifiedAt?: string | null;
  keyword?: string;
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
  code?: string;
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
  modifiedAt?: string | null;
  keyword?: string;
}

export interface ToolCacheItem {
  id: string;
  parentId: string;
  parentLabel: string;
  parentPath: string;
  parentDescription: string;
  label: string;
  path: string;
  size: number;
  category: string;
  categoryLabel: string;
  description: string;
}

export interface ToolCacheCatalogPart {
  id: string;
  label: string;
  path: string;
  description: string;
}

export interface ToolCacheCatalogItem {
  id: string;
  label: string;
  path: string;
  description: string;
  parts: ToolCacheCatalogPart[];
  discoversChildren: boolean;
}

export interface ToolCacheCatalogCategory {
  id: string;
  label: string;
  items: ToolCacheCatalogItem[];
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
  scanGlobalCaches: (locale?: string) => Promise<ToolCacheItem[]>;
  getToolCacheCatalog: (locale?: string) => Promise<ToolCacheCatalogCategory[]>;
  onToolCacheScanProgress: (callback: (progress: { checked: number; total: number; path: string }) => void) => void;
  onToolCacheFound: (callback: (item: ToolCacheItem) => void) => void;
  stopAppDataScan: () => Promise<void>;
  stopDeveloperScan: () => Promise<void>;
  deleteFolders: (folderPaths: string[]) => Promise<DeleteResult[]>;
  getDeletionLog: () => Promise<DeletionLogEntry[]>;
  appendDeletionLog: (
    entries: Array<Pick<DeletionLogEntry, "path" | "size" | "status">>
  ) => Promise<DeletionLogEntry[]>;
  exportDeletionLog: () => Promise<{ saved: boolean }>;
  getCleanerRules: () => Promise<CleanerRules>;
  setCleanerRules: (rules: Partial<CleanerRules>) => Promise<CleanerRules>;
  getCustomScanRules: () => Promise<CustomScanRules>;
  setCustomScanRules: (rules: CustomScanRulesUpdate) => Promise<CustomScanRules>;
  selectDirectory: () => Promise<string | null>;
  getUserHome: () => Promise<string>;
  getFolderContents: (folderPath: string) => Promise<FolderContents[]>;
  onScanProgress: (callback: (count: number) => void) => void;
  onScanCurrentPath: (callback: (path: string, visited?: number) => void) => void;
  onDeveloperScanCurrentPath: (callback: (path: string, visited?: number) => void) => void;
  onDeveloperScanVisited: (callback: (count: number) => void) => void;
  onDeleteProgress: (callback: (count: number) => void) => void;
  onScanFolderFound: (callback: (folders: Folder[]) => void) => void;
  onDeveloperProjectFound: (callback: (project: ProjectInfo) => void) => void;
  onUpdateStatus: (callback: (status: { message: string; data?: any }) => void) => void;
  onScanAccessDenied: (callback: (deniedPath: string) => void) => void;
  checkForUpdates: () => Promise<void>;
  quitAndInstall: () => Promise<void>;
  removeAllListeners: (channel: string) => void;
  saveFolders: (folders: FolderItem[]) => Promise<void>;
  loadSavedFolders: () => Promise<FolderItem[]>;
  getSavedFoldersCount: () => Promise<number>;
  getDirectorySize: (path: string) => Promise<number>;
  diskFree: (path: string) => Promise<{ free: number; total: number | null } | null>;
  saveDeveloperProjects: (projects: ProjectInfo[]) => Promise<void>;
  loadSavedDeveloperProjects: () => Promise<ProjectInfo[]>;
  getSavedDeveloperProjectsCount: () => Promise<number>;
  setUpdateChannel: (channel: 'latest' | 'latest-dev') => Promise<void>;
  getLocale: () => Promise<string>;
  openPath: (target: string) => Promise<string>;
  copyText: (text: string) => Promise<void>;
  platform: string;
  getPlatform: () => Promise<NodeJS.Platform>;
  lockingProcess: (target: string) => Promise<string | null>;
  relaunchElevated: () => Promise<void>;
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
import type { CustomScanRules, CustomScanRulesUpdate } from "../../main/customScanRules";
import type { DeletionLogEntry } from "../../main/deletionLog";
