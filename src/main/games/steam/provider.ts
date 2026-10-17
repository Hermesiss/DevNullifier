import type { GameApp, LauncherProvider, UninstallGameResult } from "../types";
import { loadSteamArtworkDataUrl, type ArtworkDeps } from "./artwork";
import { detectSteamPath, type SteamDetectDeps } from "./detect";
import { listSteamLibraryPaths, type LibraryDeps } from "./library";
import { loadSteamLastPlayed, type LastPlayedDeps } from "./lastPlayed";
import { listManifestsInLibrary, type ManifestDeps } from "./manifests";
import { uninstallSteamApp, type UninstallDeps } from "./uninstall";

export type SteamProviderDeps = SteamDetectDeps &
  LibraryDeps &
  ManifestDeps &
  LastPlayedDeps &
  ArtworkDeps &
  UninstallDeps & {
    resolveSteamPath?: () => Promise<string | null>;
  };

export function createSteamProvider(deps: SteamProviderDeps = {}): LauncherProvider {
  const resolvePath = deps.resolveSteamPath ?? (() => detectSteamPath(deps));

  return {
    id: "steam",
    label: "Steam",

    async detect(): Promise<boolean> {
      return (await resolvePath()) !== null;
    },

    async listInstalled(): Promise<GameApp[]> {
      const steamRoot = await resolvePath();
      if (!steamRoot) return [];

      const libraries = await listSteamLibraryPaths(steamRoot, deps);
      const lastPlayed = await loadSteamLastPlayed(steamRoot, deps);

      const byAppId = new Map<string, GameApp>();
      for (const libraryRoot of libraries) {
        const manifests = await listManifestsInLibrary(libraryRoot, deps);
        for (const manifest of manifests) {
          const app: GameApp = {
            id: `steam:${manifest.appId}`,
            launcherId: "steam",
            launcherLabel: "Steam",
            appId: manifest.appId,
            name: manifest.name,
            installPath: manifest.installPath,
            size: manifest.size,
            kind: manifest.kind,
            lastPlayedAt: lastPlayed.get(manifest.appId) ?? null,
            artworkDataUrl: null
          };
          const existing = byAppId.get(manifest.appId);
          if (!existing || app.size > existing.size) {
            byAppId.set(manifest.appId, app);
          }
        }
      }

      const apps = [...byAppId.values()].sort((a, b) => b.size - a.size);
      await Promise.all(
        apps.map(async app => {
          app.artworkDataUrl = await loadSteamArtworkDataUrl(steamRoot, app.appId, deps);
        })
      );
      return apps;
    },

    uninstall(appId: string): Promise<UninstallGameResult> {
      return uninstallSteamApp(appId, deps);
    }
  };
}

export const steamProvider: LauncherProvider = createSteamProvider();
