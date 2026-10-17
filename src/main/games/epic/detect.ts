import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type EpicDetectDeps = {
  platform?: NodeJS.Platform;
  readRegistryAppDataPath?: () => Promise<string | null>;
  pathExists?: (target: string) => Promise<boolean>;
};

const DEFAULT_MANIFESTS = path.join(
  process.env.ProgramData || "C:\\ProgramData",
  "Epic",
  "EpicGamesLauncher",
  "Data",
  "Manifests"
);

async function defaultPathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/** Query Windows registry for EpicGamesLauncher AppDataPath. */
export async function readWindowsEpicAppDataPath(): Promise<string | null> {
  const keys = [
    "HKLM\\SOFTWARE\\Epic Games\\EpicGamesLauncher",
    "HKLM\\SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher"
  ];

  for (const key of keys) {
    try {
      const { stdout } = await execFileAsync("reg", ["query", key, "/v", "AppDataPath"], {
        windowsHide: true
      });
      const match = stdout.match(/REG_SZ\s+(.+)$/m);
      const found = match?.[1]?.trim();
      if (found) return found.replace(/\//g, "\\");
    } catch {
      // try next
    }
  }
  return null;
}

export function epicManifestsDir(appDataPath: string): string {
  return path.join(appDataPath, "Manifests");
}

/**
 * Resolve Epic Games Launcher data root (contains Manifests/).
 * TODO: add Linux / macOS Epic path discovery.
 */
export async function detectEpicDataPath(deps: EpicDetectDeps = {}): Promise<string | null> {
  const platform = deps.platform ?? process.platform;
  const pathExists = deps.pathExists ?? defaultPathExists;
  const readRegistry = deps.readRegistryAppDataPath ?? readWindowsEpicAppDataPath;

  if (platform !== "win32") {
    // TODO: Linux / macOS Epic Games Store path discovery
    return null;
  }

  const fromRegistry = await readRegistry();
  if (fromRegistry) {
    const manifests = epicManifestsDir(fromRegistry);
    if (await pathExists(manifests)) return fromRegistry;
    if (await pathExists(fromRegistry)) return fromRegistry;
  }

  const defaultParent = path.dirname(DEFAULT_MANIFESTS);
  if (await pathExists(DEFAULT_MANIFESTS)) return defaultParent;

  return null;
}
