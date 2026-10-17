import type { LauncherId, LauncherProvider } from "./types";
import { epicProvider } from "./epic/provider";
import { steamProvider } from "./steam/provider";

/** Registered launcher providers. Add GOG / others here later. */
export function getProviders(): LauncherProvider[] {
  return [steamProvider, epicProvider];
}

export function getProvider(id: LauncherId | string): LauncherProvider | undefined {
  return getProviders().find(provider => provider.id === id);
}
