import { promises as fs } from "fs";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { getDirSize } from "../fileUtils";
import { FolderScanner, initializeWorker, type IMessagePort, type WorkerResponse } from "../appDataScanWorker";
import path from "path";
import os from "os";

// Mock modules
vi.mock("fs", () => ({
  promises: {
    readdir: vi.fn()
  }
}));

vi.mock("../fileUtils", () => ({
  getDirSize: vi.fn(),
  setUserDataPath: vi.fn()
}));

// Helper to create a mock directory entry with only the properties we use
const mockDirEntry = (name: string, isDir: boolean) => ({
  name,
  isDirectory: () => isDir,
  isFile: () => !isDir
});

describe("FolderScanner", () => {
  let mockMessagePort: IMessagePort;
  let mockFsOps: { readdir: typeof fs.readdir; getDirSize: typeof getDirSize };
  let scanner: FolderScanner;
  let messages: WorkerResponse[];
  const mockUserDataPath = path.join(os.tmpdir(), `test-userdata-${Date.now()}`);

  beforeEach(() => {
    messages = [];
    mockMessagePort = {
      postMessage: (msg: WorkerResponse) => {
        messages.push(msg);
      },
      on: vi.fn()
    };

    mockFsOps = {
      readdir: vi.fn(),
      getDirSize: vi.fn().mockResolvedValue(1234) // Default size for tests
    };

    scanner = new FolderScanner(mockMessagePort, mockFsOps);
  });

  describe("scanPaths", () => {
    it("should scan multiple paths and aggregate results", async () => {
      const paths = ["/test/path1", "/test/path2"];
      const keywords = ["cache", "temp"];
      
      vi.mocked(mockFsOps.readdir)
        .mockResolvedValueOnce([
          mockDirEntry("cache-dir", true),
          mockDirEntry("other", true)
        ] as any)
        .mockResolvedValueOnce([
          mockDirEntry("temp-dir", true)
        ] as any);

      const results = await scanner.scanPaths(paths, 2, keywords, mockUserDataPath);
      scanner.sendFolders(true); // Force send any remaining folders

      expect(results).toHaveLength(2);
      expect(messages).toContainEqual({ type: "current-path", path: paths[0] });
      expect(messages).toContainEqual({ type: "current-path", path: paths[1] });
      
      // Find all folder-found messages
      const folderFoundMessages = messages.filter(m => m.type === "folder-found");
      expect(folderFoundMessages).toHaveLength(1); // We expect one final batched message
      
      // Verify the folders in the message - order doesn't matter since they're batched
      const foundFolders = folderFoundMessages[0].folders;
      expect(foundFolders).toHaveLength(2);
      expect(foundFolders).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "cache-dir", size: 1234 }),
          expect.objectContaining({ name: "temp-dir", size: 1234 })
        ])
      );

      expect(messages).toContainEqual({ type: "progress", count: 2 });
      expect(messages).toContainEqual({ type: "done", results });
    });

    it("should respect maxDepth parameter", async () => {
      vi.mocked(mockFsOps.readdir)
        .mockResolvedValueOnce([
          mockDirEntry("level1", true)
        ] as any)
        .mockResolvedValueOnce([
          mockDirEntry("cache", true)
        ] as any);

      // With maxDepth = 0, it should only scan the root directory
      await scanner.scanPaths(["/test"], 0, ["cache"], mockUserDataPath);
      expect(mockFsOps.readdir).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();

      // With maxDepth = 1, it should scan one level deep
      await scanner.scanPaths(["/test"], 1, ["cache"], mockUserDataPath);
      expect(mockFsOps.readdir).toHaveBeenCalledTimes(1);
    });

    it("should handle filesystem errors gracefully", async () => {
      const mockError = new Error("Permission denied");
      vi.mocked(mockFsOps.readdir).mockRejectedValue(mockError);

      const results = await scanner.scanPaths(["/test"], 1, ["cache"], mockUserDataPath);
      
      expect(results).toHaveLength(0);
      expect(messages).toContainEqual({ type: "current-path", path: "/test" });
      expect(messages).toContainEqual({ type: "progress", count: 0 });
      expect(messages).toContainEqual({ type: "done", results: [] });
    });

    it("records modifiedAt from the folder mtime", async () => {
      const mtime = new Date("2020-06-01T12:00:00.000Z");
      const stat = vi.fn().mockResolvedValue({ mtime });
      const port: IMessagePort = { postMessage: () => undefined, on: vi.fn() };
      const localScanner = new FolderScanner(port, {
        readdir: vi.fn().mockResolvedValue([mockDirEntry("cache", true)] as any),
        getDirSize: vi.fn().mockResolvedValue(50),
        stat
      });

      const results = await localScanner.scanPaths(["/test"], 1, ["cache"], mockUserDataPath);

      expect(stat).toHaveBeenCalledWith("/test/cache");
      expect(results).toHaveLength(1);
      expect(results[0].modifiedAt).toBe(mtime.toISOString());
    });

    it("should ignore empty folders", async () => {
      vi.mocked(mockFsOps.getDirSize).mockResolvedValue(0);
      vi.mocked(mockFsOps.readdir).mockResolvedValue([
        mockDirEntry("cache", true)
      ] as any);

      const results = await scanner.scanPaths(["/test"], 1, ["cache"], mockUserDataPath);
      
      expect(results).toHaveLength(0);
      expect(messages.filter(m => m.type === "folder-found")).toHaveLength(0);
    });

    it("should handle non-directory entries correctly", async () => {
      vi.mocked(mockFsOps.readdir).mockResolvedValue([
        mockDirEntry("cache.txt", false),
        mockDirEntry("cache", true)
      ] as any);

      await scanner.scanPaths(["/test"], 1, ["cache"], mockUserDataPath);
      
      // Should only process the directory, not the file
      expect(mockFsOps.getDirSize).toHaveBeenCalledTimes(1);
      expect(mockFsOps.getDirSize).toHaveBeenCalledWith("/test/cache", expect.any(Function));
    });

    it("does not emit or descend into a protected directory", async () => {
      const root = path.join(os.tmpdir(), "dn-scan-root");
      const keep = path.join(root, "keep");
      const rootKey = root.replace(/\\/g, "/");
      const keepKey = keep.replace(/\\/g, "/");

      vi.mocked(mockFsOps.readdir).mockImplementation(async (dir: any) => {
        const key = String(dir).replace(/\\/g, "/");
        if (key === rootKey) {
          return [mockDirEntry("keep", true), mockDirEntry("cache", true)] as any;
        }
        if (key === keepKey) {
          throw new Error(`should not read ${key}`);
        }
        return [] as any;
      });

      const results = await scanner.scanPaths(
        [root],
        3,
        ["cache", "keep"],
        mockUserDataPath,
        [keep]
      );

      expect(results.map(folder => folder.name)).toEqual(["cache"]);
      expect(mockFsOps.getDirSize).toHaveBeenCalledTimes(1);
    });

    it("skips a protected scan root", async () => {
      const keep = path.join(os.tmpdir(), "dn-protected-root");

      const results = await scanner.scanPaths(
        [keep],
        3,
        ["cache"],
        mockUserDataPath,
        [keep]
      );

      expect(results).toEqual([]);
      expect(mockFsOps.readdir).not.toHaveBeenCalled();
    });

    it("does not emit or descend into an excluded directory", async () => {
      const root = path.join(os.tmpdir(), "dn-exclude-root");
      const saveGames = path.join(root, "Proj", "Saved", "SaveGames");
      const config = path.join(root, "Proj", "Saved", "Config");
      const rootKey = root.replace(/\\/g, "/");
      const projKey = path.join(root, "Proj").replace(/\\/g, "/");
      const savedKey = path.join(root, "Proj", "Saved").replace(/\\/g, "/");
      const saveGamesKey = saveGames.replace(/\\/g, "/");
      const configKey = config.replace(/\\/g, "/");

      vi.mocked(mockFsOps.readdir).mockImplementation(async (dir: any) => {
        const key = String(dir).replace(/\\/g, "/");
        if (key === rootKey) return [mockDirEntry("Proj", true)] as any;
        if (key === projKey) return [mockDirEntry("Saved", true)] as any;
        if (key === savedKey) {
          return [mockDirEntry("SaveGames", true), mockDirEntry("Config", true)] as any;
        }
        if (key === saveGamesKey) throw new Error(`should not read ${key}`);
        if (key === configKey) return [] as any;
        return [] as any;
      });

      const results = await scanner.scanPaths(
        [root],
        6,
        ["cache", "savegames", "config"],
        mockUserDataPath,
        [],
        ["*/Saved/SaveGames"]
      );

      expect(results.map(folder => folder.name)).toEqual(["Config"]);
      expect(mockFsOps.getDirSize).toHaveBeenCalledTimes(1);
    });

    it("does not emit a directory that contains a marker file", async () => {
      const root = path.join(os.tmpdir(), "dn-marker-root");
      const cache = path.join(root, "cache");
      const rootKey = root.replace(/\\/g, "/");
      const cacheKey = cache.replace(/\\/g, "/");

      vi.mocked(mockFsOps.readdir).mockImplementation(async (dir: any) => {
        const key = String(dir).replace(/\\/g, "/");
        if (key === rootKey) return [mockDirEntry("cache", true)] as any;
        if (key === cacheKey) {
          return [mockDirEntry(".gitkeep", false), mockDirEntry("blob", true)] as any;
        }
        throw new Error(`should not read ${key}`);
      });

      const results = await scanner.scanPaths(
        [root],
        4,
        ["cache"],
        mockUserDataPath,
        [],
        [".gitkeep"]
      );

      expect(results).toEqual([]);
      expect(mockFsOps.getDirSize).not.toHaveBeenCalled();
    });

    it("skips the application userData directory", async () => {
      vi.mocked(mockFsOps.readdir).mockResolvedValue([
        mockDirEntry("Cache", true)
      ] as any);

      const results = await scanner.scanPaths(
        [mockUserDataPath],
        3,
        ["cache"],
        mockUserDataPath
      );

      expect(results).toEqual([]);
      expect(mockFsOps.readdir).not.toHaveBeenCalled();
    });

    it("does not treat Templates as a temp folder", async () => {
      vi.mocked(mockFsOps.readdir).mockImplementation(async (dir: any) => {
        if (dir === "/test") {
          return [
            mockDirEntry("Templates", true),
            mockDirEntry("shadercache", true),
            mockDirEntry("myreportfiles", true)
          ] as any;
        }
        return [] as any;
      });

      const results = await scanner.scanPaths(
        ["/test"],
        1,
        ["cache", "temp", "report"],
        mockUserDataPath
      );

      expect(results.map(folder => folder.name)).toEqual(["shadercache"]);
      expect(results[0].keyword).toBe("cache");
    });

    it("should match keywords case-insensitively", async () => {
      vi.mocked(mockFsOps.readdir).mockResolvedValue([
        mockDirEntry("CACHE", true),
        mockDirEntry("Cache", true),
        mockDirEntry("cache", true)
      ] as any);

      const results = await scanner.scanPaths(["/test"], 1, ["cache"], mockUserDataPath);
      scanner.sendFolders(true); // Force send any remaining folders
      
      expect(results).toHaveLength(3);
      // Since folders are now batched, we expect one message with all 3 folders
      const folderFoundMessages = messages.filter(m => m.type === "folder-found");
      expect(folderFoundMessages).toHaveLength(1);
      
      // Verify all folders are in the final batched message
      const foundFolders = folderFoundMessages[0].folders;
      expect(foundFolders).toHaveLength(3);
      expect(foundFolders).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "CACHE", size: 1234, keyword: "cache" }),
          expect.objectContaining({ name: "Cache", size: 1234, keyword: "cache" }),
          expect.objectContaining({ name: "cache", size: 1234, keyword: "cache" })
        ])
      );
    });

    it("should handle error when path normalization fails", async () => {
      // Mock path.normalize to throw
      const originalNormalize = path.normalize;
      path.normalize = vi.fn().mockImplementation(() => {
        throw new Error("Invalid path");
      });
      
      try {
        const results = await scanner.scanPaths(["/test/path"], 1, ["cache"], mockUserDataPath);
        
        expect(messages).toEqual([
          {
            type: "error",
            error: "Invalid path"
          }
        ]);
        
        expect(results).toEqual([]);
      } finally {
        // Restore original normalize function
        path.normalize = originalNormalize;
      }
    });

    it("initialize worker without parentPort throws error", () => {
      expect(() => initializeWorker()).toThrowError("Worker thread parent port not available");
    });

    it("initialize worker with injected port", () => {
      const mockMessages: WorkerResponse[] = [];
      const mockPort = {
        postMessage: (msg: WorkerResponse) => mockMessages.push(msg),
        on: vi.fn()
      };

      // Test error handling
      const scanner = new FolderScanner(mockPort as any);
      scanner.scanPaths(undefined as any, 1, ["cache"], mockUserDataPath);

      expect(mockMessages).toContainEqual({
        "error": "paths is not iterable",
        "type": "error"
      });
    });
  });
});
