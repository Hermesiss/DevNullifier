import { promises as fs } from "fs";
import path from "path";
import { parseVdf, vdfObject, vdfString } from "../vdf";

export type LibraryDeps = {
  readFile?: (filePath: string) => Promise<string>;
};

/**
 * Collect Steam library roots from steamapps/libraryfolders.vdf.
 * Always includes steamRoot itself when steamapps exists.
 */
export async function listSteamLibraryPaths(
  steamRoot: string,
  deps: LibraryDeps = {}
): Promise<string[]> {
  const readFile = deps.readFile ?? ((filePath: string) => fs.readFile(filePath, "utf8"));
  const roots = new Set<string>();
  roots.add(path.normalize(steamRoot));

  const libraryFile = path.join(steamRoot, "steamapps", "libraryfolders.vdf");
  try {
    const text = await readFile(libraryFile);
    const parsed = parseVdf(text);
    const folders =
      vdfObject(parsed, "libraryfolders") ??
      vdfObject(parsed, "LibraryFolders") ??
      parsed;

    for (const [key, value] of Object.entries(folders)) {
      if (key === "contentstatsid") continue;
      if (typeof value === "string") {
        // Older format: "1" "D:\\SteamLibrary"
        if (/^\d+$/.test(key) && value) roots.add(path.normalize(value));
        continue;
      }
      const folderPath = vdfString(value, "path") ?? vdfString(value, "Path");
      if (folderPath) roots.add(path.normalize(folderPath));
    }
  } catch {
    // Missing or broken libraryfolders.vdf — still use steamRoot
  }

  return [...roots];
}

export function steamappsDir(libraryRoot: string): string {
  return path.join(libraryRoot, "steamapps");
}

export function commonDir(libraryRoot: string): string {
  return path.join(libraryRoot, "steamapps", "common");
}
