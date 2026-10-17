import { promises as fs } from "fs";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { KEYWORDS } from "../appDataCleaner";
import { setUserDataPath } from "../fileUtils";
import {
  builtinCategoryIds,
  loadCustomScanRules,
  mergeKeywords,
  saveCustomScanRules
} from "../customScanRules";

vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn()
  }
}));

let stored: string | undefined;

describe("customScanRules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUserDataPath("/user/data");
    stored = undefined;
    vi.mocked(fs.readFile).mockImplementation(async () => {
      if (stored === undefined) {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      }
      return stored;
    });
    vi.mocked(fs.writeFile).mockImplementation(async (_file, data) => {
      stored = String(data);
    });
  });

  afterEach(() => {
    builtinCategoryIds.delete("custom-tools");
  });

  it("returns defaults when the rules file is missing", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

    await expect(loadCustomScanRules()).resolves.toEqual({ categories: [], keywords: [] });
  });

  it("returns defaults when the rules file is corrupt", async () => {
    vi.mocked(fs.readFile).mockResolvedValue("{not json");

    await expect(loadCustomScanRules()).resolves.toEqual({ categories: [], keywords: [] });
  });

  it("keyword merge drops blanks and built-in duplicates, keeps order built-ins then custom", async () => {
    expect(
      mergeKeywords(["cache", "temp", "pending"], ["", "  ", "Cache", "logs", "LOGS", "pending"])
    ).toEqual(["cache", "temp", "pending", "logs"]);

    const saved = await saveCustomScanRules({
      keywords: ["", "  ", "Cache", "logs", "LOGS", "pending"]
    });

    expect(saved.keywords).toEqual(["logs"]);
    expect(mergeKeywords(KEYWORDS, saved.keywords)).toEqual([...KEYWORDS, "logs"]);

    const [filePath] = vi.mocked(fs.writeFile).mock.calls[0];
    expect(String(filePath)).toContain("custom-scan-rules.json");
  });

  it("drops a category without a cache pattern and keeps the other field", async () => {
    await saveCustomScanRules({ keywords: ["shader-cache"] });

    const saved = await saveCustomScanRules({
      categories: [
        { name: "Broken", detectionFiles: ["marker.txt"], cachePatterns: ["   "] },
        { name: "Kept", detectionFiles: [" marker.txt "], cachePatterns: [" .cache/ "] }
      ]
    });

    expect(saved.keywords).toEqual(["shader-cache"]);
    expect(saved.categories).toEqual([
      {
        id: "custom-kept",
        name: "Kept",
        detectionFiles: ["marker.txt"],
        cachePatterns: [".cache/"]
      }
    ]);

    const keywordsOnly = await saveCustomScanRules({ keywords: ["shader-cache", "logs"] });
    expect(keywordsOnly.categories).toEqual(saved.categories);
    expect(keywordsOnly.keywords).toEqual(["shader-cache", "logs"]);
  });

  it("assigns a stable unique slug and does not reuse a built-in id", async () => {
    const first = await saveCustomScanRules({
      categories: [{ name: "My Cache", detectionFiles: ["a.txt"], cachePatterns: ["out/"] }]
    });
    expect(first.categories[0].id).toBe("custom-my-cache");

    const second = await saveCustomScanRules({
      categories: [
        ...first.categories,
        { name: "My Cache!", detectionFiles: ["b.txt"], cachePatterns: ["tmp/"] },
        { name: "Nodejs", detectionFiles: ["package.json"], cachePatterns: [".cache/"] }
      ]
    });
    expect(second.categories.map(category => category.id)).toEqual([
      "custom-my-cache",
      "custom-my-cache-2",
      "custom-nodejs"
    ]);
    expect(second.categories.map(category => category.id)).not.toContain("nodejs");

    const third = await saveCustomScanRules({
      categories: [second.categories[0]]
    });
    expect(third.categories[0].id).toBe("custom-my-cache");
  });

  it("appends -custom when the generated id matches a built-in id", async () => {
    builtinCategoryIds.add("custom-tools");
    try {
      const saved = await saveCustomScanRules({
        categories: [{ name: "Tools", detectionFiles: ["a.txt"], cachePatterns: ["b/"] }]
      });
      expect(saved.categories[0].id).toBe("custom-tools-custom");
    } finally {
      builtinCategoryIds.delete("custom-tools");
    }
  });
});
