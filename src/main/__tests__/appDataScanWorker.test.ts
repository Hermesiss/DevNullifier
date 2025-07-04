import { promises as fs } from "fs";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { getDirSize } from "../fileUtils";
import { FolderScanner, initializeWorker, type IMessagePort, type WorkerResponse } from "../appDataScanWorker";
import path from "path";

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
      },
      on: (event: "message", listener: (message: WorkerResponse) => void) => {
        if (event === "message") {
          listener(messages[messages.length - 1]);
        }
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
          expect.objectContaining({ name: "CACHE", size: 1234 }),
          expect.objectContaining({ name: "Cache", size: 1234 }),
          expect.objectContaining({ name: "cache", size: 1234 })
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
        const results = await scanner.scanPaths(["/test/path"], 1, ["cache"]);
        
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
      let functions: any[] = [];
      const port = {
        postMessage: (message: WorkerResponse) => {
          messages.push(message);
        },
        on: (event: string, listener: (message: WorkerResponse) => void) => {
          functions.push(listener);
        }
      } as unknown as IMessagePort;
      initializeWorker(port);
      expect(functions).toHaveLength(1);
      expect(functions[0]).toBeDefined();

      // call function message.paths, message.maxDepth, message.keywords
      functions[0]({
        type: "message",
        data: {
          paths: ["/test"],
          maxDepth: 1,
          keywords: ["cache"]
        }
      });

      expect(messages).toContainEqual({
        "error": "paths is not iterable",
        "type": "error"
      });

      functions[0]({
        type: "stop",
      });

      expect(messages).toContainEqual({
        "type": "stop"
      });
    });
  });
});
