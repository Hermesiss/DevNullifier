import path from "path";
import { describe, expect, it, vi } from "vitest";
import {
  collectExistingToolCaches,
  toolCacheCandidates,
  toolCacheCatalog
} from "../globalToolCaches";

const home = path.join("Users", "dev");

async function candidate(platform: NodeJS.Platform, id: string): Promise<string> {
  const match = (await toolCacheCandidates(home, platform)).find(item => item.id === id);
  if (!match) throw new Error(`missing candidate ${id}`);
  return match.path;
}

describe("toolCacheCandidates", () => {
  it("exposes npm parts and platform-specific docker parts", async () => {
    const win = await toolCacheCandidates(home, "win32");
    const linux = await toolCacheCandidates(home, "linux");
    const mac = await toolCacheCandidates(home, "darwin");

    expect(win.map(item => item.id)).toContain("npm/cacache");
    expect(win.map(item => item.id)).toContain("docker-desktop/wsl");
    expect(win.map(item => item.id)).toContain("docker-desktop/log");
    expect(linux.map(item => item.id)).not.toContain("docker-desktop/wsl");
    expect(mac.map(item => item.id)).toContain("docker-desktop/vms");
    expect(mac.map(item => item.id)).toContain("cocoapods");
    expect(win.map(item => item.id)).toContain("android/avd");
    expect(win.map(item => item.id)).toContain("cargo/bin");
    expect(win.map(item => item.id)).toContain("gradle/caches");
    expect(win.map(item => item.id)).toContain("uv");
    expect(win.map(item => item.id)).toContain("playwright");
    expect(win.map(item => item.id)).toContain("scoop");
    expect(win.map(item => item.id)).toContain("conan/p");

    expect(await candidate("win32", "npm/cacache")).toBe(
      path.join(home, "AppData", "Local", "npm-cache", "_cacache")
    );
    expect(await candidate("linux", "npm/cacache")).toBe(path.join(home, ".npm", "_cacache"));
    expect(await candidate("win32", "docker-desktop/wsl")).toBe(
      path.join(home, "AppData", "Local", "Docker", "wsl")
    );
    expect(await candidate("darwin", "docker-desktop/vms")).toBe(
      path.join(home, "Library", "Containers", "com.docker.docker", "Data", "vms")
    );
  });

  it("discovers versioned children when readdir is provided", async () => {
    const readdir = vi.fn(async (dir: string) => {
      if (dir.endsWith(path.join("AppData", "Local", "Google"))) {
        return ["AndroidStudio2024.1", "Chrome"];
      }
      if (dir.endsWith(path.join("AppData", "Local", "JetBrains"))) {
        return ["WebStorm2026.2", "plugins", "Toolbox", "Transient"];
      }
      return [];
    });

    const win = await toolCacheCandidates(home, "win32", { readdir });
    const ids = win.map(item => item.id);

    expect(ids).toContain("android-studio/AndroidStudio2024.1");
    expect(ids).not.toContain("android-studio/Chrome");
    expect(ids).toContain("jetbrains/WebStorm2026.2");
    expect(ids).toContain("jetbrains/plugins");
    expect(ids).toContain("jetbrains/toolbox");
    expect(ids.filter(id => id === "jetbrains/plugins")).toHaveLength(1);
  });
});

describe("toolCacheCatalog", () => {
  it("lists static parts under tools", () => {
    const catalog = toolCacheCatalog(home, "win32", "ru");
    const containers = catalog.find(category => category.id === "containers");
    const docker = containers?.items.find(item => item.id === "docker-desktop");
    expect(docker?.parts.map(part => part.id)).toEqual(
      expect.arrayContaining(["docker-desktop/log", "docker-desktop/wsl"])
    );
    expect(docker?.parts.find(part => part.id === "docker-desktop/wsl")?.description).toMatch(/НЕБЕЗОПАСНО/i);
  });
});

function statOf(kind: "dir" | "file" | "link", size = 0) {
  return {
    isSymbolicLink: () => kind === "link",
    isDirectory: () => kind === "dir",
    isFile: () => kind === "file",
    size
  };
}

describe("collectExistingToolCaches", () => {
  it("omits a missing path", async () => {
    const stat = vi.fn(async (_target: string) => {
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    });
    const getDirSize = vi.fn(async () => 99);
    const candidates = await toolCacheCandidates(home, "linux");

    const result = await collectExistingToolCaches(home, "linux", { stat, getDirSize });

    expect(result).toEqual([]);
    expect(stat).toHaveBeenCalledTimes(candidates.length);
    expect(getDirSize).not.toHaveBeenCalled();
  });

  it("includes an existing part directory with the injected size", async () => {
    const pnpmRoot = path.join(home, "AppData", "Local", "pnpm", "store");
    const pnpmV3 = path.join(pnpmRoot, "v3");
    const readdir = vi.fn(async (dir: string) => (dir === pnpmRoot ? ["v3"] : []));
    const stat = vi.fn(async (target: string) => {
      if (target === pnpmV3) return statOf("dir");
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    });
    const getDirSize = vi.fn(async () => 4096);

    const result = await collectExistingToolCaches(home, "win32", { stat, getDirSize, readdir });

    expect(result).toEqual([
      {
        id: "pnpm/v3",
        parentId: "pnpm",
        parentLabel: "pnpm",
        parentPath: pnpmRoot,
        label: "v3",
        path: pnpmV3,
        size: 4096,
        category: "javascript"
      }
    ]);
    expect(getDirSize).toHaveBeenCalledWith(pnpmV3);
  });

  it("reports progress for every candidate and found hits", async () => {
    const yarn = await candidate("linux", "yarn");
    const total = (await toolCacheCandidates(home, "linux")).length;
    const stat = vi.fn(async (target: string) => {
      if (target === yarn) return statOf("dir");
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    });
    const getDirSize = vi.fn(async () => 2048);
    const onProgress = vi.fn();

    const result = await collectExistingToolCaches(home, "linux", { stat, getDirSize }, onProgress);

    expect(result).toHaveLength(1);
    expect(onProgress).toHaveBeenCalledTimes(total);
    expect(onProgress.mock.calls[0][0]).toMatchObject({ checked: 1, total });
    expect(onProgress.mock.calls[total - 1][0]).toMatchObject({ checked: total, total });
    const foundCall = onProgress.mock.calls.find(call => call[1]?.id === "yarn");
    expect(foundCall?.[1]).toMatchObject({ id: "yarn", size: 2048 });
  });
});
