import fs from 'fs/promises';
import path from 'path';
import type { FolderItem } from '../renderer/types';
import type { ProjectInfo } from '../renderer/types/developer-cleaner';

let userDataPath: string;

export function setUserDataPath(path: string) {
  userDataPath = path;
}

export function getUserDataPath(): string {
  if (!userDataPath) {
    throw new Error("User data path not set");
  }
  return userDataPath;
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeSavedEntry(entry: unknown): (Record<string, unknown> & { path: string }) | null {
    if (typeof entry === 'string') {
        return entry ? { path: entry } : null;
    }
    if (!isRecord(entry) || typeof entry.path !== 'string' || !entry.path) return null;

    const next: Record<string, unknown> & { path: string } = { ...entry, path: entry.path };
    const size = finiteNumber(entry.size);
    if (size === undefined) delete next.size;
    else next.size = size;
    return next;
}

function normalizeSavedList(parsed: unknown): Array<Record<string, unknown> & { path: string }> {
    if (!Array.isArray(parsed)) return [];
    const items: Array<Record<string, unknown> & { path: string }> = [];
    for (const entry of parsed) {
        const normalized = normalizeSavedEntry(entry);
        if (normalized) items.push(normalized);
    }
    return items;
}

function withSavedSize<T>(items: T[]): T[] {
    return items.map(item => {
        if (!isRecord(item) || typeof item.path !== 'string') return item;
        if (finiteNumber(item.size) !== undefined) return item;
        const totalCacheSize = finiteNumber(item.totalCacheSize);
        if (totalCacheSize === undefined) return item;
        return { ...item, size: totalCacheSize } as T;
    });
}

export async function saveFolders(folders: FolderItem[]): Promise<void> {
    const filePath = await getSavedFoldersPath();
    await fs.writeFile(filePath, JSON.stringify(withSavedSize(folders), null, 2), 'utf-8');
}

export async function loadSavedFolders(): Promise<FolderItem[]> {
    try {
        const filePath = await getSavedFoldersPath();
        const data = await fs.readFile(filePath, 'utf-8');
        return normalizeSavedList(JSON.parse(data)) as unknown as FolderItem[];
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
    await fs.writeFile(filePath, JSON.stringify(withSavedSize(projects), null, 2), 'utf-8');
}

export async function loadSavedDeveloperProjects(): Promise<ProjectInfo[]> {
    try {
        const filePath = await getSavedDeveloperProjectsPath();
        const data = await fs.readFile(filePath, 'utf-8');
        return normalizeSavedList(JSON.parse(data)) as unknown as ProjectInfo[];
    } catch {
        return [];
    }
}

export async function getSavedDeveloperProjectsCount(): Promise<number> {
    const projects = await loadSavedDeveloperProjects();
    return projects.length;
}
