import path from "path";
import { shell } from "electron";
import type { GameApp, LauncherProvider, UninstallGameResult } from "../types";
import {
  listRegistrySubkeys,
  pathExists,
  readRegistryValues,
  type RegQueryDeps
} from "../winRegistry";

const GOG_GAMES_KEYS = [
  "HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games",
  "HKLM\\SOFTWARE\\GOG.com\\Games"
];

export type GogProviderDeps = RegQueryDeps & {
  platform?: NodeJS.Platform;
  pathExists?: (target: string) => Promise<boolean>;
  openExternal?: (url: string) => Promise<void>;
  dirSize?: (target: string) => Promise<number>;
};

async function detectGogInstalled(deps: GogProviderDeps): Promise<boolean> {
  const exists = deps.pathExists ?? pathExists;
  const local = process.env.LOCALAPPDATA;
  if (local && (await exists(path.join(local, "GOG.com", "Galaxy")))) return true;
  for (const key of GOG_GAMES_KEYS) {
    const sub = await listRegistrySubkeys(key, deps);
    if (sub.length > 0) return true;
  }
  return false;
}

async function listGogGames(deps: GogProviderDeps): Promise<GameApp[]> {
  const exists = deps.pathExists ?? pathExists;
  const apps: GameApp[] = [];

  for (const root of GOG_GAMES_KEYS) {
    const ids = await listRegistrySubkeys(root, deps);
    for (const id of ids) {
      const values = await readRegistryValues(`${root}\\${id}`, deps);
      const name = values.gameName || values.DISPLAYNAME || values.DisplayName || id;
      const installPath = (values.path || values.PATH || "").replace(/\//g, "\\");
      if (!installPath || !(await exists(installPath))) continue;
      let size = 0;
      if (deps.dirSize) {
        try {
          size = await deps.dirSize(installPath);
        } catch {
          size = 0;
        }
      }
      apps.push({
        id: `gog:${id}`,
        launcherId: "gog",
        launcherLabel: "GOG Galaxy",
        appId: id,
        name,
        installPath,
        size,
        kind: "game",
        lastPlayedAt: null,
        artworkDataUrl: null,
        artworkUrl: null
      });
    }
  }

  const byId = new Map(apps.map(app => [app.appId, app]));
  return [...byId.values()].sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
}

export function createGogProvider(deps: GogProviderDeps = {}): LauncherProvider {
  const openExternal =
    deps.openExternal ?? ((url: string) => shell.openExternal(url).then(() => undefined));

  return {
    id: "gog",
    label: "GOG Galaxy",

    async detect(): Promise<boolean> {
      if ((deps.platform ?? process.platform) !== "win32") return false;
      return detectGogInstalled(deps);
    },

    async listInstalled(): Promise<GameApp[]> {
      if ((deps.platform ?? process.platform) !== "win32") return [];
      return listGogGames(deps);
    },

    async uninstall(appId: string): Promise<UninstallGameResult> {
      const trimmed = appId.trim();
      if (!trimmed) return { ok: false, error: "Missing GOG app id" };
      try {
        await openExternal(`goggalaxy://openGameView/${encodeURIComponent(trimmed)}`);
        return { ok: true, mode: "protocol" };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}

export const gogProvider: LauncherProvider = createGogProvider();
