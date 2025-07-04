import { promises as fs } from "fs";
import { Category } from "../../types/developer-cleaner";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Mock the worker_threads module
vi.mock("worker_threads", () => ({
  parentPort: {
    postMessage: vi.fn(),
    on: vi.fn()
  }
}));

// Mock fs promises
vi.mock("fs", () => ({
  promises: {
    readdir: vi.fn(),
    stat: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    rmdir: vi.fn(),
    unlink: vi.fn()
  }
}));

// Mock path with default export
vi.mock("path", () => {
  const pathMock = {
    join: vi.fn((...args) => args.join("/")),
    relative: vi.fn((from, to) => to.replace(from + "/", "")),
    dirname: vi.fn(p => p.split("/").slice(0, -1).join("/")),
    basename: vi.fn(p => p.split("/").pop() || ""),
    resolve: vi.fn((...args) => args.join("/"))
  };
  return {
    default: pathMock,
    ...pathMock
  };
});

// Mock fileUtils - use vi.mock with factory
vi.mock("../fileUtils", () => ({
  getDirSize: vi.fn().mockResolvedValue(1000)
}));

// Import the worker module directly to avoid dynamic imports
import * as worker from "../developerScanWorker";

describe("developerScanWorker", () => {
  const mockCategory: Category = {
    name: "TestProject",
    detectionFiles: ["package.json", "src/"],
    cachePatterns: ["node_modules/", "dist/"]
  };

  const mockDirEntry = (name: string, isDir: boolean) => ({
    name,
    isDirectory: () => isDir
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkProjectType", () => {
    it("should detect project by file", async () => {
      // Mock fs.readdir to return package.json
      vi
        .mocked(fs.readdir)
        .mockResolvedValue(
          [
            mockDirEntry("package.json", false),
            mockDirEntry("other.txt", false)
          ] as any
        );

      const result = await worker.checkProjectType("/test/path", [
        mockCategory
      ]);

      expect(result).toEqual([mockCategory]);
      expect(fs.readdir).toHaveBeenCalledWith("/test/path", {
        withFileTypes: true
      });
    });

    it("should detect project by directory", async () => {
      // Mock fs.readdir to return src directory
      vi
        .mocked(fs.readdir)
        .mockResolvedValue(
          [mockDirEntry("src", true), mockDirEntry("other", false)] as any
        );

      const result = await worker.checkProjectType("/test/path", [
        mockCategory
      ]);

      expect(result).toEqual([mockCategory]);
    });

    it("should handle errors gracefully", async () => {
      // Mock fs.readdir to throw error
      vi.mocked(fs.readdir).mockRejectedValue(new Error("Test error"));

      const result = await worker.checkProjectType("/test/path", [
        mockCategory
      ]);

      expect(result).toEqual([]);
    });
  });

  describe("expandGlobPattern", () => {
    it("should handle simple patterns without globs", async () => {
      const result = await worker.expandGlobPattern(
        "/test/path",
        "node_modules"
      );

      expect(result).toEqual(["/test/path/node_modules"]);
    });

    it("should handle single asterisk patterns", async () => {
      // Mock fs.readdir and fs.stat for the glob expansion
      vi
        .mocked(fs.readdir)
        .mockResolvedValue(
          [mockDirEntry("cache", true), mockDirEntry("temp", true)] as any
        );
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      const result = await worker.expandGlobPattern("/test/path", "*/cache");

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("calculateCacheSizes", () => {
    it("should calculate sizes correctly", async () => {
      // Mock fs functions
      vi
        .mocked(fs.readdir)
        .mockResolvedValue(
          [
            mockDirEntry("node_modules", true),
            mockDirEntry("dist", true)
          ] as any
        );
      vi.mocked(fs.stat).mockResolvedValue(
        {
          isDirectory: () => true,
          size: 1000,
          mtime: new Date()
        } as any
      );

      const result = await worker.calculateCacheSizes("/test/path", [
        mockCategory
      ]);

      expect(result.totalSize).toBeGreaterThan(0);
      expect(result.caches.length).toBeGreaterThan(0);
    });
  });

  describe("handleDoubleAsteriskPattern", () => {
    it("should handle zero-match case (direct next part match)", async () => {
      const results: string[] = [];
      const patternParts = ["**", "dist", "cache"];

      // Mock readdir to simulate a directory containing "dist"
      vi
        .mocked(fs.readdir)
        .mockResolvedValue([mockDirEntry("dist", true)] as any);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      await worker.handleDoubleAsteriskPattern(
        "/test/path",
        patternParts,
        0,
        results
      );

      expect(results).toContain("/test/path/dist/cache");
    });

    it("should handle end of pattern case", async () => {
      const results: string[] = [];
      const patternParts = ["**"];

      await worker.handleDoubleAsteriskPattern(
        "/test/path",
        patternParts,
        0,
        results
      );

      expect(results).toContain("/test/path");
    });
  });

  describe("processDoubleAsteriskSubdirectories", () => {
    it("should process direct matches with next part", async () => {
      const results: string[] = [];
      const patternParts = ["**", "dist", "cache"];

      // Mock readdir to simulate a directory containing "dist"
      vi
        .mocked(fs.readdir)
        .mockResolvedValue([mockDirEntry("dist", true)] as any);
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      await worker.processDoubleAsteriskSubdirectories(
        "/test/path",
        patternParts,
        0, // partIndex
        1, // nextPartIndex
        "dist", // nextPart
        results
      );

      expect(results).toContain("/test/path/dist/cache");
    });

    it("should process deep directory traversal", async () => {
      const results: string[] = [];
      const patternParts = ["**", "cache"];

      // Mock readdir to simulate nested directories
      vi
        .mocked(fs.readdir)
        .mockResolvedValueOnce([mockDirEntry("src", true)] as any) // First level
        .mockResolvedValueOnce([mockDirEntry("cache", true)] as any); // Second level

      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      await worker.processDoubleAsteriskSubdirectories(
        "/test/path",
        patternParts,
        0, // partIndex
        1, // nextPartIndex
        "cache", // nextPart
        results
      );

      expect(results).toContain("/test/path/src/cache");
    });

    it("should handle empty directories", async () => {
      const results: string[] = [];
      const patternParts = ["**", "cache"];

      // Mock readdir to return empty directory
      vi.mocked(fs.readdir).mockResolvedValue([] as any);

      await worker.processDoubleAsteriskSubdirectories(
        "/test/path",
        patternParts,
        0, // partIndex
        1, // nextPartIndex
        "cache", // nextPart
        results
      );

      expect(results).toHaveLength(0);
    });
  });

  describe("scanDeveloperProjects", () => {
    it("should scan projects and report results", async () => {
      // Mock fs functions
      vi
        .mocked(fs.readdir)
        .mockResolvedValue(
          [
            mockDirEntry("project1", true),
            mockDirEntry("project2", true)
          ] as any
        );
      vi.mocked(fs.stat).mockResolvedValue(
        {
          isDirectory: () => true,
          size: 1000,
          mtime: new Date()
        } as any
      );

      const result = await worker.scanDeveloperProjects(
        ["/test/path"],
        [mockCategory]
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle scan errors gracefully", async () => {
      // Mock fs.readdir to throw error
      vi.mocked(fs.readdir).mockRejectedValue(new Error("Test error"));

      const result = await worker.scanDeveloperProjects(
        ["/test/path"],
        [mockCategory]
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
    });
  });
});
