import { shell } from "electron";
import type { UninstallGameResult } from "../types";

export type UninstallDeps = {
  openExternal?: (url: string) => Promise<void>;
};

export function steamUninstallUrl(appId: string): string {
  return `steam://uninstall/${encodeURIComponent(appId)}`;
}

export async function uninstallSteamApp(
  appId: string,
  deps: UninstallDeps = {}
): Promise<UninstallGameResult> {
  const trimmed = appId?.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return { ok: false, error: "Invalid Steam app id" };
  }

  const openExternal =
    deps.openExternal ?? ((url: string) => shell.openExternal(url).then(() => undefined));

  try {
    await openExternal(steamUninstallUrl(trimmed));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
