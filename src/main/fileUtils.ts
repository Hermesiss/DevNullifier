import fs from 'fs/promises';
import path from 'path';
import type { FolderItem } from '../renderer/types';
import type { ProjectInfo } from '../renderer/types/developer-cleaner';

let userDataPath: string;

export function setUserDataPath(path: string) {
  userDataPath = path;
}

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
    if (!userDataPath) {
      throw new Error('User data path not set');
    }
    return path.join(userDataPath, 'saved-folders-appdata.json');
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
    } catch {
        return [];
    }
}

export async function getSavedFoldersCount(): Promise<number> {
    const folders = await loadSavedFolders();
    return folders.length;
}

export async function getSavedDeveloperProjectsPath(): Promise<string> {
    if (!userDataPath) {
      throw new Error('User data path not set');
    }
    return path.join(userDataPath, 'saved-folders-developer.json');
}

export async function saveDeveloperProjects(projects: ProjectInfo[]): Promise<void> {
    const filePath = await getSavedDeveloperProjectsPath();
    await fs.writeFile(filePath, JSON.stringify(projects, null, 2), 'utf-8');
}

export async function loadSavedDeveloperProjects(): Promise<ProjectInfo[]> {
    try {
        const filePath = await getSavedDeveloperProjectsPath();
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

export async function getSavedDeveloperProjectsCount(): Promise<number> {
    const projects = await loadSavedDeveloperProjects();
    return projects.length;
}
