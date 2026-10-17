export type LauncherId = "steam";

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
}

export interface UninstallGameRequest {
  launcherId: LauncherId;
  appId: string;
}

export interface UninstallGameResult {
  ok: boolean;
  error?: string;
}

export interface LauncherProvider {
  id: LauncherId;
  label: string;
  detect(): Promise<boolean>;
  listInstalled(): Promise<GameApp[]>;
  uninstall(appId: string): Promise<UninstallGameResult>;
}
