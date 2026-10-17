import type { GameApp, LauncherProvider, UninstallGameResult } from "../types";
import { loadEpicArtworkUrls, type EpicCatcacheDeps } from "./catcache";
import { detectEpicDataPath, type EpicDetectDeps } from "./detect";
import {
  findEpicManifest,
  listEpicManifests,
  type EpicManifestDeps
} from "./manifests";
import { uninstallEpicApp, type EpicUninstallDeps } from "./uninstall";

export type EpicProviderDeps = EpicDetectDeps &
  EpicManifestDeps &
  EpicCatcacheDeps &
  EpicUninstallDeps & {
    resolveEpicDataPath?: () => Promise<string | null>;
  };

export function createEpicProvider(deps: EpicProviderDeps = {}): LauncherProvider {
  const resolvePath = deps.resolveEpicDataPath ?? (() => detectEpicDataPath(deps));

  return {
    id: "epic",
    label: "Epic Games",

    async detect(): Promise<boolean> {
      return (await resolvePath()) !== null;
    },

    async listInstalled(): Promise<GameApp[]> {
      const epicDataPath = await resolvePath();
      if (!epicDataPath) return [];

      const manifests = await listEpicManifests(epicDataPath, deps);
      const artworkByCatalogId = await loadEpicArtworkUrls(epicDataPath, deps);
      const byAppId = new Map<string, GameApp>();

      for (const manifest of manifests) {
        const app: GameApp = {
          id: `epic:${manifest.appId}`,
          launcherId: "epic",
          launcherLabel: "Epic Games",
          appId: manifest.appId,
          name: manifest.name,
          installPath: manifest.installPath,
          size: manifest.size,
          kind: manifest.kind,
          lastPlayedAt: null,
          artworkDataUrl: null,
          artworkUrl: artworkByCatalogId.get(manifest.catalogItemId) ?? null
        };
        byAppId.set(manifest.appId, app);
      }

      return [...byAppId.values()].sort((a, b) => b.size - a.size);
    },

    async uninstall(appId: string): Promise<UninstallGameResult> {
      const epicDataPath = await resolvePath();
      if (!epicDataPath) {
        return { ok: false, error: "Epic Games Store not found" };
      }
      const manifest = await findEpicManifest(epicDataPath, appId.trim(), deps);
      if (!manifest) {
        return { ok: false, error: `Unknown Epic app: ${appId}` };
      }
      return uninstallEpicApp(
        manifest.catalogNamespace,
        manifest.catalogItemId,
        manifest.appName,
        deps
      );
    }
  };
}

export const epicProvider: LauncherProvider = createEpicProvider();
