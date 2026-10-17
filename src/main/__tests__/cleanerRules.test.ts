import { promises as fs } from "fs";
import path from "path";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { setUserDataPath } from "../fileUtils";
import { loadCleanerRules, saveCleanerRules, permanentRemove } from "../cleanerRules";

vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rm: vi.fn()
  }
}));

const defaults = {
  permanentDelete: false,
  protectedPaths: [] as string[],
  excludeGlobs: [] as string[],
  minAgeDays: null,
  minSizeMb: null
};

describe("cleanerRules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUserDataPath("/user/data");
  });

  it("returns defaults when the rules file is missing", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

    await expect(loadCleanerRules()).resolves.toEqual(defaults);
  });

  it("round-trips save and load including permanentDelete true", async () => {
    let stored: string | undefined;
    vi.mocked(fs.readFile).mockImplementation(async () => {
      if (stored === undefined) {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      }
      return stored;
    });
    vi.mocked(fs.writeFile).mockImplementation(async (_file, data) => {
      stored = String(data);
    });

    const saved = await saveCleanerRules({
      permanentDelete: true,
      protectedPaths: ["D:/keep"],
      excludeGlobs: ["**/.git/**"],
      minAgeDays: 7,
      minSizeMb: 2
    });

    expect(saved).toEqual({
      permanentDelete: true,
      protectedPaths: ["D:/keep"],
      excludeGlobs: ["**/.git/**"],
      minAgeDays: 7,
      minSizeMb: 2
    });

    const loaded = await loadCleanerRules();
    expect(loaded).toEqual(saved);

    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    const [filePath, contents, encoding] = vi.mocked(fs.writeFile).mock.calls[0];
    expect(String(filePath)).toContain("cleaner-rules.json");
    expect(encoding).toBe("utf-8");
    expect(contents).toBe(JSON.stringify(saved, null, 2));
  });

  it("keeps other fields and drops a duplicate or drive root from protected paths", async () => {
    let stored: string | undefined;
    vi.mocked(fs.readFile).mockImplementation(async () => {
      if (stored === undefined) {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      }
      return stored;
    });
    vi.mocked(fs.writeFile).mockImplementation(async (_file, data) => {
      stored = String(data);
    });

    await saveCleanerRules({ permanentDelete: true, excludeGlobs: ["**/.git/**"] });
    const keep = path.join("/data", "keep");
    const saved = await saveCleanerRules({
      protectedPaths: [keep, `${keep}${path.sep}`, path.parse(keep).root]
    });

    expect(saved.permanentDelete).toBe(true);
    expect(saved.excludeGlobs).toEqual(["**/.git/**"]);
    expect(saved.protectedPaths).toEqual([keep]);
    expect(saved.minAgeDays).toBeNull();
    expect(saved.minSizeMb).toBeNull();
  });

  it("falls back to defaults when the rules file is corrupt", async () => {
    vi.mocked(fs.readFile).mockResolvedValue("{not json");

    await expect(loadCleanerRules()).resolves.toEqual(defaults);
  });

  it("permanentRemove calls fs.rm with recursive true and does not set force", async () => {
    vi.mocked(fs.rm).mockResolvedValue(undefined);

    await permanentRemove("/path/to/cache");

    expect(fs.rm).toHaveBeenCalledTimes(1);
    expect(fs.rm).toHaveBeenCalledWith("/path/to/cache", { recursive: true });
    const options = vi.mocked(fs.rm).mock.calls[0][1] as { recursive?: boolean; force?: boolean };
    expect(options).toEqual({ recursive: true });
    expect(options.force).toBeUndefined();
  });
});
