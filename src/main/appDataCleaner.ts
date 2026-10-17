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

export function folderNameMatchesKeyword(
  folderName: string,
  keywords: string[]
): boolean {
  const name = folderName.toLowerCase();
  if (KEYWORD_NAME_EXCLUSIONS.has(name)) return false;

  return keywords.some(keyword => {
    const normalized = keyword.toLowerCase();
    return name.startsWith(normalized) || name.endsWith(normalized);
  });
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
