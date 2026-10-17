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

    it("should continue scanning subdirectories when project has no caches", async () => {
      // Mock initial directory read
      vi.mocked(fs.readdir).mockImplementation(async (dir: any) => {
        if (dir === "/test/path") {
          return [
            mockDirEntry("package.json", false),
            mockDirEntry("subproject", true)
          ] as any;
        }
        if (dir === "/test/path/subproject") {
          return [mockDirEntry("package.json", false)] as any;
        }
        return [] as any;
      });

      vi.mocked(fs.stat).mockImplementation(async (target: any) => {
        const value = String(target);
        if (value.includes("/subproject") || value === "/test/path") {
          return {
            isDirectory: () => true,
            isFile: () => false,
            mtime: new Date(),
            size: 1000
          } as any;
        }
        throw new Error("ENOENT");
      });

      const result = await worker.scanDeveloperProjects(
        ["/test/path"],
        [mockCategory]
      );

      expect(result).toHaveLength(1);
      expect(result[0].path).toContain("/test/path/subproject");
      expect(result[0].totalCacheSize).toBe(2000);
    });

    it("does not record a cache inside a protected directory", async () => {
      vi.mocked(fs.readdir).mockImplementation(async (dir: any) => {
        if (dir === "/repo") return [mockDirEntry("package.json", false)] as any;
        return [] as any;
      });
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
        mtime: new Date(),
        size: 1000
      } as any);

      const result = await worker.scanDeveloperProjects(
        ["/repo"],
        [mockCategory],
        6,
        ["/repo/node_modules"]
      );

      const matchPaths = result.flatMap(project =>
        project.caches.flatMap(group => group.matches.map(match => match.path))
      );
      expect(matchPaths.some(matchPath => matchPath.includes("node_modules"))).toBe(false);
      expect(matchPaths.some(matchPath => matchPath.includes("dist"))).toBe(true);
    });

    it("does not record a project matched by an exclude glob", async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        mockDirEntry("package.json", false),
        mockDirEntry("node_modules", true)
      ] as any);

      const result = await worker.scanDeveloperProjects(
        ["/keep/app"],
        [mockCategory],
        6,
        [],
        ["*/app"]
      );

      expect(result).toEqual([]);
      expect(fs.readdir).not.toHaveBeenCalled();
    });

    it("skips a project directory that contains .gitkeep", async () => {
      vi.mocked(fs.readdir).mockImplementation(async (dir: any) => {
        if (dir === "/repo") {
          return [
            mockDirEntry("package.json", false),
            mockDirEntry(".gitkeep", false),
            mockDirEntry("pkg", true)
          ] as any;
        }
        throw new Error(`should not read ${dir}`);
      });

      const result = await worker.scanDeveloperProjects(
        ["/repo"],
        [mockCategory],
        6,
        [],
        [".gitkeep"]
      );

      expect(result).toEqual([]);
      expect(fs.readdir).toHaveBeenCalledTimes(1);
    });

    it("does not record a cache path matched by an exclude glob", async () => {
      vi.mocked(fs.readdir).mockImplementation(async (dir: any) => {
        if (dir === "/repo") return [mockDirEntry("package.json", false)] as any;
        return [] as any;
      });
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
        mtime: new Date(),
        size: 1000
      } as any);

      const result = await worker.scanDeveloperProjects(
        ["/repo"],
        [mockCategory],
        6,
        [],
        ["*/node_modules"]
      );

      const matchPaths = result.flatMap(project =>
        project.caches.flatMap(group => group.matches.map(match => match.path))
      );
      expect(matchPaths.some(matchPath => matchPath.includes("node_modules"))).toBe(false);
      expect(matchPaths.some(matchPath => matchPath.includes("dist"))).toBe(true);
    });

    it("does not record a project inside a protected path", async () => {
      vi.mocked(fs.readdir).mockResolvedValue([
        mockDirEntry("package.json", false),
        mockDirEntry("node_modules", true)
      ] as any);
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
        mtime: new Date(),
        size: 1000
      } as any);

      const result = await worker.scanDeveloperProjects(
        ["/keep/app"],
        [mockCategory],
        6,
        ["/keep"]
      );

      expect(result).toEqual([]);
      expect(fs.readdir).not.toHaveBeenCalled();
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

    it("keeps scanning nested projects after the root already has cache", async () => {
      vi.mocked(fs.readdir).mockImplementation(async (dir: any) => {
        if (dir === "/repo") {
          return [
            mockDirEntry("package.json", false),
            mockDirEntry("node_modules", true),
            mockDirEntry("packages", true)
          ] as any;
        }
        if (dir === "/repo/packages") return [mockDirEntry("pkg", true)] as any;
        if (dir === "/repo/packages/pkg") return [mockDirEntry("package.json", false)] as any;
        return [] as any;
      });
      const cacheSpy = vi.spyOn(worker, "calculateCacheSizes").mockResolvedValue({
        caches: [],
        totalSize: 10
      });
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date(),
        size: 1
      } as any);

      try {
        const result = await worker.scanDeveloperProjects(["/repo"], [mockCategory]);
        const paths = result.map(project => project.path);

        expect(paths).toContain("/repo");
        expect(paths).toContain("/repo/packages/pkg");
        expect(paths).not.toContain("/repo/node_modules");
      } finally {
        cacheSpy.mockRestore();
      }
    });
  });

  describe("detection globs", () => {
    it("does not let a dot in the pattern match any character", async () => {
      vi.mocked(fs.readdir).mockResolvedValue([mockDirEntry("gameXuproject", false)] as any);
      const category: Category = {
        name: "Unreal",
        detectionFiles: ["*.uproject"],
        cachePatterns: []
      };

      await expect(worker.checkProjectType("/game", [category])).resolves.toEqual([]);

      vi.mocked(fs.readdir).mockResolvedValue([mockDirEntry("game.uproject", false)] as any);
      await expect(worker.checkProjectType("/game", [category])).resolves.toEqual([category]);
    });

    it("matches a csproj by extension", async () => {
      vi.mocked(fs.readdir).mockResolvedValue([mockDirEntry("App.csproj", false)] as any);
      const category: Category = {
        name: ".NET",
        detectionFiles: ["*.csproj"],
        cachePatterns: []
      };

      await expect(worker.checkProjectType("/app", [category])).resolves.toEqual([category]);
    });
  });

  describe("calculateCacheSizes", () => {
    it("counts a path shared by two patterns once", async () => {
      vi.mocked(fs.stat).mockImplementation(async (target: any) => {
        if (String(target).endsWith("composer.lock")) {
          return { isFile: () => true, isDirectory: () => false, size: 8, mtime: new Date() } as any;
        }
        return { isFile: () => false, isDirectory: () => true, size: 1000, mtime: new Date() } as any;
      });

      const result = await worker.calculateCacheSizes("/proj", [
        { name: "PHP", detectionFiles: [], cachePatterns: ["vendor/"] },
        { name: "Symfony", detectionFiles: [], cachePatterns: ["vendor/"] }
      ]);

      expect(result.totalSize).toBe(1000);
    });

    it("skips vendor when composer.lock is missing", async () => {
      vi.mocked(fs.stat).mockRejectedValue(new Error("ENOENT"));

      const result = await worker.calculateCacheSizes("/proj", [
        { name: "PHP", detectionFiles: [], cachePatterns: ["vendor/"] }
      ]);

      expect(result.totalSize).toBe(0);
    });
  });
});
