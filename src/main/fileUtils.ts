import fs from 'fs/promises';
import path from 'path';
import type { FolderItem } from '../renderer/types';
import type { ProjectInfo } from '../renderer/types/developer-cleaner';

let userDataPath: string;

export function setUserDataPath(path: string) {
  userDataPath = path;
}

// Size of a file, or of a directory without following symlinks or junctions.
export async function getDirSize(
  targetPath: string,
  shouldContinue: () => boolean = () => true
): Promise<number> {
  if (!shouldContinue()) return 0;

  let stats;
  try {
    stats = await fs.lstat(targetPath);
  } catch (err) {
    console.warn("Error getting directory size:", err);
    return 0;
  }

  if (stats.isSymbolicLink()) return 0;
  if (stats.isFile()) return stats.size;
  if (!stats.isDirectory()) return 0;

  let size = 0;
  let entries;
  try {
    entries = await fs.readdir(targetPath, { withFileTypes: true });
  } catch (err) {
    console.warn("Error getting directory size:", err);
    return 0;
  }

  for (const entry of entries) {
    if (!shouldContinue()) return size;
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isSymbolicLink()) continue;

    try {
      if (entry.isDirectory()) {
        const child = await fs.lstat(fullPath);
        if (child.isSymbolicLink()) continue;
        size += await getDirSize(fullPath, shouldContinue);
      } else {
        const fileStats = await fs.lstat(fullPath);
        if (!fileStats.isSymbolicLink()) size += fileStats.size;
      }
    } catch (err) {
      console.warn("Error getting file size:", err);
    }
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
