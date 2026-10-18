import path from "path";
import { shell } from "electron";
import type { GameApp, LauncherProvider, UninstallGameResult } from "../types";
import {
  listRegistrySubkeys,
  pathExists,
  readRegistryValues,
  type RegQueryDeps
} from "../winRegistry";

const UNINSTALL_KEYS = [
  "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
  "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
];

const BLIZZARD_PUBLISHER = /blizzard|battle\.net/i;

export type BattleNetProviderDeps = RegQueryDeps & {
  platform?: NodeJS.Platform;
  pathExists?: (target: string) => Promise<boolean>;
  openExternal?: (url: string) => Promise<void>;
};

function parseSizeKb(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number.parseInt(raw, raw.startsWith("0x") || raw.startsWith("0X") ? 16 : 10);
  return Number.isFinite(n) ? n * 1024 : 0;
}

async function listBattleNetGames(deps: BattleNetProviderDeps): Promise<GameApp[]> {
  const exists = deps.pathExists ?? pathExists;
  const apps: GameApp[] = [];

  for (const root of UNINSTALL_KEYS) {
    const ids = await listRegistrySubkeys(root, deps);
    for (const id of ids) {
      const values = await readRegistryValues(`${root}\\${id}`, deps);
      const publisher = values.Publisher || "";
      if (!BLIZZARD_PUBLISHER.test(publisher)) continue;
      const name = values.DisplayName || id;
      if (/battle\.net|agent/i.test(name)) continue;
      const installPath = (values.InstallLocation || "").replace(/\//g, "\\");
      if (!installPath || !(await exists(installPath))) continue;
      apps.push({
        id: `battlenet:${id}`,
        launcherId: "battlenet",
        launcherLabel: "Battle.net",
        appId: id,
        name,
        installPath,
        size: parseSizeKb(values.EstimatedSize),
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

export function createBattleNetProvider(
  deps: BattleNetProviderDeps = {}
): LauncherProvider {
  const openExternal =
    deps.openExternal ?? ((url: string) => shell.openExternal(url).then(() => undefined));
  const exists = deps.pathExists ?? pathExists;

  return {
    id: "battlenet",
    label: "Battle.net",

    async detect(): Promise<boolean> {
      if ((deps.platform ?? process.platform) !== "win32") return false;
      const programFiles = process.env["ProgramFiles(x86)"] || process.env.ProgramFiles;
      if (programFiles) {
        if (await exists(path.join(programFiles, "Battle.net", "Battle.net.exe"))) {
          return true;
        }
      }
      const listed = await listBattleNetGames(deps);
      return listed.length > 0;
    },

    async listInstalled(): Promise<GameApp[]> {
      if ((deps.platform ?? process.platform) !== "win32") return [];
      return listBattleNetGames(deps);
    },

    async uninstall(_appId: string): Promise<UninstallGameResult> {
      try {
        const programFiles = process.env["ProgramFiles(x86)"] || process.env.ProgramFiles;
        const exe = programFiles
          ? path.join(programFiles, "Battle.net", "Battle.net.exe")
          : "";
        if (exe && (await exists(exe))) {
          await openExternal(exe);
        } else {
          await openExternal("battlenet://");
        }
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

export const battleNetProvider: LauncherProvider = createBattleNetProvider();
