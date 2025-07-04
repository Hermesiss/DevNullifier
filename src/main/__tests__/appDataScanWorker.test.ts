import { promises as fs } from "fs";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { getDirSize } from "../fileUtils";
import { FolderScanner, type IMessagePort, type WorkerResponse } from "../appDataScanWorker";

// Mock modules
vi.mock("fs", () => ({
  promises: {
    readdir: vi.fn()
  }
}));

vi.mock("../fileUtils", () => ({
  getDirSize: vi.fn()
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

  beforeEach(() => {
    messages = [];
    mockMessagePort = {
      postMessage: (msg: WorkerResponse) => {
        messages.push(msg);
      }
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

      const results = await scanner.scanPaths(paths, 2, keywords);

      expect(results).toHaveLength(2);
      expect(messages).toContainEqual({ type: "current-path", path: paths[0] });
      expect(messages).toContainEqual({ type: "current-path", path: paths[1] });
      expect(messages).toContainEqual({ 
        type: "folder-found", 
        folder: expect.objectContaining({ name: "cache-dir" })
      });
      expect(messages).toContainEqual({ 
        type: "folder-found", 
        folder: expect.objectContaining({ name: "temp-dir" })
      });
      expect(messages).toContainEqual({ type: "progress", count: 1 });
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
      await scanner.scanPaths(["/test"], 0, ["cache"]);
      expect(mockFsOps.readdir).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();

      // With maxDepth = 1, it should scan one level deep
      await scanner.scanPaths(["/test"], 1, ["cache"]);
      expect(mockFsOps.readdir).toHaveBeenCalledTimes(1);
    });

    it("should handle filesystem errors gracefully", async () => {
      const mockError = new Error("Permission denied");
      vi.mocked(mockFsOps.readdir).mockRejectedValue(mockError);

      const results = await scanner.scanPaths(["/test"], 1, ["cache"]);
      
      expect(results).toHaveLength(0);
      expect(messages).toContainEqual({ type: "current-path", path: "/test" });
      expect(messages).toContainEqual({ type: "progress", count: 0 });
      expect(messages).toContainEqual({ type: "done", results: [] });
    });

    it("should ignore empty folders", async () => {
      vi.mocked(mockFsOps.getDirSize).mockResolvedValue(0);
      vi.mocked(mockFsOps.readdir).mockResolvedValue([
        mockDirEntry("cache", true)
      ] as any);

      const results = await scanner.scanPaths(["/test"], 1, ["cache"]);
      
      expect(results).toHaveLength(0);
      expect(messages.filter(m => m.type === "folder-found")).toHaveLength(0);
    });

    it("should handle non-directory entries correctly", async () => {
      vi.mocked(mockFsOps.readdir).mockResolvedValue([
        mockDirEntry("cache.txt", false),
        mockDirEntry("cache", true)
      ] as any);

      await scanner.scanPaths(["/test"], 1, ["cache"]);
      
      // Should only process the directory, not the file
      expect(mockFsOps.getDirSize).toHaveBeenCalledTimes(1);
      expect(mockFsOps.getDirSize).toHaveBeenCalledWith("/test/cache");
    });

    it("should match keywords case-insensitively", async () => {
      vi.mocked(mockFsOps.readdir).mockResolvedValue([
        mockDirEntry("CACHE", true),
        mockDirEntry("Cache", true),
        mockDirEntry("cache", true)
      ] as any);

      const results = await scanner.scanPaths(["/test"], 1, ["cache"]);
      
      expect(results).toHaveLength(3);
      expect(messages.filter(m => m.type === "folder-found")).toHaveLength(3);
    });
  });
});
