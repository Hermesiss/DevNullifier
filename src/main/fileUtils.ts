import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import type { FolderItem } from '../renderer/types';

// Calculate directory size recursively
export async function getDirSize(dirPath: string): Promise<number> {
  let size = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        size += await getDirSize(fullPath);
      } else {
        try {
          const stats = await fs.stat(fullPath);
          size += stats.size;
        } catch (err) {
          console.warn("Error getting file size:", err);
        }
      }
    }
  } catch (err) {
    console.warn("Error getting directory size:", err);
  }

  return size;
}

export async function getSavedFoldersPath(): Promise<string> {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'saved-folders.json');
}

export async function saveFolders(folders: FolderItem[]): Promise<void> {
    const filePath = await getSavedFoldersPath();
    await fs.writeFile(filePath, JSON.stringify(folders, null, 2), 'utf-8');
}

export async function loadSavedFolders(): Promise<FolderItem[]> {
    try {
        const filePath = await getSavedFoldersPath();
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

export async function getSavedFoldersCount(): Promise<number> {
    try {
        const folders = await loadSavedFolders();
        return folders.length;
    } catch (error) {
        return 0;
    }
}
