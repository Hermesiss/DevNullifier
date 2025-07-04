// Export all types from different modules
export * from "./developer-cleaner";
export * from "./common";
import type { FolderItem } from "./common";

declare global {
  interface Window {
    electronAPI: {
      // ... existing functions ...
      saveFolders: (folders: FolderItem[]) => Promise<boolean>;
      loadSavedFolders: () => Promise<FolderItem[]>;
      getSavedFoldersCount: () => Promise<number>;
      getDirectorySize: (path: string) => Promise<number>;
      // ... rest of the file ...
    };
  }
}
