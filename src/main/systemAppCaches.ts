import os from "os";
import path from "path";

export type SystemCacheLocale = "en" | "ru";

export type SystemCacheCategoryId =
  | "temp"
  | "browsers"
  | "messengers"
  | "shaders"
  | "creative"
  | "launchers";

export interface LocalizedText {
  en: string;
  ru: string;
}

export interface SystemCacheLocation {
  id: string;
  parentId: string;
  parentLabel: string;
  parentPath: string;
  label: string;
  path: string;
  category: SystemCacheCategoryId;
}

export interface SystemCacheFound extends SystemCacheLocation {
  size: number;
}

export interface SystemCacheChild {
  path: string;
  label: string;
  size: number;
}

export interface SystemCacheScanItem {
  id: string;
  parentId: string;
  parentLabel: string;
  parentPath: string;
  parentDescription: string;
  label: string;
  path: string;
  size: number;
  category: SystemCacheCategoryId;
  categoryLabel: string;
  description: string;
  /** Collapsed discoverChildren group (e.g. user-temp). */
  aggregated?: boolean;
  children?: SystemCacheChild[];
}

/** parentIds whose discoverChildren are shown as one row + details dialog. */
export const AGGREGATED_SYSTEM_PARENT_IDS = new Set(["user-temp"]);

export interface SystemCacheCatalogPart {
  id: string;
  label: string;
  path: string;
  description: string;
}

export interface SystemCacheCatalogItem {
  id: string;
  label: string;
  path: string;
  description: string;
  parts: SystemCacheCatalogPart[];
  discoversChildren: boolean;
}

export interface SystemCacheCatalogCategory {
  id: SystemCacheCategoryId;
  label: string;
  items: SystemCacheCatalogItem[];
}

export interface SystemCacheStat {
  isSymbolicLink(): boolean;
  isDirectory(): boolean;
  isFile(): boolean;
  size: number;
}

export interface SystemCacheFsOps {
  stat(target: string): Promise<SystemCacheStat>;
  getDirSize(target: string): Promise<number>;
  readdir?(dir: string): Promise<string[]>;
}

export interface SystemCacheScanOptions {
  /** Override for user temp (tests / custom TEMP). Defaults to os.tmpdir(). */
  tmpdir?: string;
  /** Absolute roots keyed by name (e.g. steam install path). */
  extraRoots?: Record<string, string>;
  /** Override LOCALAPPDATA / APPDATA for tests. */
  localAppData?: string;
  roamingAppData?: string;
}

type PathParts = string[] | null;

interface PlatformPaths {
  win32: PathParts;
  darwin: PathParts;
  linux: PathParts;
}

interface DiscoverChildren {
  description: LocalizedText;
  namePrefix?: string;
  exclude?: string[];
  /** Appended under each discovered child name (e.g. Firefox cache2). */
  childRelative?: string[];
  /** Never expose the root itself when readdir is missing or empty. */
  omitRootFallback?: boolean;
}

interface SystemCachePartDefinition {
  id: string;
  label: string;
  description: LocalizedText;
  relative: PlatformPaths;
}

type RootKind = "home" | "tmpdir" | "local" | "roaming" | "extra";

interface SystemCacheDefinition {
  id: string;
  category: SystemCacheCategoryId;
  label: string;
  description: LocalizedText;
  paths: PlatformPaths;
  /** Where `paths` segments are joined from. Default: home. */
  rootKind?: RootKind;
  /** When rootKind is extra, look up options.extraRoots[extraRootKey]. */
  extraRootKey?: string;
  /** @deprecated Use rootKind: "tmpdir". */
  useTmpdir?: boolean;
  parts?: SystemCachePartDefinition[];
  discoverChildren?: DiscoverChildren;
}

function rel(
  win32: PathParts,
  darwin: PathParts,
  linux: PathParts
): PlatformPaths {
  return { win32, darwin, linux };
}

const CATEGORY_ORDER: SystemCacheCategoryId[] = [
  "temp",
  "browsers",
  "messengers",
  "shaders",
  "creative",
  "launchers"
];

const CATEGORY_LABELS: Record<SystemCacheCategoryId, LocalizedText> = {
  temp: { en: "Temporary files", ru: "Временные файлы" },
  browsers: { en: "Browsers", ru: "Браузеры" },
  messengers: { en: "Messengers & media", ru: "Мессенджеры и медиа" },
  shaders: { en: "Shader caches", ru: "Кэши шейдеров" },
  creative: { en: "Creative apps", ru: "Креативные приложения" },
  launchers: { en: "Game launcher caches", ru: "Кэши игровых лаунчеров" }
};

function sameRelative(segments: string[]): PlatformPaths {
  return { win32: segments, darwin: segments, linux: segments };
}

function chromiumCacheParts(): SystemCachePartDefinition[] {
  return [
    {
      id: "cache",
      label: "Cache",
      description: {
        en: "HTTP disk cache. Safe; pages re-download. Does not remove cookies or passwords.",
        ru: "Дисковый HTTP-кэш. Безопасно; страницы скачаются снова. Cookies и пароли не удаляет."
      },
      relative: sameRelative(["Cache"])
    },
    {
      id: "code-cache",
      label: "Code Cache",
      description: {
        en: "V8/compiled script cache. Safe to delete.",
        ru: "Кэш скомпилированных скриптов. Безопасно удалять."
      },
      relative: sameRelative(["Code Cache"])
    },
    {
      id: "gpu-cache",
      label: "GPUCache",
      description: {
        en: "GPU shader/resource cache. Safe; may briefly slow first paint.",
        ru: "Кэш GPU. Безопасно; первый запуск может быть чуть медленнее."
      },
      relative: sameRelative(["GPUCache"])
    }
  ];
}

/** Phase A definitions; later phases append messengers/shaders/creative/launchers. */
const SYSTEM_CACHE_DEFINITIONS: SystemCacheDefinition[] = [
  {
    id: "user-temp",
    category: "temp",
    label: "User TEMP",
    description: {
      en: "Top-level entries in your user temp folder. Some files may be locked by running apps.",
      ru: "Элементы верхнего уровня пользовательской папки temp. Часть файлов может быть занята процессами."
    },
    paths: { win32: [], darwin: [], linux: [] },
    rootKind: "tmpdir",
    discoverChildren: {
      omitRootFallback: true,
      description: {
        en: "One temp entry. Safe when not locked; locked deletes are skipped.",
        ru: "Один элемент temp. Безопасно, если не занят; занятые пропускаются."
      }
    }
  },
  {
    id: "chrome",
    category: "browsers",
    label: "Google Chrome",
    description: {
      en: "Default profile cache folders only. Cookies, passwords, and history stay.",
      ru: "Только кэш профиля Default. Cookies, пароли и история не трогаются."
    },
    paths: {
      win32: ["AppData", "Local", "Google", "Chrome", "User Data", "Default"],
      darwin: ["Library", "Application Support", "Google", "Chrome", "Default"],
      linux: [".config", "google-chrome", "Default"]
    },
    parts: chromiumCacheParts()
  },
  {
    id: "edge",
    category: "browsers",
    label: "Microsoft Edge",
    description: {
      en: "Default profile cache folders only. Cookies, passwords, and history stay.",
      ru: "Только кэш профиля Default. Cookies, пароли и история не трогаются."
    },
    paths: {
      win32: ["AppData", "Local", "Microsoft", "Edge", "User Data", "Default"],
      darwin: ["Library", "Application Support", "Microsoft Edge", "Default"],
      linux: [".config", "microsoft-edge", "Default"]
    },
    parts: chromiumCacheParts()
  },
  {
    id: "brave",
    category: "browsers",
    label: "Brave",
    description: {
      en: "Default profile cache folders only. Cookies, passwords, and history stay.",
      ru: "Только кэш профиля Default. Cookies, пароли и история не трогаются."
    },
    paths: {
      win32: ["AppData", "Local", "BraveSoftware", "Brave-Browser", "User Data", "Default"],
      darwin: ["Library", "Application Support", "BraveSoftware", "Brave-Browser", "Default"],
      linux: [".config", "BraveSoftware", "Brave-Browser", "Default"]
    },
    parts: chromiumCacheParts()
  },
  {
    id: "opera",
    category: "browsers",
    label: "Opera",
    description: {
      en: "Opera Stable cache folders. Does not remove passwords or sync data.",
      ru: "Кэш Opera Stable. Пароли и данные синхронизации не удаляет."
    },
    paths: {
      win32: ["AppData", "Roaming", "Opera Software", "Opera Stable"],
      darwin: ["Library", "Application Support", "com.operasoftware.Opera"],
      linux: [".config", "opera"]
    },
    parts: chromiumCacheParts()
  },
  {
    id: "firefox",
    category: "browsers",
    label: "Firefox",
    description: {
      en: "cache2 under each Firefox profile. Cookies and passwords stay in the profile.",
      ru: "cache2 в каждом профиле Firefox. Cookies и пароли остаются в профиле."
    },
    paths: {
      win32: ["AppData", "Local", "Mozilla", "Firefox", "Profiles"],
      darwin: ["Library", "Caches", "Firefox", "Profiles"],
      linux: [".cache", "mozilla", "firefox"]
    },
    discoverChildren: {
      omitRootFallback: true,
      childRelative: ["cache2"],
      description: {
        en: "One profile cache2 folder. Safe; Firefox rebuilds it.",
        ru: "Папка cache2 одного профиля. Безопасно; Firefox создаст снова."
      }
    }
  },
  {
    id: "discord",
    category: "messengers",
    label: "Discord",
    description: {
      en: "Discord Cache/Code Cache/GPUCache only. Does not remove Local Storage or LevelDB.",
      ru: "Только Cache/Code Cache/GPUCache Discord. Local Storage и LevelDB не трогает."
    },
    rootKind: "roaming",
    paths: {
      win32: ["discord"],
      darwin: ["Library", "Application Support", "discord"],
      linux: [".config", "discord"]
    },
    parts: chromiumCacheParts()
  },
  {
    id: "slack",
    category: "messengers",
    label: "Slack",
    description: {
      en: "Slack Chromium cache folders only.",
      ru: "Только Chromium-кэш Slack."
    },
    rootKind: "roaming",
    paths: {
      win32: ["Slack"],
      darwin: ["Library", "Application Support", "Slack"],
      linux: [".config", "Slack"]
    },
    parts: chromiumCacheParts()
  },
  {
    id: "teams",
    category: "messengers",
    label: "Microsoft Teams",
    description: {
      en: "Teams (new) cache under Local. Cookies/login stay elsewhere.",
      ru: "Кэш нового Teams в Local. Cookies/логин не здесь."
    },
    rootKind: "local",
    paths: {
      win32: ["Packages", "MSTeams_8wekyb3d8bbwe", "LocalCache", "Microsoft", "MSTeams"],
      darwin: ["Library", "Application Support", "Microsoft", "Teams"],
      linux: null
    },
    parts: [
      {
        id: "cache",
        label: "Cache",
        description: {
          en: "Teams disk cache. Safe to clear.",
          ru: "Дисковый кэш Teams. Безопасно очищать."
        },
        relative: rel(["EBWebView", "Default", "Cache"], ["Cache"], null)
      },
      {
        id: "gpu-cache",
        label: "GPUCache",
        description: {
          en: "Teams GPU cache.",
          ru: "GPU-кэш Teams."
        },
        relative: rel(["EBWebView", "Default", "GPUCache"], ["GPUCache"], null)
      }
    ]
  },
  {
    id: "zoom",
    category: "messengers",
    label: "Zoom",
    description: {
      en: "Zoom data cache folder. Meeting recordings are not stored here.",
      ru: "Кэш данных Zoom. Записи встреч здесь не хранятся."
    },
    rootKind: "roaming",
    paths: {
      win32: ["Zoom", "data", "ZoomDownload"],
      darwin: ["Library", "Application Support", "zoom.us", "data"],
      linux: [".zoom"]
    }
  },
  {
    id: "spotify",
    category: "messengers",
    label: "Spotify",
    description: {
      en: "Spotify Data and Storage caches. Playlists stay in the cloud account.",
      ru: "Кэши Data/Storage Spotify. Плейлисты остаются в аккаунте."
    },
    rootKind: "local",
    paths: {
      win32: ["Spotify"],
      darwin: ["Library", "Caches", "com.spotify.client"],
      linux: [".cache", "spotify"]
    },
    parts: [
      {
        id: "data",
        label: "Data",
        description: {
          en: "Offline/download cache data. Safe; re-downloads as needed.",
          ru: "Офлайн/загрузочный кэш. Безопасно; при необходимости скачается снова."
        },
        relative: rel(["Data"], null, null)
      },
      {
        id: "storage",
        label: "Storage",
        description: {
          en: "Spotify Storage cache.",
          ru: "Кэш Storage Spotify."
        },
        relative: rel(["Storage"], null, null)
      }
    ]
  },
  {
    id: "telegram",
    category: "messengers",
    label: "Telegram Desktop",
    description: {
      en: "tdata/user_data/cache only. Never deletes tdata itself (chats/keys).",
      ru: "Только tdata/user_data/cache. Сам tdata (чаты/ключи) никогда не удаляется."
    },
    rootKind: "roaming",
    paths: {
      win32: ["Telegram Desktop", "tdata", "user_data", "cache"],
      darwin: ["Library", "Application Support", "Telegram Desktop", "tdata", "user_data", "cache"],
      linux: [".local", "share", "TelegramDesktop", "tdata", "user_data", "cache"]
    }
  },
  {
    id: "d3dshader",
    category: "shaders",
    label: "Direct3D shader cache",
    description: {
      en: "Windows D3DSCache. Games rebuild shaders on next launch.",
      ru: "Windows D3DSCache. Игры пересоберут шейдеры при следующем запуске."
    },
    rootKind: "local",
    paths: {
      win32: ["D3DSCache"],
      darwin: null,
      linux: null
    }
  },
  {
    id: "nvidia-dxcache",
    category: "shaders",
    label: "NVIDIA DXCache",
    description: {
      en: "NVIDIA DirectX shader cache. First launch after clear may stutter.",
      ru: "Кэш шейдеров NVIDIA DirectX. После очистки первый запуск может подтормаживать."
    },
    rootKind: "local",
    paths: {
      win32: ["NVIDIA", "DXCache"],
      darwin: null,
      linux: null
    }
  },
  {
    id: "nvidia-glcache",
    category: "shaders",
    label: "NVIDIA GLCache",
    description: {
      en: "NVIDIA OpenGL shader cache.",
      ru: "Кэш шейдеров NVIDIA OpenGL."
    },
    rootKind: "local",
    paths: {
      win32: ["NVIDIA", "GLCache"],
      darwin: null,
      linux: [".nv", "GLCache"]
    }
  },
  {
    id: "amd-dxcache",
    category: "shaders",
    label: "AMD DXCache",
    description: {
      en: "AMD DirectX shader cache.",
      ru: "Кэш шейдеров AMD DirectX."
    },
    rootKind: "local",
    paths: {
      win32: ["AMD", "DxCache"],
      darwin: null,
      linux: null
    }
  },
  {
    id: "steam-shadercache",
    category: "shaders",
    label: "Steam shader cache",
    description: {
      en: "Per-game shadercache under the Steam library. Not game installs.",
      ru: "shadercache игр в библиотеке Steam. Установки игр не трогает."
    },
    rootKind: "extra",
    extraRootKey: "steam",
    paths: {
      win32: ["steamapps", "shadercache"],
      darwin: ["steamapps", "shadercache"],
      linux: ["steamapps", "shadercache"]
    },
    discoverChildren: {
      omitRootFallback: true,
      description: {
        en: "One game shader cache folder.",
        ru: "Кэш шейдеров одной игры."
      }
    }
  },
  {
    id: "adobe-media-cache",
    category: "creative",
    label: "Adobe Media Cache",
    description: {
      en: "Adobe Common Media Cache Files. Regenerated by Premiere/After Effects.",
      ru: "Adobe Common Media Cache Files. Premiere/After Effects создадут снова."
    },
    rootKind: "roaming",
    paths: {
      win32: ["Adobe", "Common", "Media Cache Files"],
      darwin: ["Library", "Application Support", "Adobe", "Common", "Media Cache Files"],
      linux: null
    }
  },
  {
    id: "adobe-media-cache-files",
    category: "creative",
    label: "Adobe Media Cache",
    description: {
      en: "Adobe Media Cache database folder.",
      ru: "Папка базы Adobe Media Cache."
    },
    rootKind: "roaming",
    paths: {
      win32: ["Adobe", "Common", "Media Cache"],
      darwin: ["Library", "Application Support", "Adobe", "Common", "Media Cache"],
      linux: null
    }
  },
  {
    id: "davinci-resolve",
    category: "creative",
    label: "DaVinci Resolve",
    description: {
      en: "Resolve CacheClip / gallery caches under AppData. Project files stay elsewhere.",
      ru: "CacheClip/галерея Resolve в AppData. Файлы проектов не здесь."
    },
    rootKind: "local",
    paths: {
      win32: ["Blackmagic Design", "DaVinci Resolve"],
      darwin: ["Library", "Application Support", "Blackmagic Design", "DaVinci Resolve"],
      linux: [".local", "share", "DaVinciResolve"]
    },
    parts: [
      {
        id: "cacheclip",
        label: "CacheClip",
        description: {
          en: "Optimized media / CacheClip. Safe; Resolve rebuilds.",
          ru: "Оптимизированные медиа / CacheClip. Безопасно; Resolve пересоберёт."
        },
        relative: sameRelative(["CacheClip"])
      }
    ]
  },
  {
    id: "blender",
    category: "creative",
    label: "Blender",
    description: {
      en: "Blender cache directory. Add-ons and config stay in other folders.",
      ru: "Кэш Blender. Аддоны и конфиг в других папках."
    },
    rootKind: "local",
    paths: {
      win32: ["Blender Foundation", "Blender", "cache"],
      darwin: ["Library", "Caches", "Blender"],
      linux: [".cache", "blender"]
    }
  },
  {
    id: "godot-editor",
    category: "creative",
    label: "Godot editor",
    description: {
      en: "Godot editor app_userdata cache. Project .godot folders stay in Developer Cleaner.",
      ru: "Кэш редактора Godot (app_userdata). Папки .godot проектов — во вкладке Developer."
    },
    rootKind: "roaming",
    paths: {
      win32: ["Godot", "app_userdata"],
      darwin: ["Library", "Application Support", "Godot", "app_userdata"],
      linux: [".local", "share", "godot", "app_userdata"]
    },
    discoverChildren: {
      omitRootFallback: true,
      description: {
        en: "One editor project cache under app_userdata.",
        ru: "Кэш одного проекта редактора в app_userdata."
      }
    }
  },
  {
    id: "steam-download-cache",
    category: "launchers",
    label: "Steam downloading",
    description: {
      en: "Incomplete Steam download folder. Safe if no download is active.",
      ru: "Незавершённые загрузки Steam. Безопасно, если загрузка не идёт."
    },
    rootKind: "extra",
    extraRootKey: "steam",
    paths: {
      win32: ["steamapps", "downloading"],
      darwin: ["steamapps", "downloading"],
      linux: ["steamapps", "downloading"]
    }
  },
  {
    id: "epic-webcache",
    category: "launchers",
    label: "Epic Games Launcher",
    description: {
      en: "Epic launcher web/CEF caches. Installed games stay.",
      ru: "Web/CEF-кэш лаунчера Epic. Установленные игры не трогает."
    },
    rootKind: "local",
    paths: {
      win32: ["EpicGamesLauncher", "Saved"],
      darwin: ["Library", "Caches", "com.epicgames.EpicGamesLauncher"],
      linux: [".cache", "epic"]
    },
    parts: [
      {
        id: "webcache",
        label: "webcache",
        description: {
          en: "Legacy webcache folder.",
          ru: "Папка webcache."
        },
        relative: rel(["webcache"], null, null)
      },
      {
        id: "webcache_4430",
        label: "webcache_4430",
        description: {
          en: "CEF webcache_4430.",
          ru: "CEF webcache_4430."
        },
        relative: rel(["webcache_4430"], null, null)
      },
      {
        id: "webcache_4616",
        label: "webcache_4616",
        description: {
          en: "CEF webcache_4616.",
          ru: "CEF webcache_4616."
        },
        relative: rel(["webcache_4616"], null, null)
      }
    ]
  },
  {
    id: "gog-galaxy-cache",
    category: "launchers",
    label: "GOG Galaxy",
    description: {
      en: "GOG Galaxy cache / GPUCache. Game installs stay.",
      ru: "Кэш / GPUCache GOG Galaxy. Установки игр не трогает."
    },
    rootKind: "local",
    paths: {
      win32: ["GOG.com", "Galaxy"],
      darwin: ["Library", "Application Support", "GOG.com", "Galaxy"],
      linux: [".config", "GOG.com", "Galaxy"]
    },
    parts: [
      {
        id: "cache",
        label: "cache",
        description: {
          en: "Galaxy cache folder.",
          ru: "Папка cache Galaxy."
        },
        relative: sameRelative(["cache"])
      },
      {
        id: "gpu-cache",
        label: "GPUCache",
        description: {
          en: "Galaxy GPUCache.",
          ru: "GPUCache Galaxy."
        },
        relative: sameRelative(["GPUCache"])
      }
    ]
  },
  {
    id: "battle-net-cache",
    category: "launchers",
    label: "Battle.net",
    description: {
      en: "Battle.net Cache folder. Game installs stay.",
      ru: "Папка Cache Battle.net. Установки игр не трогает."
    },
    rootKind: "roaming",
    paths: {
      win32: ["Battle.net", "Cache"],
      darwin: ["Library", "Application Support", "Battle.net", "Cache"],
      linux: null
    }
  },
  {
    id: "riot-client-cache",
    category: "launchers",
    label: "Riot Client",
    description: {
      en: "Riot Client Chromium caches.",
      ru: "Chromium-кэши Riot Client."
    },
    rootKind: "local",
    paths: {
      win32: ["Riot Games", "Riot Client"],
      darwin: ["Library", "Application Support", "Riot Games", "Riot Client"],
      linux: null
    },
    parts: chromiumCacheParts()
  },
  {
    id: "ea-app-cache",
    category: "launchers",
    label: "EA App",
    description: {
      en: "EA Desktop / EA App cache. Game installs stay.",
      ru: "Кэш EA Desktop / EA App. Установки игр не трогает."
    },
    rootKind: "local",
    paths: {
      win32: ["Electronic Arts", "EA Desktop", "CEF"],
      darwin: ["Library", "Application Support", "Electronic Arts", "EA Desktop"],
      linux: null
    },
    parts: chromiumCacheParts()
  }
];

function pickLocale(text: LocalizedText, locale: SystemCacheLocale): string {
  return locale === "ru" ? text.ru : text.en;
}

function platformParts(paths: PlatformPaths, platform: NodeJS.Platform): PathParts {
  if (platform === "win32") return paths.win32;
  if (platform === "darwin") return paths.darwin;
  return paths.linux;
}

function resolveBase(
  def: SystemCacheDefinition,
  home: string,
  platform: NodeJS.Platform,
  options?: SystemCacheScanOptions
): string | null {
  const kind: RootKind = def.useTmpdir ? "tmpdir" : (def.rootKind ?? "home");
  if (kind === "tmpdir") {
    const tmp = options?.tmpdir ?? os.tmpdir();
    return tmp || null;
  }
  if (kind === "extra") {
    const key = def.extraRootKey;
    if (!key) return null;
    const root = options?.extraRoots?.[key];
    return root || null;
  }
  if (platform === "win32") {
    if (kind === "local") {
      return (
        options?.localAppData ||
        process.env.LOCALAPPDATA ||
        path.join(home, "AppData", "Local")
      );
    }
    if (kind === "roaming") {
      return (
        options?.roamingAppData ||
        process.env.APPDATA ||
        path.join(home, "AppData", "Roaming")
      );
    }
  }
  return home;
}

function rootPath(
  def: SystemCacheDefinition,
  home: string,
  platform: NodeJS.Platform,
  options?: SystemCacheScanOptions
): string | null {
  const base = resolveBase(def, home, platform, options);
  if (!base) return null;
  const parts = platformParts(def.paths, platform);
  if (parts === null) return null;
  return parts.length === 0 ? base : path.join(base, ...parts);
}

function partPath(
  root: string,
  part: SystemCachePartDefinition,
  platform: NodeJS.Platform
): string | null {
  const relative = platformParts(part.relative, platform);
  if (relative === null) return null;
  return relative.length === 0 ? root : path.join(root, ...relative);
}

function leafFromPart(
  def: SystemCacheDefinition,
  part: SystemCachePartDefinition,
  home: string,
  platform: NodeJS.Platform,
  options?: SystemCacheScanOptions
): SystemCacheLocation | null {
  const root = rootPath(def, home, platform, options);
  if (!root) return null;
  const resolved = partPath(root, part, platform);
  if (!resolved) return null;
  return {
    id: `${def.id}/${part.id}`,
    parentId: def.id,
    parentLabel: def.label,
    parentPath: root,
    label: part.label,
    path: resolved,
    category: def.category
  };
}

function singleLeaf(
  def: SystemCacheDefinition,
  home: string,
  platform: NodeJS.Platform,
  options?: SystemCacheScanOptions
): SystemCacheLocation | null {
  const resolved = rootPath(def, home, platform, options);
  if (!resolved) return null;
  return {
    id: def.id,
    parentId: def.id,
    parentLabel: def.label,
    parentPath: resolved,
    label: def.label,
    path: resolved,
    category: def.category
  };
}

export async function systemCacheCandidates(
  home: string,
  platform: NodeJS.Platform,
  fsOps?: Pick<SystemCacheFsOps, "readdir">,
  options?: SystemCacheScanOptions
): Promise<SystemCacheLocation[]> {
  const result: SystemCacheLocation[] = [];

  for (const def of SYSTEM_CACHE_DEFINITIONS) {
    const root = rootPath(def, home, platform, options);
    if (!root) continue;

    const explicit = def.parts ?? [];
    for (const part of explicit) {
      const leaf = leafFromPart(def, part, home, platform, options);
      if (leaf) result.push(leaf);
    }

    const explicitIds = new Set(explicit.map(part => part.id));
    if (def.discoverChildren && fsOps?.readdir) {
      let names: string[] = [];
      try {
        names = await fsOps.readdir(root);
      } catch {
        names = [];
      }
      const exclude = new Set(
        (def.discoverChildren.exclude ?? []).map(name => name.toLowerCase())
      );
      const prefix = def.discoverChildren.namePrefix?.toLowerCase();
      const childRelative = def.discoverChildren.childRelative ?? [];
      for (const name of names) {
        if (exclude.has(name.toLowerCase())) continue;
        if (explicitIds.has(name)) continue;
        if (prefix && !name.toLowerCase().startsWith(prefix)) continue;
        if (name === "." || name === "..") continue;
        const leafPath =
          childRelative.length > 0
            ? path.join(root, name, ...childRelative)
            : path.join(root, name);
        const label =
          childRelative.length > 0 ? `${name}/${childRelative.join("/")}` : name;
        result.push({
          id: `${def.id}/${name}`,
          parentId: def.id,
          parentLabel: def.label,
          parentPath: root,
          label,
          path: leafPath,
          category: def.category
        });
      }
    } else if (explicit.length === 0 && !def.discoverChildren) {
      const leaf = singleLeaf(def, home, platform, options);
      if (leaf) result.push(leaf);
    } else if (
      explicit.length === 0 &&
      def.discoverChildren &&
      !fsOps?.readdir &&
      !def.discoverChildren.namePrefix &&
      !def.discoverChildren.omitRootFallback
    ) {
      const leaf = singleLeaf(def, home, platform, options);
      if (leaf) result.push(leaf);
    }
  }

  return result;
}

function descriptionForLeaf(
  item: SystemCacheLocation,
  locale: SystemCacheLocale
): { description: string; parentDescription: string } {
  const def = SYSTEM_CACHE_DEFINITIONS.find(entry => entry.id === item.parentId);
  if (!def) return { description: "", parentDescription: "" };
  const parentDescription = pickLocale(def.description, locale);
  if (item.id === def.id) {
    return { description: parentDescription, parentDescription };
  }
  const partId = item.id.slice(def.id.length + 1);
  const part = def.parts?.find(entry => entry.id === partId);
  if (part) {
    return { description: pickLocale(part.description, locale), parentDescription };
  }
  if (def.discoverChildren) {
    return {
      description: pickLocale(def.discoverChildren.description, locale),
      parentDescription
    };
  }
  return { description: parentDescription, parentDescription };
}

export function collapseAggregatedSystemCaches(
  items: SystemCacheScanItem[]
): SystemCacheScanItem[] {
  const buckets = new Map<string, SystemCacheScanItem[]>();
  const rest: SystemCacheScanItem[] = [];

  for (const item of items) {
    if (AGGREGATED_SYSTEM_PARENT_IDS.has(item.parentId) && !item.aggregated) {
      const list = buckets.get(item.parentId) ?? [];
      list.push(item);
      buckets.set(item.parentId, list);
      continue;
    }
    rest.push(item);
  }

  for (const [parentId, kids] of buckets) {
    if (kids.length === 0) continue;
    const first = kids[0];
    const children: SystemCacheChild[] = kids
      .map(kid => ({ path: kid.path, label: kid.label, size: kid.size }))
      .sort((a, b) => b.size - a.size);
    const size = children.reduce((sum, child) => sum + child.size, 0);
    rest.push({
      id: parentId,
      parentId,
      parentLabel: first.parentLabel,
      parentPath: first.parentPath,
      parentDescription: first.parentDescription,
      label: first.parentLabel,
      path: first.parentPath,
      size,
      category: first.category,
      categoryLabel: first.categoryLabel,
      description: first.parentDescription,
      aggregated: true,
      children
    });
  }

  return rest.sort((a, b) => b.size - a.size);
}

export function presentSystemCaches(
  items: SystemCacheFound[],
  locale: SystemCacheLocale = "en"
): SystemCacheScanItem[] {
  const presented = items.map(item => {
    const texts = descriptionForLeaf(item, locale);
    return {
      id: item.id,
      parentId: item.parentId,
      parentLabel: item.parentLabel,
      parentPath: item.parentPath,
      parentDescription: texts.parentDescription,
      label: item.label,
      path: item.path,
      size: item.size,
      category: item.category,
      categoryLabel: pickLocale(CATEGORY_LABELS[item.category], locale),
      description: texts.description
    };
  });
  return collapseAggregatedSystemCaches(presented);
}

export function systemCacheCatalog(
  home: string,
  platform: NodeJS.Platform,
  locale: SystemCacheLocale = "en",
  options?: SystemCacheScanOptions
): SystemCacheCatalogCategory[] {
  const byCategory = new Map<SystemCacheCategoryId, SystemCacheCatalogItem[]>();

  for (const def of SYSTEM_CACHE_DEFINITIONS) {
    const root = rootPath(def, home, platform, options);
    if (!root) continue;
    const parts: SystemCacheCatalogPart[] = [];
    for (const part of def.parts ?? []) {
      const resolved = partPath(root, part, platform);
      if (!resolved) continue;
      parts.push({
        id: `${def.id}/${part.id}`,
        label: part.label,
        path: resolved,
        description: pickLocale(part.description, locale)
      });
    }
    const list = byCategory.get(def.category) ?? [];
    list.push({
      id: def.id,
      label: def.label,
      path: root,
      description: pickLocale(def.description, locale),
      parts,
      discoversChildren: Boolean(def.discoverChildren)
    });
    byCategory.set(def.category, list);
  }

  return CATEGORY_ORDER.filter(id => (byCategory.get(id)?.length ?? 0) > 0).map(id => ({
    id,
    label: pickLocale(CATEGORY_LABELS[id], locale),
    items: byCategory.get(id) ?? []
  }));
}

export interface SystemCacheScanProgress {
  checked: number;
  total: number;
  path: string;
}

export async function collectExistingSystemCaches(
  home: string,
  platform: NodeJS.Platform,
  fsOps: SystemCacheFsOps,
  onProgress?: (
    update: SystemCacheScanProgress,
    found?: SystemCacheFound
  ) => void | Promise<void>,
  options?: SystemCacheScanOptions
): Promise<SystemCacheFound[]> {
  const candidates = await systemCacheCandidates(home, platform, fsOps, options);
  const found: SystemCacheFound[] = [];
  const total = candidates.length;

  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    let hit: SystemCacheFound | undefined;

    let stats: SystemCacheStat;
    try {
      stats = await fsOps.stat(candidate.path);
    } catch {
      await onProgress?.({ checked: index + 1, total, path: candidate.path });
      continue;
    }

    if (stats.isSymbolicLink()) {
      await onProgress?.({ checked: index + 1, total, path: candidate.path });
      continue;
    }

    if (stats.isDirectory()) {
      hit = { ...candidate, size: await fsOps.getDirSize(candidate.path) };
      found.push(hit);
    } else if (stats.isFile()) {
      hit = { ...candidate, size: stats.size };
      found.push(hit);
    }

    await onProgress?.({ checked: index + 1, total, path: candidate.path }, hit);
  }

  return found;
}

/** Exposed for Phase B+ tests that extend the catalog. */
export function systemCacheDefinitionIds(): string[] {
  return SYSTEM_CACHE_DEFINITIONS.map(def => def.id);
}
