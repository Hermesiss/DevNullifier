import { shell } from "electron";
import type { UninstallGameResult } from "../types";

export type EpicUninstallDeps = {
  openExternal?: (url: string) => Promise<void>;
};

/**
 * Epic documents only launch / updatecheck / installer — no uninstall action.
 * Opening the library URI still just starts the launcher; the user must uninstall in UI.
 */
export function epicLibraryUrl(
  catalogNamespace: string,
  catalogItemId: string,
  appName: string
): string {
  const id = [catalogNamespace, catalogItemId, appName]
    .map(part => encodeURIComponent(part))
    .join("%3A");
  // Same app path as launch; no working uninstall deep link exists.
  return `com.epicgames.launcher://apps/${id}`;
}

export async function uninstallEpicApp(
  catalogNamespace: string,
  catalogItemId: string,
  appName: string,
  deps: EpicUninstallDeps = {}
): Promise<UninstallGameResult> {
  const name = appName?.trim();
  if (!name) {
    return { ok: false, error: "Invalid Epic app id" };
  }

  const openExternal =
    deps.openExternal ?? ((url: string) => shell.openExternal(url).then(() => undefined));

  try {
    await openExternal(epicLibraryUrl(catalogNamespace, catalogItemId, name));
    return { ok: true, mode: "protocol" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
