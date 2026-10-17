import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type SteamDetectDeps = {
  platform?: NodeJS.Platform;
  readRegistrySteamPath?: () => Promise<string | null>;
  pathExists?: (target: string) => Promise<boolean>;
};

const DEFAULT_WIN_STEAM_PATHS = [
  path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Steam"),
  path.join(process.env.ProgramFiles || "C:\\Program Files", "Steam")
];

async function defaultPathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/** Query Windows registry for SteamPath / InstallPath. */
export async function readWindowsSteamPathFromRegistry(): Promise<string | null> {
  const keys = [
    "HKCU\\Software\\Valve\\Steam",
    "HKLM\\Software\\Valve\\Steam",
    "HKLM\\Software\\WOW6432Node\\Valve\\Steam"
  ];
  const valueNames = ["SteamPath", "InstallPath"];

  for (const key of keys) {
    for (const valueName of valueNames) {
      try {
        const { stdout } = await execFileAsync("reg", ["query", key, "/v", valueName], {
          windowsHide: true
        });
        const match = stdout.match(/REG_SZ\s+(.+)$/m);
        const found = match?.[1]?.trim();
        if (found) return found.replace(/\//g, "\\");
      } catch {
        // try next
      }
    }
  }
  return null;
}

/**
 * Resolve Steam install root on this machine.
 * TODO: add Linux (~/.steam/steam, ~/.local/share/Steam) and macOS
 * (~/Library/Application Support/Steam) path discovery.
 */
export async function detectSteamPath(deps: SteamDetectDeps = {}): Promise<string | null> {
  const platform = deps.platform ?? process.platform;
  const pathExists = deps.pathExists ?? defaultPathExists;
  const readRegistry = deps.readRegistrySteamPath ?? readWindowsSteamPathFromRegistry;

  if (platform !== "win32") {
    // TODO: Linux / macOS Steam path discovery
    return null;
  }

  const fromRegistry = await readRegistry();
  if (fromRegistry && (await pathExists(fromRegistry))) {
    return fromRegistry;
  }

  for (const candidate of DEFAULT_WIN_STEAM_PATHS) {
    if (await pathExists(candidate)) return candidate;
  }

  return null;
}
