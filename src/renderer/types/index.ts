// Export all types from different modules
export * from "./developer-cleaner";
export * from "./common";
import type { FolderItem } from "./common";
import type { ProjectInfo, DeveloperCategory } from "./developer-cleaner";

declare global {
  interface Window {
    electronAPI: {
      // ... existing functions ...
      saveFolders: (folders: FolderItem[]) => Promise<boolean>;
      loadSavedFolders: () => Promise<FolderItem[]>;
      getSavedFoldersCount: () => Promise<number>;
      getDirectorySize: (path: string) => Promise<number>;
      // Developer cleaner functions
      saveDeveloperProjects: (projects: ProjectInfo[]) => Promise<boolean>;
      loadSavedDeveloperProjects: () => Promise<ProjectInfo[]>;
      getSavedDeveloperProjectsCount: () => Promise<number>;
      selectDirectory: () => Promise<string | null>;
      getUserHome: () => Promise<string>;
      scanDeveloperCaches: (paths: string[], categories: Partial<DeveloperCategory>[]) => Promise<ProjectInfo[]>;
      stopDeveloperScan: () => Promise<void>;
      onDeveloperProjectFound: (callback: (project: ProjectInfo) => void) => void;
      removeAllListeners: (channel: string) => void;
      deleteFolders: (paths: string[]) => Promise<{ path: string; success: boolean | 'partial' }[]>;
      // ... rest of the file ...
    };
  }
}
