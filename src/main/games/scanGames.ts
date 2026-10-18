import { getProvider, getProviders } from "./registry";
import type {
  GameApp,
  LauncherId,
  LauncherProvider,
  UninstallGameRequest,
  UninstallGameResult
} from "./types";

/** One launcher must finish detect + listing inside this window. */
export const LAUNCHER_SCAN_TIMEOUT_MS = 1_000;

export interface ScanGamesOptions {
  onLauncher?: (label: string) => void;
  timeoutMs?: number;
  /** Trace each launcher to the console. Off in packaged builds. */
  devLog?: boolean;
}

type LauncherOutcome =
  | { status: "apps"; apps: GameApp[] }
  | { status: "missing" }
  | { status: "error"; error: unknown }
  | { status: "timeout" };

function devLogLine(enabled: boolean, message: string): void {
  if (enabled) console.log(message);
}

async function runLauncher(provider: LauncherProvider, timeoutMs: number): Promise<LauncherOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = (async (): Promise<LauncherOutcome> => {
    if (!(await provider.detect())) return { status: "missing" };
    return { status: "apps", apps: await provider.listInstalled() };
  })().then(
    outcome => outcome,
    (error: unknown) => ({ status: "error" as const, error })
  );

  const timeout = new Promise<LauncherOutcome>(resolve => {
    timer = setTimeout(() => resolve({ status: "timeout" }), timeoutMs);
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function scanGames(
  providers: LauncherProvider[] = getProviders(),
  options: ScanGamesOptions = {}
): Promise<GameApp[]> {
  const timeoutMs = options.timeoutMs ?? LAUNCHER_SCAN_TIMEOUT_MS;
  const devLog = options.devLog ?? false;
  const all: GameApp[] = [];

  for (const provider of providers) {
    options.onLauncher?.(provider.label);
    const started = Date.now();
    devLogLine(devLog, `[games] start ${provider.label}`);
    const outcome = await runLauncher(provider, timeoutMs);
    const elapsed = Date.now() - started;

    if (outcome.status === "timeout") {
      devLogLine(devLog, `[games] ${provider.label}: timeout after ${elapsed}ms`);
      continue;
    }
    if (outcome.status === "error") {
      devLogLine(devLog, `[games] ${provider.label}: failed after ${elapsed}ms`);
      console.error(`Games scan failed for ${provider.id}:`, outcome.error);
      continue;
    }
    if (outcome.status === "missing") {
      devLogLine(devLog, `[games] ${provider.label}: not installed (${elapsed}ms)`);
      continue;
    }

    all.push(...outcome.apps);
    devLogLine(devLog, `[games] ${provider.label}: ${outcome.apps.length} apps (${elapsed}ms)`);
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
