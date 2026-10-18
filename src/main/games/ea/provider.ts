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

const EA_PUBLISHER = /electronic arts|ea swiss|ea games|origin/i;

export type EaProviderDeps = RegQueryDeps & {
  platform?: NodeJS.Platform;
  pathExists?: (target: string) => Promise<boolean>;
  openExternal?: (url: string) => Promise<void>;
};

function parseSizeKb(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number.parseInt(raw, raw.startsWith("0x") || raw.startsWith("0X") ? 16 : 10);
  return Number.isFinite(n) ? n * 1024 : 0;
}

async function listEaApps(deps: EaProviderDeps): Promise<GameApp[]> {
  const exists = deps.pathExists ?? pathExists;
  const apps: GameApp[] = [];

  for (const root of UNINSTALL_KEYS) {
    const ids = await listRegistrySubkeys(root, deps);
    for (const id of ids) {
      const values = await readRegistryValues(`${root}\\${id}`, deps);
      const publisher = values.Publisher || "";
      const name = values.DisplayName || id;
      if (!EA_PUBLISHER.test(publisher) && !/^ea /i.test(name) && !/origin/i.test(name)) {
        continue;
      }
      if (/ea (desktop|app|background)|origin$/i.test(name)) continue;
      const installPath = (values.InstallLocation || "").replace(/\//g, "\\");
      if (!installPath || !(await exists(installPath))) continue;
      apps.push({
        id: `ea:${id}`,
        launcherId: "ea",
        launcherLabel: "EA App",
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

export function createEaProvider(deps: EaProviderDeps = {}): LauncherProvider {
  const openExternal =
    deps.openExternal ?? ((url: string) => shell.openExternal(url).then(() => undefined));
  const exists = deps.pathExists ?? pathExists;

  return {
    id: "ea",
    label: "EA App",

    async detect(): Promise<boolean> {
      if ((deps.platform ?? process.platform) !== "win32") return false;
      const local = process.env.LOCALAPPDATA;
      if (local && (await exists(path.join(local, "Electronic Arts", "EA Desktop")))) {
        return true;
      }
      return (await listEaApps(deps)).length > 0;
    },

    async listInstalled(): Promise<GameApp[]> {
      if ((deps.platform ?? process.platform) !== "win32") return [];
      return listEaApps(deps);
    },

    async uninstall(_appId: string): Promise<UninstallGameResult> {
      try {
        const local = process.env.LOCALAPPDATA;
        const exe = local
          ? path.join(
              local,
              "Electronic Arts",
              "EA Desktop",
              "EA Desktop",
              "EADesktop.exe"
            )
          : "";
        if (exe && (await exists(exe))) {
          await openExternal(exe);
        } else {
          await openExternal("origin2://library/open");
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

export const eaProvider: LauncherProvider = createEaProvider();
