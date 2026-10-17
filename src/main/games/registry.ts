import type { LauncherId, LauncherProvider } from "./types";
import { steamProvider } from "./steam/provider";

/** Registered launcher providers. Add Epic/GOG here later. */
export function getProviders(): LauncherProvider[] {
  return [steamProvider];
}

export function getProvider(id: LauncherId | string): LauncherProvider | undefined {
  return getProviders().find(provider => provider.id === id);
}
