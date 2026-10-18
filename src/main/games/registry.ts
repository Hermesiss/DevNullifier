import type { LauncherId, LauncherProvider } from "./types";
import { battleNetProvider } from "./battlenet/provider";
import { eaProvider } from "./ea/provider";
import { epicProvider } from "./epic/provider";
import { gogProvider } from "./gog/provider";
import { riotProvider } from "./riot/provider";
import { steamProvider } from "./steam/provider";

/** Registered launcher providers. */
export function getProviders(): LauncherProvider[] {
  return [
    steamProvider,
    epicProvider,
    gogProvider,
    battleNetProvider,
    riotProvider,
    eaProvider
  ];
}

export function getProvider(id: LauncherId | string): LauncherProvider | undefined {
  return getProviders().find(provider => provider.id === id);
}
