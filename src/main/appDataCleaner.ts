import { promises as fs } from "fs";
import fsSync from "fs";
import path from "path";
import os from "os";
import * as fileUtils from "./fileUtils";

export const KEYWORDS = [
  "cache",
  "temp",
  "crash",
  "report",
  "dump",
  "crashes",
  "pending"
];

const KEYWORD_NAME_EXCLUSIONS = new Set(["template", "templates"]);

export function matchedKeyword(folderName: string, keywords: string[]): string | null {
  const name = folderName.toLowerCase();
  if (KEYWORD_NAME_EXCLUSIONS.has(name)) return null;

  for (const keyword of keywords) {
    const normalized = keyword.toLowerCase();
    if (name.startsWith(normalized) || name.endsWith(normalized)) return keyword;
  }
  return null;
}

export function folderNameMatchesKeyword(
  folderName: string,
  keywords: string[]
): boolean {
  return matchedKeyword(folderName, keywords) !== null;
}

function localLowPath(localAppData: string): string | null {
  const separator = localAppData.includes("\\") ? "\\" : "/";
  const parts = localAppData.split(/[\\/]/).filter(part => part.length > 0);
  if (parts.length === 0 || parts[parts.length - 1].toLowerCase() !== "local") {
    return null;
  }
  parts[parts.length - 1] = "LocalLow";
  const prefix = /^[a-zA-Z]:/.test(localAppData) ? "" : localAppData.startsWith("/") ? "/" : "";
  return `${prefix}${parts.join(separator)}`;
}

export function getAppDataPaths() {
  const paths = [];

  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    const localAppData = process.env.LOCALAPPDATA;
    const localLowAppData = localAppData ? localLowPath(localAppData) : null;

    if (appData && fsSync.existsSync(appData)) paths.push(appData);
    if (localAppData && fsSync.existsSync(localAppData)) paths.push(localAppData);
    if (localLowAppData && fsSync.existsSync(localLowAppData)) paths.push(localLowAppData);
  } else if (process.platform === "linux") {
    const homeDir = os.homedir();
    const linuxPaths = [
      path.join(homeDir, ".config"),
      path.join(homeDir, ".cache"),
      path.join(homeDir, ".local/share"),
      path.join(homeDir, ".local/state"),
      "/tmp"
    ];

    linuxPaths.forEach(dirPath => {
      if (fsSync.existsSync(dirPath)) paths.push(dirPath);
    });
  } else if (process.platform === "darwin") {
    const homeDir = os.homedir();
    const macOSPaths = [
      path.join(homeDir, "Library/Caches"),
      path.join(homeDir, "Library/Application Support"),
      path.join(homeDir, "Library/Logs"),
      "/tmp"
    ];

    macOSPaths.forEach(dirPath => {
      if (fsSync.existsSync(dirPath)) paths.push(dirPath);
    });
  }

  return paths;
}

export interface PathDeleteResult {
  path: string;
  success: boolean | "partial";
  code?: string;
}

export function deleteFailureCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string") return code;
  }
  return "error";
}

export async function deletePathResult(
  folderPath: string,
  permitted: boolean,
  remove: (target: string) => Promise<void>
): Promise<PathDeleteResult> {
  if (!permitted) return { path: folderPath, success: false };

  let code: string | undefined;
  const removeCapturing = async (target: string): Promise<void> => {
    try {
      await remove(target);
    } catch (error) {
      code = deleteFailureCode(error);
      throw error;
    }
  };

  try {
    const success = await deleteDirectory(folderPath, removeCapturing);
    if (success !== true && code) return { path: folderPath, success, code };
    return { path: folderPath, success };
  } catch (error) {
    return { path: folderPath, success: false, code: code ?? deleteFailureCode(error) };
  }
}

export async function deleteDirectory(
  dirPath: string,
  trash: (target: string) => Promise<void>
): Promise<boolean | "partial"> {
  let stats;
  try {
    stats = await fs.lstat(dirPath);
  } catch {
    return true;
  }

  try {
    // lstat reports symlinks and Windows junctions as symbolic links.
    // Unlink the link itself so the target is left untouched.
    if (stats.isSymbolicLink()) {
      await fs.unlink(dirPath);
      return true;
    }

    await trash(dirPath);
    return true;
  } catch {
    return false;
  }
}

export async function getDirectorySize(dirPath: string): Promise<number> {
  return fileUtils.getDirSize(dirPath);
}
