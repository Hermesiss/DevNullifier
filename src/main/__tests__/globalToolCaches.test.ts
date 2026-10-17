import path from "path";
import { describe, expect, it, vi } from "vitest";
import { collectExistingToolCaches, toolCacheCandidates } from "../globalToolCaches";

const home = path.join("Users", "dev");

function candidate(platform: NodeJS.Platform, id: string): string {
  const match = toolCacheCandidates(home, platform).find(item => item.id === id);
  if (!match) throw new Error(`missing candidate ${id}`);
  return match.path;
}

describe("toolCacheCandidates", () => {
  it("uses different yarn, pnpm, and unity paths on win32 than on linux", () => {
    const win = toolCacheCandidates(home, "win32");
    const linux = toolCacheCandidates(home, "linux");
    const mac = toolCacheCandidates(home, "darwin");

    expect(win.map(item => item.id)).toEqual([
      "npm",
      "yarn",
      "pnpm",
      "nuget",
      "gradle",
      "pip",
      "cargo",
      "huggingface",
      "unity"
    ]);
    expect(linux.map(item => item.id)).toEqual(win.map(item => item.id));

    expect(candidate("win32", "yarn")).toBe(path.join(home, "AppData", "Local", "Yarn", "Cache"));
    expect(candidate("linux", "yarn")).toBe(path.join(home, ".cache", "yarn"));
    expect(candidate("darwin", "yarn")).toBe(candidate("linux", "yarn"));

    expect(candidate("win32", "pnpm")).toBe(path.join(home, "AppData", "Local", "pnpm", "store"));
    expect(candidate("linux", "pnpm")).toBe(path.join(home, ".local", "share", "pnpm", "store"));
    expect(candidate("darwin", "pnpm")).toBe(candidate("linux", "pnpm"));

    expect(candidate("win32", "unity")).toBe(path.join(home, "AppData", "Local", "Unity", "cache"));
    expect(candidate("linux", "unity")).toBe(path.join(home, ".local", "share", "unity3d"));
    expect(candidate("darwin", "unity")).toBe(path.join(home, "Library", "Unity", "cache"));

    expect(candidate("win32", "npm")).toBe(path.join(home, ".npm"));
    expect(candidate("linux", "nuget")).toBe(path.join(home, ".nuget", "packages"));
    expect(candidate("win32", "gradle")).toBe(path.join(home, ".gradle", "caches"));
    expect(candidate("linux", "pip")).toBe(path.join(home, ".cache", "pip"));
    expect(candidate("win32", "cargo")).toBe(path.join(home, ".cargo", "registry"));
    expect(candidate("linux", "huggingface")).toBe(path.join(home, ".cache", "huggingface"));

    for (const id of ["npm", "nuget", "gradle", "pip", "cargo", "huggingface"]) {
      expect(candidate("win32", id)).toBe(candidate("linux", id));
    }

    expect(win.map(item => item.path)).not.toContain(home);
    expect(linux.map(item => item.path)).not.toContain(home);
    expect(mac.map(item => item.path)).not.toContain(home);
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

    const result = await collectExistingToolCaches(home, "linux", { stat, getDirSize });

    expect(result).toEqual([]);
    expect(stat).toHaveBeenCalledTimes(toolCacheCandidates(home, "linux").length);
    expect(stat.mock.calls.map(call => call[0])).not.toContain(home);
    expect(getDirSize).not.toHaveBeenCalled();
  });

  it("omits a symlink", async () => {
    const yarn = candidate("linux", "yarn");
    const stat = vi.fn(async (target: string) => {
      if (target === yarn) return statOf("link");
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    });
    const getDirSize = vi.fn(async () => 99);

    const result = await collectExistingToolCaches(home, "linux", { stat, getDirSize });

    expect(result).toEqual([]);
    expect(getDirSize).not.toHaveBeenCalled();
  });

  it("includes an existing directory with the injected size", async () => {
    const pnpm = candidate("win32", "pnpm");
    const stat = vi.fn(async (target: string) => {
      if (target === pnpm) return statOf("dir");
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    });
    const getDirSize = vi.fn(async () => 4096);

    const result = await collectExistingToolCaches(home, "win32", { stat, getDirSize });

    expect(result).toEqual([
      {
        id: "pnpm",
        label: "pnpm",
        path: pnpm,
        size: 4096
      }
    ]);
    expect(getDirSize).toHaveBeenCalledTimes(1);
    expect(getDirSize).toHaveBeenCalledWith(pnpm);
  });

  it("uses stat.size for an existing file", async () => {
    const pip = candidate("linux", "pip");
    const stat = vi.fn(async (target: string) => {
      if (target === pip) return statOf("file", 12);
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    });
    const getDirSize = vi.fn(async () => 99);

    const result = await collectExistingToolCaches(home, "linux", { stat, getDirSize });

    expect(result).toEqual([
      {
        id: "pip",
        label: "pip",
        path: pip,
        size: 12
      }
    ]);
    expect(getDirSize).not.toHaveBeenCalled();
  });
});
