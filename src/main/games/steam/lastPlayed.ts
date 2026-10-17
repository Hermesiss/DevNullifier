import { promises as fs } from "fs";
import path from "path";
import { parseVdf, vdfObject, vdfString, type VdfObject } from "../vdf";

export type LastPlayedDeps = {
  readdir?: (dir: string) => Promise<string[]>;
  readFile?: (filePath: string) => Promise<string>;
  pathExists?: (target: string) => Promise<boolean>;
};

async function defaultPathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function collectLastPlayedFromApps(apps: VdfObject | undefined, into: Map<string, number>): void {
  if (!apps) return;
  for (const [appId, entry] of Object.entries(apps)) {
    if (!entry || typeof entry === "string") continue;
    const raw = vdfString(entry, "LastPlayed") ?? vdfString(entry, "lastplayed");
    if (!raw) continue;
    const seconds = Number.parseInt(raw, 10);
    if (!Number.isFinite(seconds) || seconds <= 0) continue;
    const ms = seconds * 1000;
    const prev = into.get(appId);
    if (prev === undefined || ms > prev) into.set(appId, ms);
  }
}

/** Parse one localconfig.vdf into appId → lastPlayedAt (ms). */
export function parseLastPlayedMap(text: string): Map<string, number> {
  const map = new Map<string, number>();
  let parsed: VdfObject;
  try {
    parsed = parseVdf(text);
  } catch {
    return map;
  }

  const store =
    vdfObject(parsed, "UserLocalConfigStore") ??
    vdfObject(parsed, "userlocalconfigstore") ??
    parsed;

  const apps =
    vdfObject(store, "Software", "Valve", "Steam", "apps") ??
    vdfObject(store, "software", "valve", "Steam", "apps") ??
    vdfObject(store, "Software", "Valve", "Steam", "Apps");

  collectLastPlayedFromApps(apps, map);
  return map;
}

/**
 * Merge LastPlayed from all userdata/<id>/config/localconfig.vdf under steamRoot.
 * When multiple Steam users exist, keep the newest timestamp per app.
 */
export async function loadSteamLastPlayed(
  steamRoot: string,
  deps: LastPlayedDeps = {}
): Promise<Map<string, number>> {
  const readdir = deps.readdir ?? ((dir: string) => fs.readdir(dir));
  const readFile = deps.readFile ?? ((filePath: string) => fs.readFile(filePath, "utf8"));
  const pathExists = deps.pathExists ?? defaultPathExists;

  const merged = new Map<string, number>();
  const userdata = path.join(steamRoot, "userdata");
  if (!(await pathExists(userdata))) return merged;

  let userDirs: string[];
  try {
    userDirs = await readdir(userdata);
  } catch {
    return merged;
  }

  for (const userId of userDirs) {
    if (userId === "0" || userId === "anonymous") continue;
    const configPath = path.join(userdata, userId, "config", "localconfig.vdf");
    if (!(await pathExists(configPath))) continue;
    try {
      const text = await readFile(configPath);
      for (const [appId, ms] of parseLastPlayedMap(text)) {
        const prev = merged.get(appId);
        if (prev === undefined || ms > prev) merged.set(appId, ms);
      }
    } catch {
      // skip broken config
    }
  }

  return merged;
}
