import { getProvider, getProviders } from "./registry";
import type {
  GameApp,
  LauncherId,
  LauncherProvider,
  UninstallGameRequest,
  UninstallGameResult
} from "./types";

export async function scanGames(
  providers: LauncherProvider[] = getProviders()
): Promise<GameApp[]> {
  const all: GameApp[] = [];

  for (const provider of providers) {
    try {
      if (!(await provider.detect())) continue;
      const apps = await provider.listInstalled();
      all.push(...apps);
    } catch (error) {
      console.error(`Games scan failed for ${provider.id}:`, error);
    }
  }

  return all.sort((a, b) => b.size - a.size);
}

export async function uninstallGame(
  request: UninstallGameRequest,
  resolveProvider: (id: LauncherId | string) => LauncherProvider | undefined = getProvider
): Promise<UninstallGameResult> {
  const provider = resolveProvider(request.launcherId);
  if (!provider) {
    return { ok: false, error: `Unknown launcher: ${request.launcherId}` };
  }
  if (!request.appId?.trim()) {
    return { ok: false, error: "Missing app id" };
  }
  return provider.uninstall(request.appId.trim());
}
