// Export all types from different modules
export * from "./developer-cleaner";
export * from "./common";
import type { FolderItem } from "./common";
import type { ProjectInfo, DeveloperCategory } from "./developer-cleaner";

declare global {
  interface Window {
    electronAPI: {
      getAppDataPaths: () => Promise<string[]>;
      scanFolders: (paths: string[], maxDepth: number) => Promise<void>;
      stopAppDataScan: () => Promise<void>;
      saveFolders: (folders: FolderItem[]) => Promise<void>;
      loadSavedFolders: () => Promise<FolderItem[]>;
      getSavedFoldersCount: () => Promise<number>;
      getDirectorySize: (path: string) => Promise<number>;
      
      saveDeveloperProjects: (projects: ProjectInfo[]) => Promise<void>;
      loadSavedDeveloperProjects: () => Promise<ProjectInfo[]>;
      getSavedDeveloperProjectsCount: () => Promise<number>;
      selectDirectory: () => Promise<string | null>;
      getUserHome: () => Promise<string>;
      scanDeveloperCaches: (paths: string[], categories: Partial<DeveloperCategory>[]) => Promise<ProjectInfo[]>;
      stopDeveloperScan: () => Promise<void>;
      checkAdmin: () => Promise<boolean>;
      getFolderContents: (folderPath: string) => Promise<string[]>;
      
      // Event listeners
      onScanProgress: (callback: (count: number) => void) => void;
      onScanCurrentPath: (callback: (path: string) => void) => void;
      onDeleteProgress: (callback: (count: number) => void) => void;
      onScanFolderFound: (callback: (folder: { path: string; size: number; name: string }) => void) => void;
      onDeveloperProjectFound: (callback: (project: ProjectInfo) => void) => void;
      removeAllListeners: (channel: string) => void;
      
      // Delete operations
      deleteFolders: (paths: string[]) => Promise<{ path: string; success: boolean | 'partial' }[]>;
    };
  }
}
