import path from "path";
import { describe, expect, it, vi } from "vitest";
import {
  collapseAggregatedSystemCaches,
  collectExistingSystemCaches,
  presentSystemCaches,
  systemCacheCandidates,
  systemCacheCatalog
} from "../systemAppCaches";

const home = path.join("Users", "dev");
const tmpdir = path.join(home, "AppData", "Local", "Temp");

async function candidate(platform: NodeJS.Platform, id: string): Promise<string> {
  const match = (
    await systemCacheCandidates(home, platform, undefined, { tmpdir })
  ).find(item => item.id === id);
  if (!match) throw new Error(`missing candidate ${id}`);
  return match.path;
}

describe("systemCacheCandidates", () => {
  it("lists chromium default cache parts and firefox profiles root", async () => {
    const win = await systemCacheCandidates(home, "win32", undefined, { tmpdir });
    const ids = win.map(item => item.id);

    expect(ids).toContain("chrome/cache");
    expect(ids).toContain("edge/code-cache");
    expect(ids).toContain("brave/gpu-cache");
    expect(ids).toContain("opera/cache");
    expect(ids).not.toContain("user-temp");

    expect(await candidate("win32", "chrome/cache")).toBe(
      path.join(home, "AppData", "Local", "Google", "Chrome", "User Data", "Default", "Cache")
    );
    expect(await candidate("linux", "chrome/cache")).toBe(
      path.join(home, ".config", "google-chrome", "Default", "Cache")
    );
  });

  it("discovers TEMP children and firefox cache2 without exposing TEMP root", async () => {
    const readdir = vi.fn(async (dir: string) => {
      if (dir === tmpdir) return ["foo.tmp", "locked-dir"];
      if (dir.endsWith(path.join("Mozilla", "Firefox", "Profiles"))) {
        return ["abcd.default-release", "xyz.dev-edition"];
      }
      return [];
    });

    const win = await systemCacheCandidates(home, "win32", { readdir }, { tmpdir });
    const ids = win.map(item => item.id);

    expect(ids).toContain("user-temp/foo.tmp");
    expect(ids).toContain("user-temp/locked-dir");
    expect(ids).not.toContain("user-temp");
    expect(ids).toContain("firefox/abcd.default-release");
    expect(
      win.find(item => item.id === "firefox/abcd.default-release")?.path
    ).toBe(
      path.join(
        home,
        "AppData",
        "Local",
        "Mozilla",
        "Firefox",
        "Profiles",
        "abcd.default-release",
        "cache2"
      )
    );
  });

  it("does not fall back to TEMP root when readdir is missing", async () => {
    const win = await systemCacheCandidates(home, "win32", undefined, { tmpdir });
    expect(win.map(item => item.id)).not.toContain("user-temp");
    expect(win.every(item => !item.id.startsWith("user-temp"))).toBe(true);
  });
});

describe("systemCacheCatalog", () => {
  it("includes temp, browsers, messengers, shaders, creative, launchers", () => {
    const steam = path.join("C:", "Steam");
    const catalog = systemCacheCatalog(home, "win32", "ru", {
      tmpdir,
      extraRoots: { steam },
      localAppData: path.join(home, "AppData", "Local"),
      roamingAppData: path.join(home, "AppData", "Roaming")
    });
    expect(catalog.map(category => category.id)).toEqual(
      expect.arrayContaining([
        "temp",
        "browsers",
        "messengers",
        "shaders",
        "creative",
        "launchers"
      ])
    );
    const browsers = catalog.find(category => category.id === "browsers");
    const chrome = browsers?.items.find(item => item.id === "chrome");
    expect(chrome?.parts.map(part => part.id)).toEqual(
      expect.arrayContaining(["chrome/cache", "chrome/code-cache", "chrome/gpu-cache"])
    );
    expect(chrome?.description).toMatch(/Default/i);
    const messengers = catalog.find(category => category.id === "messengers");
    expect(messengers?.items.map(item => item.id)).toEqual(
      expect.arrayContaining(["discord", "telegram", "spotify"])
    );
  });
});

describe("extra steam roots", () => {
  it("resolves steam shadercache under the injected install path", async () => {
    const steam = path.join("C:", "Games", "Steam");
    const match = (
      await systemCacheCandidates(home, "win32", undefined, {
        tmpdir,
        extraRoots: { steam }
      })
    ).find(item => item.id === "steam-download-cache");
    expect(match?.path).toBe(path.join(steam, "steamapps", "downloading"));
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

describe("collapseAggregatedSystemCaches", () => {
  it("collapses user-temp children into one aggregated row", () => {
    const presented = presentSystemCaches(
      [
        {
          id: "user-temp/a",
          parentId: "user-temp",
          parentLabel: "User TEMP",
          parentPath: tmpdir,
          label: "a",
          path: `${tmpdir}\\a`,
          category: "temp",
          size: 10
        },
        {
          id: "user-temp/b",
          parentId: "user-temp",
          parentLabel: "User TEMP",
          parentPath: tmpdir,
          label: "b",
          path: `${tmpdir}\\b`,
          category: "temp",
          size: 30
        },
        {
          id: "chrome/cache",
          parentId: "chrome",
          parentLabel: "Google Chrome",
          parentPath: path.join(home, "AppData", "Local", "Google", "Chrome", "User Data", "Default"),
          label: "Cache",
          path: path.join(
            home,
            "AppData",
            "Local",
            "Google",
            "Chrome",
            "User Data",
            "Default",
            "Cache"
          ),
          category: "browsers",
          size: 5
        }
      ],
      "en"
    );

    const temp = presented.find(item => item.id === "user-temp");
    expect(temp?.aggregated).toBe(true);
    expect(temp?.children?.map(child => child.label)).toEqual(["b", "a"]);
    expect(temp?.size).toBe(40);
    expect(presented.filter(item => item.parentId === "user-temp" && !item.aggregated)).toHaveLength(0);
    expect(presented.some(item => item.id === "chrome/cache")).toBe(true);
    expect(collapseAggregatedSystemCaches(presented).find(item => item.id === "user-temp")?.aggregated).toBe(
      true
    );
  });
});

describe("collectExistingSystemCaches", () => {
  it("includes an existing chrome cache directory", async () => {
    const cachePath = path.join(
      home,
      "AppData",
      "Local",
      "Google",
      "Chrome",
      "User Data",
      "Default",
      "Cache"
    );
    const stat = vi.fn(async (target: string) => {
      if (target === cachePath) return statOf("dir");
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    });
    const getDirSize = vi.fn(async () => 2048);

    const result = await collectExistingSystemCaches(
      home,
      "win32",
      { stat, getDirSize },
      undefined,
      { tmpdir }
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: "chrome/cache",
        path: cachePath,
        size: 2048
      })
    ]);
  });
});
