import path from "path";

export type ToolCacheLocale = "en" | "ru";

export type ToolCacheCategoryId =
  | "javascript"
  | "python"
  | "jvm"
  | "dotnet"
  | "systems"
  | "mobile"
  | "containers"
  | "gamedev"
  | "php"
  | "ide"
  | "pkgmanagers";

export interface LocalizedText {
  en: string;
  ru: string;
}

export interface ToolCacheLocation {
  id: string;
  parentId: string;
  parentLabel: string;
  parentPath: string;
  label: string;
  path: string;
  category: ToolCacheCategoryId;
}

export interface ToolCacheFound extends ToolCacheLocation {
  size: number;
}

export interface ToolCacheScanItem {
  id: string;
  parentId: string;
  parentLabel: string;
  parentPath: string;
  parentDescription: string;
  label: string;
  path: string;
  size: number;
  category: ToolCacheCategoryId;
  categoryLabel: string;
  description: string;
}

export interface ToolCacheCatalogPart {
  id: string;
  label: string;
  path: string;
  description: string;
}

export interface ToolCacheCatalogItem {
  id: string;
  label: string;
  path: string;
  description: string;
  parts: ToolCacheCatalogPart[];
  discoversChildren: boolean;
}

export interface ToolCacheCatalogCategory {
  id: ToolCacheCategoryId;
  label: string;
  items: ToolCacheCatalogItem[];
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
  readdir?(dir: string): Promise<string[]>;
}

type PathParts = string[] | null;

interface PlatformPaths {
  win32: PathParts;
  darwin: PathParts;
  linux: PathParts;
}

interface ToolCachePartDefinition {
  id: string;
  label: string;
  description: LocalizedText;
  /** Segments under the tool root. Empty array = the root itself. */
  relative: PlatformPaths;
}

interface ToolCacheDefinition {
  id: string;
  category: ToolCacheCategoryId;
  label: string;
  description: LocalizedText;
  paths: PlatformPaths;
  parts?: ToolCachePartDefinition[];
  /** List immediate children of root at scan time (e.g. versioned IDE folders). */
  discoverChildren?: {
    description: LocalizedText;
    namePrefix?: string;
    exclude?: string[];
  };
}

const CATEGORY_ORDER: ToolCacheCategoryId[] = [
  "javascript",
  "python",
  "jvm",
  "dotnet",
  "systems",
  "mobile",
  "containers",
  "gamedev",
  "php",
  "ide",
  "pkgmanagers"
];

const CATEGORY_LABELS: Record<ToolCacheCategoryId, LocalizedText> = {
  javascript: { en: "JavaScript / Node", ru: "JavaScript / Node" },
  python: { en: "Python & ML", ru: "Python и ML" },
  jvm: { en: "JVM", ru: "JVM" },
  dotnet: { en: ".NET", ru: ".NET" },
  systems: { en: "Systems languages", ru: "Системные языки" },
  mobile: { en: "Mobile", ru: "Мобильная разработка" },
  containers: { en: "Containers", ru: "Контейнеры" },
  gamedev: { en: "Game engines", ru: "Игровые движки" },
  php: { en: "PHP", ru: "PHP" },
  ide: { en: "IDE caches", ru: "Кэши IDE" },
  pkgmanagers: { en: "OS package managers", ru: "Пакетные менеджеры ОС" }
};

function sameRelative(segments: string[]): PlatformPaths {
  return { win32: segments, darwin: segments, linux: segments };
}

function rel(
  win32: PathParts,
  darwin: PathParts,
  linux: PathParts
): PlatformPaths {
  return { win32, darwin, linux };
}

/** Single source of truth: roots, optional parts, bilingual descriptions. */
const TOOL_CACHE_DEFINITIONS: ToolCacheDefinition[] = [
  {
    id: "npm",
    category: "javascript",
    label: "npm",
    description: {
      en: "npm package download cache. Prefer deleting _cacache; logs/npx are usually safe too.",
      ru: "Кэш загрузок npm. Обычно безопасно чистить _cacache; логи/_npx тоже."
    },
    paths: {
      win32: ["AppData", "Local", "npm-cache"],
      darwin: [".npm"],
      linux: [".npm"]
    },
    parts: [
      {
        id: "cacache",
        label: "_cacache",
        description: {
          en: "Main package content cache. Safe; packages re-download on install.",
          ru: "Основной кэш содержимого пакетов. Безопасно; пакеты скачаются снова."
        },
        relative: sameRelative(["_cacache"])
      },
      {
        id: "logs",
        label: "_logs",
        description: {
          en: "npm log files. Safe to delete.",
          ru: "Логи npm. Безопасно удалять."
        },
        relative: sameRelative(["_logs"])
      },
      {
        id: "npx",
        label: "_npx",
        description: {
          en: "npx temporary package installs. Safe; next npx will re-fetch.",
          ru: "Временные установки npx. Безопасно; следующий npx скачает снова."
        },
        relative: sameRelative(["_npx"])
      },
      {
        id: "prebuilds",
        label: "_prebuilds",
        description: {
          en: "Cached native prebuilds. Safe; rebuilt/re-downloaded when needed.",
          ru: "Кэш native prebuilds. Безопасно; скачается/соберётся снова при необходимости."
        },
        relative: sameRelative(["_prebuilds"])
      }
    ]
  },
  {
    id: "npm-roaming",
    category: "javascript",
    label: "npm (Roaming)",
    description: {
      en: "Legacy Windows npm cache under %AppData%\\npm-cache.",
      ru: "Старый кэш npm на Windows в %AppData%\\npm-cache."
    },
    paths: {
      win32: ["AppData", "Roaming", "npm-cache"],
      darwin: null,
      linux: null
    },
    parts: [
      {
        id: "cacache",
        label: "_cacache",
        description: {
          en: "Legacy package content cache. Safe to clear.",
          ru: "Старый кэш содержимого пакетов. Безопасно очищать."
        },
        relative: rel(["_cacache"], null, null)
      },
      {
        id: "logs",
        label: "_logs",
        description: {
          en: "Legacy npm logs. Safe to delete.",
          ru: "Старые логи npm. Безопасно удалять."
        },
        relative: rel(["_logs"], null, null)
      }
    ]
  },
  {
    id: "yarn",
    category: "javascript",
    label: "Yarn",
    description: {
      en: "Yarn download cache. Regenerated on the next yarn install.",
      ru: "Кэш загрузок Yarn. Восстанавливается при следующем yarn install."
    },
    paths: {
      win32: ["AppData", "Local", "Yarn", "Cache"],
      darwin: [".cache", "yarn"],
      linux: [".cache", "yarn"]
    }
  },
  {
    id: "pnpm",
    category: "javascript",
    label: "pnpm",
    description: {
      en: "pnpm content-addressable store. Linked installs may break until reinstall.",
      ru: "Store pnpm. Связанные установки могут сломаться до повторного install."
    },
    paths: {
      win32: ["AppData", "Local", "pnpm", "store"],
      darwin: [".local", "share", "pnpm", "store"],
      linux: [".local", "share", "pnpm", "store"]
    },
    discoverChildren: {
      description: {
        en: "pnpm store version folder (e.g. v3). Regenerable; run pnpm install in projects after deleting.",
        ru: "Версия store pnpm (например v3). Восстанавливается; после удаления нужен pnpm install в проектах."
      }
    }
  },
  {
    id: "bun",
    category: "javascript",
    label: "Bun",
    description: {
      en: "Bun install cache for downloaded packages.",
      ru: "Кэш установки Bun для скачанных пакетов."
    },
    paths: {
      win32: [".bun", "install", "cache"],
      darwin: [".bun", "install", "cache"],
      linux: [".bun", "install", "cache"]
    }
  },
  {
    id: "deno",
    category: "javascript",
    label: "Deno",
    description: {
      en: "Deno cache directory (deps, generated code, etc.). Mostly regenerable.",
      ru: "Каталог кэша Deno (deps, сгенерированный код и т.д.). В основном восстанавливаемый."
    },
    paths: {
      win32: ["AppData", "Local", "deno"],
      darwin: [".cache", "deno"],
      linux: [".cache", "deno"]
    },
    parts: [
      {
        id: "deps",
        label: "deps",
        description: {
          en: "Cached remote modules. Safe; re-fetched as needed.",
          ru: "Кэш удалённых модулей. Безопасно; скачается снова."
        },
        relative: sameRelative(["deps"])
      },
      {
        id: "npm",
        label: "npm",
        description: {
          en: "Deno npm compatibility cache. Safe to clear.",
          ru: "Кэш npm-совместимости Deno. Безопасно очищать."
        },
        relative: sameRelative(["npm"])
      },
      {
        id: "gen",
        label: "gen",
        description: {
          en: "Generated/transpiled code cache. Safe to clear.",
          ru: "Кэш сгенерированного кода. Безопасно очищать."
        },
        relative: sameRelative(["gen"])
      }
    ]
  },
  {
    id: "pip",
    category: "python",
    label: "pip",
    description: {
      en: "pip HTTP wheel/source cache. Safe to clear.",
      ru: "HTTP-кэш wheels/исходников pip. Безопасно очищать."
    },
    paths: {
      win32: ["AppData", "Local", "pip", "Cache"],
      darwin: [".cache", "pip"],
      linux: [".cache", "pip"]
    },
    parts: [
      {
        id: "http",
        label: "http",
        description: {
          en: "Downloaded package HTTP cache. Safe.",
          ru: "HTTP-кэш скачанных пакетов. Безопасно."
        },
        relative: sameRelative(["http"])
      },
      {
        id: "wheels",
        label: "wheels",
        description: {
          en: "Built/downloaded wheels. Safe.",
          ru: "Собранные/скачанные wheels. Безопасно."
        },
        relative: sameRelative(["wheels"])
      }
    ]
  },
  {
    id: "poetry",
    category: "python",
    label: "Poetry",
    description: {
      en: "Poetry cache root. Artifacts are safe; virtualenvs cost time to recreate.",
      ru: "Корень кэша Poetry. Артефакты безопасны; virtualenvs долго создавать заново."
    },
    paths: {
      win32: ["AppData", "Local", "pypoetry", "Cache"],
      darwin: ["Library", "Caches", "pypoetry"],
      linux: [".cache", "pypoetry"]
    },
    parts: [
      {
        id: "cache",
        label: "cache",
        description: {
          en: "Artifact/download cache. Safe to clear.",
          ru: "Кэш артефактов/загрузок. Безопасно очищать."
        },
        relative: sameRelative(["cache"])
      },
      {
        id: "virtualenvs",
        label: "virtualenvs",
        description: {
          en: "CAUTION: Poetry-managed virtualenvs. Projects need poetry install afterwards.",
          ru: "ОСТОРОЖНО: виртуальные окружения Poetry. После удаления нужен poetry install."
        },
        relative: sameRelative(["virtualenvs"])
      },
      {
        id: "artifacts",
        label: "artifacts",
        description: {
          en: "Cached package artifacts. Safe to clear.",
          ru: "Кэш артефактов пакетов. Безопасно очищать."
        },
        relative: sameRelative(["artifacts"])
      }
    ]
  },
  {
    id: "conda",
    category: "python",
    label: "Conda",
    description: {
      en: "Conda downloaded package cache (.conda/pkgs). Does not remove environments.",
      ru: "Кэш скачанных пакетов Conda (.conda/pkgs). Окружения не удаляет."
    },
    paths: {
      win32: [".conda", "pkgs"],
      darwin: [".conda", "pkgs"],
      linux: [".conda", "pkgs"]
    }
  },
  {
    id: "huggingface",
    category: "python",
    label: "Hugging Face",
    description: {
      en: "CAUTION: Hub cache. Regenerable but often huge / slow to restore.",
      ru: "ОСТОРОЖНО: кэш Hub. Восстанавливаемый, но часто огромный и долго качается."
    },
    paths: {
      win32: [".cache", "huggingface"],
      darwin: [".cache", "huggingface"],
      linux: [".cache", "huggingface"]
    },
    parts: [
      {
        id: "hub",
        label: "hub",
        description: {
          en: "CAUTION: Downloaded models/datasets from the Hub. Very large.",
          ru: "ОСТОРОЖНО: скачанные модели/датасеты с Hub. Очень большой объём."
        },
        relative: sameRelative(["hub"])
      },
      {
        id: "transformers",
        label: "transformers",
        description: {
          en: "Transformers library cache. Re-downloads when needed.",
          ru: "Кэш библиотеки Transformers. Скачается снова при необходимости."
        },
        relative: sameRelative(["transformers"])
      },
      {
        id: "datasets",
        label: "datasets",
        description: {
          en: "Datasets library cache. Re-downloads when needed.",
          ru: "Кэш библиотеки datasets. Скачается снова при необходимости."
        },
        relative: sameRelative(["datasets"])
      },
      {
        id: "xet",
        label: "xet",
        description: {
          en: "Xet storage cache used by newer Hub downloads.",
          ru: "Кэш Xet для новых загрузок Hub."
        },
        relative: sameRelative(["xet"])
      }
    ]
  },
  {
    id: "torch",
    category: "python",
    label: "PyTorch Hub",
    description: {
      en: "PyTorch Hub / torch.hub download cache.",
      ru: "Кэш загрузок PyTorch Hub / torch.hub."
    },
    paths: {
      win32: [".cache", "torch"],
      darwin: [".cache", "torch"],
      linux: [".cache", "torch"]
    },
    parts: [
      {
        id: "hub",
        label: "hub",
        description: {
          en: "torch.hub model cache. Re-downloads when needed.",
          ru: "Кэш моделей torch.hub. Скачается снова при необходимости."
        },
        relative: sameRelative(["hub"])
      }
    ]
  },
  {
    id: "maven",
    category: "jvm",
    label: "Maven",
    description: {
      en: "Local Maven repository. Dependencies re-download; locally mvn-install'ed artifacts are lost.",
      ru: "Локальный репозиторий Maven. Зависимости скачаются снова; локально установленные артефакты пропадут."
    },
    paths: {
      win32: [".m2", "repository"],
      darwin: [".m2", "repository"],
      linux: [".m2", "repository"]
    }
  },
  {
    id: "gradle",
    category: "jvm",
    label: "Gradle",
    description: {
      en: "Gradle user home. Prefer caches/; jdks/ are slower to restore.",
      ru: "Gradle user home. Лучше чистить caches/; jdks/ дольше восстанавливать."
    },
    paths: {
      win32: [".gradle"],
      darwin: [".gradle"],
      linux: [".gradle"]
    },
    parts: [
      {
        id: "caches",
        label: "caches",
        description: {
          en: "Dependency/build caches. Safe; next builds refill them.",
          ru: "Кэши зависимостей/сборки. Безопасно; следующие сборки заполнят снова."
        },
        relative: sameRelative(["caches"])
      },
      {
        id: "daemon",
        label: "daemon",
        description: {
          en: "Gradle daemon state. Safe; daemons restart automatically.",
          ru: "Состояние Gradle daemon. Безопасно; демоны перезапустятся."
        },
        relative: sameRelative(["daemon"])
      },
      {
        id: "wrapper",
        label: "wrapper",
        description: {
          en: "Cached Gradle wrapper distributions. Re-downloaded when needed.",
          ru: "Кэш дистрибутивов Gradle Wrapper. Скачается снова при необходимости."
        },
        relative: sameRelative(["wrapper"])
      },
      {
        id: "native",
        label: "native",
        description: {
          en: "Native library cache. Safe to clear.",
          ru: "Кэш native-библиотек. Безопасно очищать."
        },
        relative: sameRelative(["native"])
      },
      {
        id: "jdks",
        label: "jdks",
        description: {
          en: "CAUTION: JDKs provisioned by Gradle toolchains. Re-downloaded; can be large.",
          ru: "ОСТОРОЖНО: JDK, скачанные toolchain Gradle. Скачаются снова; могут быть большими."
        },
        relative: sameRelative(["jdks"])
      },
      {
        id: "workers",
        label: "workers",
        description: {
          en: "Worker process scratch data. Safe to clear.",
          ru: "Временные данные worker-процессов. Безопасно очищать."
        },
        relative: sameRelative(["workers"])
      }
    ]
  },
  {
    id: "ivy",
    category: "jvm",
    label: "Ivy / sbt",
    description: {
      en: "Apache Ivy / sbt dependency cache.",
      ru: "Кэш зависимостей Apache Ivy / sbt."
    },
    paths: {
      win32: [".ivy2", "cache"],
      darwin: [".ivy2", "cache"],
      linux: [".ivy2", "cache"]
    }
  },
  {
    id: "nuget",
    category: "dotnet",
    label: "NuGet",
    description: {
      en: "Global NuGet packages folder. Restored on next build/restore.",
      ru: "Глобальная папка пакетов NuGet. Восстанавливается при сборке/restore."
    },
    paths: {
      win32: [".nuget", "packages"],
      darwin: [".nuget", "packages"],
      linux: [".nuget", "packages"]
    }
  },
  {
    id: "cargo",
    category: "systems",
    label: "Cargo",
    description: {
      en: "Cargo home. registry/ is cache; bin/ holds cargo-install binaries.",
      ru: "Домашний каталог Cargo. registry/ — кэш; bin/ — бинарники cargo install."
    },
    paths: {
      win32: [".cargo"],
      darwin: [".cargo"],
      linux: [".cargo"]
    },
    parts: [
      {
        id: "registry",
        label: "registry",
        description: {
          en: "crates.io registry cache. Safe; crates re-download.",
          ru: "Кэш реестра crates.io. Безопасно; крейты скачаются снова."
        },
        relative: sameRelative(["registry"])
      },
      {
        id: "git",
        label: "git",
        description: {
          en: "Git dependency checkouts cache. Safe; re-cloned when needed.",
          ru: "Кэш git-зависимостей. Безопасно; клонируется снова при необходимости."
        },
        relative: sameRelative(["git"])
      },
      {
        id: "bin",
        label: "bin",
        description: {
          en: "UNSAFE / CAUTION: Binaries from cargo install (cli tools). You must reinstall them.",
          ru: "НЕБЕЗОПАСНО / ОСТОРОЖНО: бинарники из cargo install (CLI-утилиты). Нужно ставить заново."
        },
        relative: sameRelative(["bin"])
      }
    ]
  },
  {
    id: "go",
    category: "systems",
    label: "Go modules",
    description: {
      en: "Default GOPATH module cache under ~/go.",
      ru: "Кэш модулей Go по умолчанию в ~/go."
    },
    paths: {
      win32: ["go"],
      darwin: ["go"],
      linux: ["go"]
    },
    parts: [
      {
        id: "pkg-mod",
        label: "pkg/mod",
        description: {
          en: "Downloaded modules. Safe; go will re-fetch.",
          ru: "Скачанные модули. Безопасно; go скачает снова."
        },
        relative: sameRelative(["pkg", "mod"])
      },
      {
        id: "pkg-sumdb",
        label: "pkg/sumdb",
        description: {
          en: "Checksum database cache. Safe to clear.",
          ru: "Кэш checksum DB. Безопасно очищать."
        },
        relative: sameRelative(["pkg", "sumdb"])
      }
    ]
  },
  {
    id: "ccache",
    category: "systems",
    label: "ccache",
    description: {
      en: "Compiler cache for C/C++ builds. Safe to clear.",
      ru: "Кэш компилятора C/C++. Безопасно очищать."
    },
    paths: {
      win32: ["AppData", "Local", "ccache"],
      darwin: [".cache", "ccache"],
      linux: [".cache", "ccache"]
    }
  },
  {
    id: "android",
    category: "mobile",
    label: "Android SDK home",
    description: {
      en: ".android user data. Prefer cache/build-cache; AVD and keystores are sensitive.",
      ru: "Данные пользователя .android. Лучше cache/build-cache; AVD и keystore чувствительны."
    },
    paths: {
      win32: [".android"],
      darwin: [".android"],
      linux: [".android"]
    },
    parts: [
      {
        id: "cache",
        label: "cache",
        description: {
          en: "Android tooling cache. Safe to clear.",
          ru: "Кэш инструментов Android. Безопасно очищать."
        },
        relative: sameRelative(["cache"])
      },
      {
        id: "build-cache",
        label: "build-cache",
        description: {
          en: "Android build cache. Safe; next builds refill it.",
          ru: "Build cache Android. Безопасно; следующие сборки заполнят снова."
        },
        relative: sameRelative(["build-cache"])
      },
      {
        id: "metrics",
        label: "metrics",
        description: {
          en: "Analytics/metrics data. Safe to clear.",
          ru: "Метрики/аналитика. Безопасно очищать."
        },
        relative: sameRelative(["metrics"])
      },
      {
        id: "avd",
        label: "avd",
        description: {
          en: "UNSAFE: Android Virtual Devices. Emulators and their data are removed.",
          ru: "НЕБЕЗОПАСНО: Android Virtual Devices. Эмуляторы и их данные будут удалены."
        },
        relative: sameRelative(["avd"])
      }
    ]
  },
  {
    id: "android-studio",
    category: "mobile",
    label: "Android Studio",
    description: {
      en: "CAUTION: Versioned Android Studio system dirs under Local/Google. Prefer Invalidate Caches in the IDE.",
      ru: "ОСТОРОЖНО: версионные системные каталоги Android Studio в Local/Google. Лучше Invalidate Caches в IDE."
    },
    paths: {
      win32: ["AppData", "Local", "Google"],
      darwin: ["Library", "Caches", "Google"],
      linux: [".cache", "Google"]
    },
    discoverChildren: {
      namePrefix: "AndroidStudio",
      description: {
        en: "CAUTION: One Android Studio version system dir (indexes/caches). IDE will re-index.",
        ru: "ОСТОРОЖНО: системный каталог одной версии Android Studio (индексы/кэши). IDE переиндексирует."
      }
    }
  },
  {
    id: "pub",
    category: "mobile",
    label: "Flutter / Pub",
    description: {
      en: "Dart/Flutter pub package cache.",
      ru: "Кэш пакетов Dart/Flutter pub."
    },
    paths: {
      win32: ["AppData", "Local", "Pub", "Cache"],
      darwin: [".pub-cache"],
      linux: [".pub-cache"]
    },
    parts: [
      {
        id: "hosted",
        label: "hosted",
        description: {
          en: "Hosted package cache. Safe; pub get re-fetches.",
          ru: "Кэш hosted-пакетов. Безопасно; pub get скачает снова."
        },
        relative: sameRelative(["hosted"])
      },
      {
        id: "git",
        label: "git",
        description: {
          en: "Git package checkouts. Safe; re-cloned when needed.",
          ru: "Git-пакеты. Безопасно; клонируются снова при необходимости."
        },
        relative: sameRelative(["git"])
      }
    ]
  },
  {
    id: "cocoapods",
    category: "mobile",
    label: "CocoaPods",
    description: {
      en: "CocoaPods download cache (macOS).",
      ru: "Кэш загрузок CocoaPods (macOS)."
    },
    paths: {
      win32: null,
      darwin: ["Library", "Caches", "CocoaPods"],
      linux: null
    }
  },
  {
    id: "xcode-deriveddata",
    category: "mobile",
    label: "Xcode DerivedData",
    description: {
      en: "Xcode DerivedData (macOS). Next builds will be slower.",
      ru: "DerivedData Xcode (macOS). Следующие сборки будут медленнее."
    },
    paths: {
      win32: null,
      darwin: ["Library", "Developer", "Xcode", "DerivedData"],
      linux: null
    },
    discoverChildren: {
      description: {
        en: "One project's DerivedData folder. Safe but that project rebuilds from scratch.",
        ru: "DerivedData одного проекта. Безопасно, но проект пересоберётся с нуля."
      }
    }
  },
  {
    id: "docker-buildx",
    category: "containers",
    label: "Docker Buildx",
    description: {
      en: "Docker Buildx build cache. Does not remove images, containers, or volumes.",
      ru: "Кэш сборки Docker Buildx. Не удаляет образы, контейнеры и volumes."
    },
    paths: {
      win32: [".docker", "buildx"],
      darwin: [".docker", "buildx"],
      linux: [".docker", "buildx"]
    }
  },
  {
    id: "docker-desktop",
    category: "containers",
    label: "Docker Desktop",
    description: {
      en: "Docker Desktop host data. Images/containers/volumes live inside the VM disk (wsl/vms) — not separable here.",
      ru: "Данные Docker Desktop на хосте. Образы/контейнеры/volumes живут внутри диска VM (wsl/vms) — отдельно тут не вырезать."
    },
    paths: {
      win32: ["AppData", "Local", "Docker"],
      darwin: ["Library", "Containers", "com.docker.docker", "Data"],
      linux: null
    },
    parts: [
      {
        id: "log",
        label: "log",
        description: {
          en: "Docker Desktop logs. Relatively safe to delete.",
          ru: "Логи Docker Desktop. Относительно безопасно удалять."
        },
        relative: rel(["log"], ["log"], null)
      },
      {
        id: "tasks",
        label: "tasks",
        description: {
          en: "Desktop task/state scratch data. Usually safe; Desktop recreates it.",
          ru: "Служебные данные задач Desktop. Обычно безопасно; Desktop создаст снова."
        },
        relative: rel(["tasks"], null, null)
      },
      {
        id: "wsl",
        label: "wsl",
        description: {
          en: "UNSAFE: WSL2 VM data (ext4.vhdx). Deletes images, containers, volumes, networks together — cannot wipe only volumes from here.",
          ru: "НЕБЕЗОПАСНО: данные WSL2 VM (ext4.vhdx). Сносит образы, контейнеры, volumes и сети вместе — только volumes отсюда не удалить."
        },
        relative: rel(["wsl"], null, null)
      },
      {
        id: "vms",
        label: "vms",
        description: {
          en: "UNSAFE: Docker Desktop VM data on macOS. Images, containers, and volumes live here.",
          ru: "НЕБЕЗОПАСНО: данные VM Docker Desktop на macOS. Здесь образы, контейнеры и volumes."
        },
        relative: rel(null, ["vms"], null)
      }
    ]
  },
  {
    id: "podman",
    category: "containers",
    label: "Podman",
    description: {
      en: "UNSAFE overall: full Podman storage. Prefer deleting only cache-like subfolders if present.",
      ru: "В целом НЕБЕЗОПАСНО: полное хранилище Podman. Лучше удалять только кэш-подобные подпапки, если есть."
    },
    paths: {
      win32: null,
      darwin: [".local", "share", "containers"],
      linux: [".local", "share", "containers"]
    },
    parts: [
      {
        id: "storage",
        label: "storage",
        description: {
          en: "UNSAFE: images, containers, volumes storage.",
          ru: "НЕБЕЗОПАСНО: хранилище образов, контейнеров и volumes."
        },
        relative: rel(null, ["storage"], ["storage"])
      },
      {
        id: "cache",
        label: "cache",
        description: {
          en: "Podman cache data. Usually safer than storage/.",
          ru: "Кэш Podman. Обычно безопаснее, чем storage/."
        },
        relative: rel(null, ["cache"], ["cache"])
      }
    ]
  },
  {
    id: "unity",
    category: "gamedev",
    label: "Unity",
    description: {
      en: "CAUTION: Unity editor/global data. Project Library folders are separate (project scan).",
      ru: "ОСТОРОЖНО: глобальные данные Unity. Library проектов — отдельно (скан проектов)."
    },
    paths: {
      win32: ["AppData", "Local", "Unity", "cache"],
      darwin: ["Library", "Unity", "cache"],
      linux: [".local", "share", "unity3d"]
    },
    discoverChildren: {
      description: {
        en: "Unity cache/data subfolder. Usually regenerable; check contents if unsure.",
        ru: "Подпапка кэша/данных Unity. Обычно восстанавливаемая; при сомнении загляните внутрь."
      }
    }
  },
  {
    id: "unreal",
    category: "gamedev",
    label: "Unreal Engine",
    description: {
      en: "Unreal Engine Derived Data Cache (shared). Rebuilds refill it.",
      ru: "Derived Data Cache Unreal Engine (общий). Пересборки заполнят его снова."
    },
    paths: {
      win32: ["AppData", "Local", "UnrealEngine", "Common", "DerivedDataCache"],
      darwin: ["Library", "Application Support", "Epic", "UnrealEngine", "Common", "DerivedDataCache"],
      linux: [".config", "Epic", "UnrealEngine", "Common", "DerivedDataCache"]
    }
  },
  {
    id: "composer",
    category: "php",
    label: "Composer",
    description: {
      en: "PHP Composer package cache. vendor/ in projects is separate.",
      ru: "Кэш пакетов PHP Composer. vendor/ в проектах — отдельно."
    },
    paths: {
      win32: ["AppData", "Local", "Composer", "Cache"],
      darwin: [".composer", "cache"],
      linux: [".cache", "composer"]
    },
    parts: [
      {
        id: "files",
        label: "files",
        description: {
          en: "Cached package archives. Safe to clear.",
          ru: "Кэш архивов пакетов. Безопасно очищать."
        },
        relative: sameRelative(["files"])
      },
      {
        id: "repo",
        label: "repo",
        description: {
          en: "Composer repository metadata cache. Safe to clear.",
          ru: "Кэш метаданных репозиториев Composer. Безопасно очищать."
        },
        relative: sameRelative(["repo"])
      }
    ]
  },
  {
    id: "jetbrains",
    category: "ide",
    label: "JetBrains",
    description: {
      en: "UNSAFE / CAUTION: JetBrains Local dirs. Prefer Invalidate Caches in the IDE. Toolbox/plugins are especially sensitive.",
      ru: "НЕБЕЗОПАСНО / ОСТОРОЖНО: каталоги JetBrains в Local. Лучше Invalidate Caches в IDE. Toolbox/plugins особенно чувствительны."
    },
    paths: {
      win32: ["AppData", "Local", "JetBrains"],
      darwin: ["Library", "Caches", "JetBrains"],
      linux: [".cache", "JetBrains"]
    },
    parts: [
      {
        id: "plugins",
        label: "plugins",
        description: {
          en: "UNSAFE: Local plugins folder. Installed plugins may be removed.",
          ru: "НЕБЕЗОПАСНО: локальные плагины. Установленные плагины могут пропасть."
        },
        relative: rel(["plugins"], null, null)
      },
      {
        id: "toolbox",
        label: "Toolbox",
        description: {
          en: "UNSAFE: JetBrains Toolbox app data/installs under Local.",
          ru: "НЕБЕЗОПАСНО: данные/установки JetBrains Toolbox в Local."
        },
        relative: rel(["Toolbox"], null, null)
      },
      {
        id: "transient",
        label: "Transient",
        description: {
          en: "Transient/scratch JetBrains data. Usually safer than product folders.",
          ru: "Временные данные JetBrains. Обычно безопаснее, чем каталоги продуктов."
        },
        relative: rel(["Transient"], null, null)
      }
    ],
    discoverChildren: {
      exclude: ["plugins", "Toolbox", "Toolbox-Dev", "Transient", "~"],
      description: {
        en: "CAUTION: IDE product/system folder (caches, indexes, Local History). Prefer Invalidate Caches in the IDE.",
        ru: "ОСТОРОЖНО: каталог продукта/системы IDE (кэши, индексы, Local History). Лучше Invalidate Caches в IDE."
      }
    }
  },
  {
    id: "vscode",
    category: "ide",
    label: "VS Code",
    description: {
      en: "VS Code CachedData (Electron/Chromium). Extensions and settings are not here.",
      ru: "CachedData VS Code (Electron/Chromium). Расширения и настройки здесь не хранятся."
    },
    paths: {
      win32: ["AppData", "Roaming", "Code", "CachedData"],
      darwin: ["Library", "Application Support", "Code", "CachedData"],
      linux: [".config", "Code", "CachedData"]
    },
    discoverChildren: {
      description: {
        en: "One CachedData version folder. Safe; VS Code recreates it.",
        ru: "Одна версия CachedData. Безопасно; VS Code создаст снова."
      }
    }
  },
  {
    id: "cursor",
    category: "ide",
    label: "Cursor",
    description: {
      en: "Cursor CachedData. Does not remove settings or extensions.",
      ru: "CachedData Cursor. Настройки и расширения не удаляет."
    },
    paths: {
      win32: ["AppData", "Roaming", "Cursor", "CachedData"],
      darwin: ["Library", "Application Support", "Cursor", "CachedData"],
      linux: [".config", "Cursor", "CachedData"]
    },
    discoverChildren: {
      description: {
        en: "One CachedData version folder. Safe; Cursor recreates it.",
        ru: "Одна версия CachedData. Безопасно; Cursor создаст снова."
      }
    }
  },
  {
    id: "uv",
    category: "python",
    label: "uv",
    description: {
      en: "uv package cache. Safe; packages re-download on next sync.",
      ru: "Кэш пакетов uv. Безопасно; пакеты скачаются при следующем sync."
    },
    paths: {
      win32: ["AppData", "Local", "uv", "cache"],
      darwin: [".cache", "uv"],
      linux: [".cache", "uv"]
    }
  },
  {
    id: "pixi",
    category: "python",
    label: "Pixi",
    description: {
      en: "Pixi/rattler package cache. Environments may need re-resolve after delete.",
      ru: "Кэш пакетов Pixi/rattler. После удаления окружения могут потребовать re-resolve."
    },
    paths: {
      win32: ["AppData", "Local", "pixi", "cache"],
      darwin: [".cache", "rattler"],
      linux: [".cache", "rattler"]
    }
  },
  {
    id: "playwright",
    category: "javascript",
    label: "Playwright",
    description: {
      en: "Playwright browser downloads. Re-run npx playwright install after delete.",
      ru: "Скачанные браузеры Playwright. После удаления: npx playwright install."
    },
    paths: {
      win32: ["AppData", "Local", "ms-playwright"],
      darwin: ["Library", "Caches", "ms-playwright"],
      linux: [".cache", "ms-playwright"]
    }
  },
  {
    id: "cypress",
    category: "javascript",
    label: "Cypress",
    description: {
      en: "Cypress binary cache. Cypress re-downloads the binary on next run.",
      ru: "Кэш бинарников Cypress. При следующем запуске скачает снова."
    },
    paths: {
      win32: ["AppData", "Local", "Cypress", "Cache"],
      darwin: ["Library", "Caches", "Cypress"],
      linux: [".cache", "Cypress"]
    }
  },
  {
    id: "electron",
    category: "javascript",
    label: "Electron",
    description: {
      en: "electron-download cache of Electron binaries.",
      ru: "Кэш бинарников Electron (electron-download)."
    },
    paths: {
      win32: ["AppData", "Local", "electron", "Cache"],
      darwin: ["Library", "Caches", "electron"],
      linux: [".cache", "electron"]
    }
  },
  {
    id: "puppeteer",
    category: "javascript",
    label: "Puppeteer",
    description: {
      en: "Puppeteer Chrome-for-Testing cache.",
      ru: "Кэш Chrome-for-Testing для Puppeteer."
    },
    paths: {
      win32: ["AppData", "Local", "puppeteer"],
      darwin: [".cache", "puppeteer"],
      linux: [".cache", "puppeteer"]
    }
  },
  {
    id: "conan",
    category: "systems",
    label: "Conan",
    description: {
      en: "Conan package cache (.conan2/p). Safe; packages re-download.",
      ru: "Кэш пакетов Conan (.conan2/p). Безопасно; пакеты скачаются снова."
    },
    paths: {
      win32: [".conan2"],
      darwin: [".conan2"],
      linux: [".conan2"]
    },
    parts: [
      {
        id: "p",
        label: "p",
        description: {
          en: "Conan 2 package cache.",
          ru: "Кэш пакетов Conan 2."
        },
        relative: sameRelative(["p"])
      }
    ]
  },
  {
    id: "vcpkg",
    category: "systems",
    label: "vcpkg",
    description: {
      en: "Default vcpkg downloads/buildtrees under the user vcpkg tree when present.",
      ru: "downloads/buildtrees пользовательского vcpkg, если каталог есть."
    },
    paths: {
      win32: ["vcpkg"],
      darwin: ["vcpkg"],
      linux: ["vcpkg"]
    },
    parts: [
      {
        id: "downloads",
        label: "downloads",
        description: {
          en: "vcpkg source downloads cache.",
          ru: "Кэш загрузок исходников vcpkg."
        },
        relative: sameRelative(["downloads"])
      },
      {
        id: "buildtrees",
        label: "buildtrees",
        description: {
          en: "vcpkg buildtrees. Safe; rebuilds on next install.",
          ru: "buildtrees vcpkg. Безопасно; пересоберётся при установке."
        },
        relative: sameRelative(["buildtrees"])
      }
    ]
  },
  {
    id: "hex",
    category: "systems",
    label: "Hex (Elixir)",
    description: {
      en: "Hex package cache for Elixir/Erlang.",
      ru: "Кэш пакетов Hex для Elixir/Erlang."
    },
    paths: {
      win32: [".hex", "packages"],
      darwin: [".hex", "packages"],
      linux: [".hex", "packages"]
    }
  },
  {
    id: "stack",
    category: "systems",
    label: "Stack (Haskell)",
    description: {
      en: "Stack program/cache directories. Snapshots re-download as needed.",
      ru: "Кэш Stack. Снапшоты скачаются при необходимости."
    },
    paths: {
      win32: ["AppData", "Roaming", "stack"],
      darwin: [".stack"],
      linux: [".stack"]
    },
    parts: [
      {
        id: "snapshots",
        label: "snapshots",
        description: {
          en: "Stack snapshots cache.",
          ru: "Кэш snapshots Stack."
        },
        relative: sameRelative(["snapshots"])
      },
      {
        id: "programs",
        label: "programs",
        description: {
          en: "Stack installed GHC programs cache.",
          ru: "Кэш установленных GHC/программ Stack."
        },
        relative: sameRelative(["programs"])
      }
    ]
  },
  {
    id: "chocolatey",
    category: "pkgmanagers",
    label: "Chocolatey",
    description: {
      en: "Chocolatey lib/cache under ProgramData when present. CAUTION: may need admin to delete.",
      ru: "lib/cache Chocolatey в ProgramData. ОСТОРОЖНО: для удаления могут нужны права админа."
    },
    paths: {
      win32: ["AppData", "Local", "Temp", "chocolatey"],
      darwin: null,
      linux: null
    }
  },
  {
    id: "winget",
    category: "pkgmanagers",
    label: "winget",
    description: {
      en: "winget package installer cache under LocalState.",
      ru: "Кэш установщиков winget в LocalState."
    },
    paths: {
      win32: [
        "AppData",
        "Local",
        "Packages",
        "Microsoft.DesktopAppInstaller_8wekyb3d8bbwe",
        "LocalState",
        "DiagOutputDir"
      ],
      darwin: null,
      linux: null
    }
  },
  {
    id: "winget-packages",
    category: "pkgmanagers",
    label: "winget packages",
    description: {
      en: "Downloaded winget package payloads cache.",
      ru: "Кэш скачанных пакетов winget."
    },
    paths: {
      win32: [
        "AppData",
        "Local",
        "Temp",
        "WinGet"
      ],
      darwin: null,
      linux: null
    }
  },
  {
    id: "scoop",
    category: "pkgmanagers",
    label: "Scoop",
    description: {
      en: "Scoop cache of downloaded installers. Apps in ~/scoop/apps are not listed.",
      ru: "Кэш установщиков Scoop. Приложения в ~/scoop/apps не перечисляются."
    },
    paths: {
      win32: ["scoop", "cache"],
      darwin: null,
      linux: null
    }
  }
];

function pickLocale(text: LocalizedText, locale: ToolCacheLocale): string {
  return locale === "ru" ? text.ru : text.en;
}

function platformParts(paths: PlatformPaths, platform: NodeJS.Platform): PathParts {
  if (platform === "win32") return paths.win32;
  if (platform === "darwin") return paths.darwin;
  return paths.linux;
}

function rootPath(
  def: ToolCacheDefinition,
  home: string,
  platform: NodeJS.Platform
): string | null {
  const parts = platformParts(def.paths, platform);
  if (!parts) return null;
  return path.join(home, ...parts);
}

function partPath(
  root: string,
  part: ToolCachePartDefinition,
  platform: NodeJS.Platform
): string | null {
  const relative = platformParts(part.relative, platform);
  if (relative === null) return null;
  return relative.length === 0 ? root : path.join(root, ...relative);
}

function leafFromPart(
  def: ToolCacheDefinition,
  part: ToolCachePartDefinition,
  home: string,
  platform: NodeJS.Platform
): ToolCacheLocation | null {
  const root = rootPath(def, home, platform);
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
  def: ToolCacheDefinition,
  home: string,
  platform: NodeJS.Platform
): ToolCacheLocation | null {
  const resolved = rootPath(def, home, platform);
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

export async function toolCacheCandidates(
  home: string,
  platform: NodeJS.Platform,
  fsOps?: Pick<ToolCacheFsOps, "readdir">
): Promise<ToolCacheLocation[]> {
  const result: ToolCacheLocation[] = [];

  for (const def of TOOL_CACHE_DEFINITIONS) {
    const root = rootPath(def, home, platform);
    if (!root) continue;

    const explicit = def.parts ?? [];
    for (const part of explicit) {
      const leaf = leafFromPart(def, part, home, platform);
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
      for (const name of names) {
        if (exclude.has(name.toLowerCase())) continue;
        if (explicitIds.has(name)) continue;
        if (prefix && !name.toLowerCase().startsWith(prefix)) continue;
        if (name === "." || name === "..") continue;
        result.push({
          id: `${def.id}/${name}`,
          parentId: def.id,
          parentLabel: def.label,
          parentPath: root,
          label: name,
          path: path.join(root, name),
          category: def.category
        });
      }
    } else if (explicit.length === 0 && !def.discoverChildren) {
      const leaf = singleLeaf(def, home, platform);
      if (leaf) result.push(leaf);
    } else if (
      explicit.length === 0 &&
      def.discoverChildren &&
      !fsOps?.readdir &&
      !def.discoverChildren.namePrefix
    ) {
      // Full-root discover tools (e.g. CachedData) can fall back to the root leaf.
      // Prefixed discover (AndroidStudio*) must not expose the parent Google folder.
      const leaf = singleLeaf(def, home, platform);
      if (leaf) result.push(leaf);
    }
  }

  return result;
}

function descriptionForLeaf(item: ToolCacheLocation, locale: ToolCacheLocale): {
  description: string;
  parentDescription: string;
} {
  const def = TOOL_CACHE_DEFINITIONS.find(entry => entry.id === item.parentId);
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

export function presentToolCaches(
  items: ToolCacheFound[],
  locale: ToolCacheLocale = "en"
): ToolCacheScanItem[] {
  return items.map(item => {
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
}

export function toolCacheCatalog(
  home: string,
  platform: NodeJS.Platform,
  locale: ToolCacheLocale = "en"
): ToolCacheCatalogCategory[] {
  const byCategory = new Map<ToolCacheCategoryId, ToolCacheCatalogItem[]>();

  for (const def of TOOL_CACHE_DEFINITIONS) {
    const root = rootPath(def, home, platform);
    if (!root) continue;
    const parts: ToolCacheCatalogPart[] = [];
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

export interface ToolCacheScanProgress {
  checked: number;
  total: number;
  path: string;
}

export async function collectExistingToolCaches(
  home: string,
  platform: NodeJS.Platform,
  fsOps: ToolCacheFsOps,
  onProgress?: (update: ToolCacheScanProgress, found?: ToolCacheFound) => void | Promise<void>
): Promise<ToolCacheFound[]> {
  const candidates = await toolCacheCandidates(home, platform, fsOps);
  const found: ToolCacheFound[] = [];
  const total = candidates.length;

  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    let hit: ToolCacheFound | undefined;

    let stats: ToolCacheStat;
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
