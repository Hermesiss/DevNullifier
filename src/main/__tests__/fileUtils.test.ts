import { getDirSize } from "../fileUtils";
import { promises as fs } from "fs";
import path from "path";
import { vi, describe, it, expect, beforeEach, Mock } from "vitest";

vi.mock("fs", () => ({
  promises: {
    readdir: vi.fn(),
    stat: vi.fn()
  }
}));

describe("fileUtils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDirSize", () => {
    it("should calculate directory size correctly", async () => {
      // Mock file structure
      (fs.readdir as Mock).mockResolvedValueOnce([
        { name: "file1.txt", isDirectory: () => false },
        { name: "file2.txt", isDirectory: () => false },
        { name: "subdir", isDirectory: () => true }
      ]);

      // Mock file stats
      (fs.stat as Mock).mockImplementation((path: string) => {
        if (path.endsWith("file1.txt")) {
          return Promise.resolve({ size: 100 });
        } else if (path.endsWith("file2.txt")) {
          return Promise.resolve({ size: 200 });
        }
        return Promise.resolve({ size: 0 });
      });

      // Mock subdirectory contents
      (fs.readdir as Mock).mockResolvedValueOnce([
        { name: "file3.txt", isDirectory: () => false }
      ]);

      const size = await getDirSize("/test/dir");
      expect(size).toBe(300); // 100 + 200 from root files
      expect(fs.readdir).toHaveBeenCalledTimes(2);
      expect(fs.stat).toHaveBeenCalledTimes(3);
    });

    it("should handle errors gracefully", async () => {
      (fs.readdir as Mock).mockRejectedValueOnce(new Error("Access denied"));

      const size = await getDirSize("/test/dir");
      expect(size).toBe(0);
      expect(fs.readdir).toHaveBeenCalledTimes(1);
    });
  });
});
