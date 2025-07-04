import { promises as fs } from "fs";
import fsSync, { Dirent } from "fs";
import path from "path";
import os from "os";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { getAppDataPaths, deleteDirectory } from "../appDataCleaner";
import { getDirectorySize as getDirectorySizeInternal } from "../appDataCleaner";

// Mock modules
vi.mock("fs", () => ({
  promises: {
    stat: vi.fn(),
    readdir: vi.fn(),
    rm: vi.fn(),
    unlink: vi.fn()
  },
  default: {
    existsSync: vi.fn()
  }
}));

// Mock os with default export
vi.mock("os", () => {
  const osMock = {
    homedir: vi.fn()
  };
  return {
    default: osMock,
    ...osMock
  };
});

// Mock path with default export
vi.mock("path", () => {
  const pathMock = {
    join: vi.fn((...args) => args.join("/"))
  };
  return {
    default: pathMock,
    ...pathMock
  };
});

// Mock the internal getDirectorySize function
vi.mock("../appDataCleaner", async () => {
  const actual = await vi.importActual("../appDataCleaner");
  return {
    ...actual,
    getDirectorySize: vi.fn()
  };
});

describe("getAppDataPaths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Windows", () => {
    beforeEach(() => {
      Object.defineProperty(process, "platform", { value: "win32" });
      process.env.APPDATA = "C:/Users/test/AppData/Roaming";
      process.env.LOCALAPPDATA = "C:/Users/test/AppData/Local";
    });

    it("should return all existing Windows AppData paths", () => {
      vi.mocked(fsSync.existsSync).mockReturnValue(true);
      const paths = getAppDataPaths();
      expect(paths).toEqual([
        "C:/Users/test/AppData/Roaming",
        "C:/Users/test/AppData/Local",
        "C:/Users/test/AppData/LocalLow"
      ]);
    });

    it("should skip non-existent Windows paths", () => {
      vi.mocked(fsSync.existsSync).mockReturnValue(false);
      const paths = getAppDataPaths();
      expect(paths).toEqual([]);
    });
  });

  describe("Linux", () => {
    beforeEach(() => {
      Object.defineProperty(process, "platform", { value: "linux" });
      vi.mocked(os.homedir).mockReturnValue("/home/user");
    });

    it("should return all existing Linux paths", () => {
      vi.mocked(fsSync.existsSync).mockReturnValue(true);
      const paths = getAppDataPaths();
      expect(paths).toEqual([
        "/home/user/.config",
        "/home/user/.cache",
        "/home/user/.local/share",
        "/home/user/.local/state",
        "/tmp"
      ]);
    });

    it("should skip non-existent Linux paths", () => {
      vi.mocked(fsSync.existsSync).mockReturnValue(false);
      const paths = getAppDataPaths();
      expect(paths).toEqual([]);
    });
  });

  describe("macOS", () => {
    beforeEach(() => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      vi.mocked(os.homedir).mockReturnValue("/Users/user");
    });

    it("should return all existing macOS paths", () => {
      vi.mocked(fsSync.existsSync).mockReturnValue(true);
      const paths = getAppDataPaths();
      expect(paths).toEqual([
        "/Users/user/Library/Caches",
        "/Users/user/Library/Application Support",
        "/Users/user/Library/Logs",
        "/Users/user/Library/Preferences",
        "/tmp"
      ]);
    });

    it("should skip non-existent macOS paths", () => {
      vi.mocked(fsSync.existsSync).mockReturnValue(false);
      const paths = getAppDataPaths();
      expect(paths).toEqual([]);
    });
  });
});

describe("deleteDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  const createDirent = (name: string, isDirectory: boolean): Dirent =>
    ({
      name,
      isDirectory: () => isDirectory
    } as Dirent);

  it("should return true if path does not exist", async () => {
    vi.mocked(fs.stat).mockRejectedValue(new Error("ENOENT"));
    const result = await deleteDirectory("/non/existent");
    expect(result).toBe(true);
  });

  it("should return true for a fully successful deletion", async () => {
    // Mock the directory structure and successful deletions
    vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
    vi
      .mocked(fs.readdir)
      .mockResolvedValueOnce([createDirent("file.txt", false)] as any);
    vi.mocked(fs.unlink).mockResolvedValue(undefined);
    vi.mocked(fs.rm).mockResolvedValue(undefined);

    const result = await deleteDirectory("/path/to/delete");
    expect(result).toBe(true);
  });

  it("should handle nested directories correctly", async () => {
    // This requires more complex mocking to handle the recursion.
    vi.mocked(fs.stat).mockImplementation(
      (async (p: any) => ({
        isDirectory: () => !p.includes("file")
      })) as any
    );

    vi.mocked(fs.readdir).mockImplementation(
      (async (p: any) => {
        if (p === "/root") return [createDirent("subdir", true)];
        if (p === "/root/subdir") return [createDirent("file.txt", false)];
        return [];
      }) as any
    );

    vi.mocked(fs.unlink).mockResolvedValue(undefined);
    vi.mocked(fs.rm).mockResolvedValue(undefined);

    const result = await deleteDirectory("/root");
    expect(result).toBe(true);
  });
});
