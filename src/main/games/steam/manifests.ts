import { promises as fs } from "fs";
import path from "path";
import type { GameAppKind } from "../types";
import { parseVdf, vdfObject, vdfString } from "../vdf";
import { commonDir, steamappsDir } from "./library";

export interface SteamManifestApp {
  appId: string;
  name: string;
  installPath: string;
  size: number;
  kind: GameAppKind;
}

export type ManifestDeps = {
  readdir?: (dir: string) => Promise<string[]>;
  readFile?: (filePath: string) => Promise<string>;
  pathExists?: (target: string) => Promise<boolean>;
};

const TOOL_NAME_RE =
  /redistributable|steamworks|proton|runtime|sdk|dedicated server|server\b|workshop tools|content builder/i;

async function defaultPathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export function inferSteamKind(name: string): GameAppKind {
  if (TOOL_NAME_RE.test(name)) return "tool";
  return "game";
}

export function parseAppManifest(
  text: string,
  libraryRoot: string
): SteamManifestApp | null {
  let parsed;
  try {
    parsed = parseVdf(text);
  } catch {
    return null;
  }

  const state =
    vdfObject(parsed, "AppState") ??
    vdfObject(parsed, "appstate") ??
    parsed;

  const appId = vdfString(state, "appid") ?? vdfString(state, "AppID");
  const name = vdfString(state, "name") ?? vdfString(state, "installdir");
  const installdir = vdfString(state, "installdir");
  if (!appId || !name) return null;

  // Skip incompletely installed / not fully present if StateFlags missing install bit?
  // StateFlags 4 = fully installed; still list anything with a manifest (uninstallable).
  const sizeRaw = vdfString(state, "SizeOnDisk") ?? vdfString(state, "BytesToDownload") ?? "0";
  const size = Number.parseInt(sizeRaw, 10);
  const installPath = installdir
    ? path.join(commonDir(libraryRoot), installdir)
    : path.join(steamappsDir(libraryRoot), `appmanifest_${appId}.acf`);

  return {
    appId,
    name,
    installPath,
    size: Number.isFinite(size) && size >= 0 ? size : 0,
    kind: inferSteamKind(name)
  };
}

export async function listManifestsInLibrary(
  libraryRoot: string,
  deps: ManifestDeps = {}
): Promise<SteamManifestApp[]> {
  const readdir = deps.readdir ?? ((dir: string) => fs.readdir(dir));
  const readFile = deps.readFile ?? ((filePath: string) => fs.readFile(filePath, "utf8"));
  const pathExists = deps.pathExists ?? defaultPathExists;

  const appsDir = steamappsDir(libraryRoot);
  if (!(await pathExists(appsDir))) return [];

  let entries: string[];
  try {
    entries = await readdir(appsDir);
  } catch {
    return [];
  }

  const results: SteamManifestApp[] = [];
  for (const entry of entries) {
    if (!/^appmanifest_\d+\.acf$/i.test(entry)) continue;
    const filePath = path.join(appsDir, entry);
    try {
      const text = await readFile(filePath);
      const app = parseAppManifest(text, libraryRoot);
      if (app) results.push(app);
    } catch {
      // skip broken manifest
    }
  }
  return results;
}
