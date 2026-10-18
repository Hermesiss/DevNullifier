export type LauncherId = "steam" | "epic" | "gog" | "battlenet" | "riot" | "ea";

export type GameAppKind = "game" | "app" | "tool" | "other";

export interface GameApp {
  id: string;
  launcherId: LauncherId;
  launcherLabel: string;
  appId: string;
  name: string;
  installPath: string;
  size: number;
  kind: GameAppKind;
  lastPlayedAt: number | null;
  /** Local launcher artwork as data URL, when available. */
  artworkDataUrl: string | null;
  /** Remote artwork URL (e.g. Epic CDN), when no local data URL. */
  artworkUrl: string | null;
}

export interface UninstallGameRequest {
  launcherId: LauncherId;
  appId: string;
}

export interface UninstallGameResult {
  ok: boolean;
  error?: string;
  /** Steam: protocol uninstall dialog. Epic: opens launcher only (no uninstall deep link). */
  mode?: "protocol";
}

export interface LauncherProvider {
  id: LauncherId;
  label: string;
  detect(): Promise<boolean>;
  listInstalled(): Promise<GameApp[]>;
  uninstall(appId: string): Promise<UninstallGameResult>;
}
