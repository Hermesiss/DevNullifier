import { promises as fs } from "fs";
import path from "path";
import type { GameAppKind } from "../types";
import { epicManifestsDir } from "./detect";

export interface EpicManifestApp {
  appId: string;
  name: string;
  installPath: string;
  size: number;
  kind: GameAppKind;
  catalogNamespace: string;
  catalogItemId: string;
  appName: string;
  /** Absolute path to the .item manifest file. */
  itemFilePath: string;
}

export type EpicManifestDeps = {
  readdir?: (dir: string) => Promise<string[]>;
  readFile?: (filePath: string) => Promise<string>;
  pathExists?: (target: string) => Promise<boolean>;
};

interface EpicItemJson {
  DisplayName?: string;
  AppName?: string;
  CatalogNamespace?: string;
  CatalogItemId?: string;
  InstallLocation?: string;
  InstallSize?: number | string;
  bIsIncompleteInstall?: boolean;
  MainGameAppName?: string;
  bIsApplication?: boolean;
}

const TOOL_NAME_RE = /capture|editor|launcher|sdk|tool|server|redistributable/i;

async function defaultPathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export function inferEpicKind(name: string, mainGameAppName?: string): GameAppKind {
  if (mainGameAppName && mainGameAppName.trim()) return "other";
  if (TOOL_NAME_RE.test(name)) return "tool";
  return "game";
}

export function parseEpicItem(text: string, itemFilePath = ""): EpicManifestApp | null {
  let raw: EpicItemJson;
  try {
    raw = JSON.parse(text) as EpicItemJson;
  } catch {
    return null;
  }

  if (raw.bIsIncompleteInstall) return null;

  const appName = raw.AppName?.trim();
  const name = raw.DisplayName?.trim() || appName;
  const installPath = raw.InstallLocation?.trim();
  const catalogNamespace = raw.CatalogNamespace?.trim() || "";
  const catalogItemId = raw.CatalogItemId?.trim() || "";

  if (!appName || !name || !installPath) return null;

  const sizeRaw = raw.InstallSize;
  const size =
    typeof sizeRaw === "number"
      ? sizeRaw
      : Number.parseInt(String(sizeRaw ?? "0"), 10);

  return {
    appId: appName,
    name,
    installPath,
    size: Number.isFinite(size) && size >= 0 ? size : 0,
    kind: inferEpicKind(name, raw.MainGameAppName),
    catalogNamespace,
    catalogItemId,
    appName,
    itemFilePath
  };
}

export async function listEpicManifests(
  epicDataPath: string,
  deps: EpicManifestDeps = {}
): Promise<EpicManifestApp[]> {
  const readdir = deps.readdir ?? ((dir: string) => fs.readdir(dir));
  const readFile = deps.readFile ?? ((filePath: string) => fs.readFile(filePath, "utf8"));
  const pathExists = deps.pathExists ?? defaultPathExists;

  const manifestsDir = epicManifestsDir(epicDataPath);
  if (!(await pathExists(manifestsDir))) return [];

  let entries: string[];
  try {
    entries = await readdir(manifestsDir);
  } catch {
    return [];
  }

  const results: EpicManifestApp[] = [];
  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith(".item")) continue;
    try {
      const itemFilePath = path.join(manifestsDir, entry);
      const text = await readFile(itemFilePath);
      const app = parseEpicItem(text, itemFilePath);
      if (app) results.push(app);
    } catch {
      // skip broken item
    }
  }
  return results;
}

export async function findEpicManifest(
  epicDataPath: string,
  appId: string,
  deps: EpicManifestDeps = {}
): Promise<EpicManifestApp | null> {
  const apps = await listEpicManifests(epicDataPath, deps);
  return apps.find(app => app.appId === appId) ?? null;
}
