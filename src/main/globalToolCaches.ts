import path from "path";

export interface ToolCacheLocation {
  id: string;
  label: string;
  path: string;
}

export interface ToolCacheFound extends ToolCacheLocation {
  size: number;
}

export interface ToolCacheStat {
  isSymbolicLink(): boolean;
  isDirectory(): boolean;
  isFile(): boolean;
  size: number;
}

export interface ToolCacheFsOps {
  stat(target: string): Promise<ToolCacheStat>;
  getDirSize(target: string): Promise<number>;
}

const LABELS: Record<string, string> = {
  npm: "npm",
  yarn: "Yarn",
  pnpm: "pnpm",
  nuget: "NuGet",
  gradle: "Gradle",
  pip: "pip",
  cargo: "Cargo",
  huggingface: "Hugging Face",
  unity: "Unity"
};

function located(id: string, home: string, parts: string[]): ToolCacheLocation {
  return { id, label: LABELS[id], path: path.join(home, ...parts) };
}

export function toolCacheCandidates(
  home: string,
  platform: NodeJS.Platform
): ToolCacheLocation[] {
  const windows = platform === "win32";
  const mac = platform === "darwin";

  return [
    located("npm", home, [".npm"]),
    located(
      "yarn",
      home,
      windows ? ["AppData", "Local", "Yarn", "Cache"] : [".cache", "yarn"]
    ),
    located(
      "pnpm",
      home,
      windows ? ["AppData", "Local", "pnpm", "store"] : [".local", "share", "pnpm", "store"]
    ),
    located("nuget", home, [".nuget", "packages"]),
    located("gradle", home, [".gradle", "caches"]),
    located("pip", home, [".cache", "pip"]),
    located("cargo", home, [".cargo", "registry"]),
    located("huggingface", home, [".cache", "huggingface"]),
    located(
      "unity",
      home,
      windows
        ? ["AppData", "Local", "Unity", "cache"]
        : mac
          ? ["Library", "Unity", "cache"]
          : [".local", "share", "unity3d"]
    )
  ];
}

export async function collectExistingToolCaches(
  home: string,
  platform: NodeJS.Platform,
  fsOps: ToolCacheFsOps
): Promise<ToolCacheFound[]> {
  const found: ToolCacheFound[] = [];

  for (const candidate of toolCacheCandidates(home, platform)) {
    let stats: ToolCacheStat;
    try {
      stats = await fsOps.stat(candidate.path);
    } catch {
      continue;
    }

    if (stats.isSymbolicLink()) continue;

    if (stats.isDirectory()) {
      found.push({ ...candidate, size: await fsOps.getDirSize(candidate.path) });
      continue;
    }

    if (stats.isFile()) {
      found.push({ ...candidate, size: stats.size });
    }
  }

  return found;
}
