import { promises as fs } from "fs";
import fsSync from "fs";
import os from "os";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { getAppDataPaths, deleteDirectory, folderNameMatchesKeyword } from "../appDataCleaner";

// Mock modules
vi.mock("fs", () => ({
  promises: {
    stat: vi.fn(),
    lstat: vi.fn(),
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

    it("builds LocalLow from the last segment, not the first Local substring", () => {
      process.env.LOCALAPPDATA = "C:/Users/LocalAdmin/AppData/Local";
      vi.mocked(fsSync.existsSync).mockReturnValue(true);
      const paths = getAppDataPaths();
      expect(paths).toContain("C:/Users/LocalAdmin/AppData/LocalLow");
      expect(paths.some(entry => entry.includes("LocalLowAdmin"))).toBe(false);
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

describe("folderNameMatchesKeyword", () => {
  const keywords = ["cache", "temp", "report"];

  it("matches a keyword at the start or end of the name", () => {
    expect(folderNameMatchesKeyword("Cache", keywords)).toBe(true);
    expect(folderNameMatchesKeyword("shadercache", keywords)).toBe(true);
    expect(folderNameMatchesKeyword("temp-dir", keywords)).toBe(true);
    expect(folderNameMatchesKeyword("coverage-report", keywords)).toBe(true);
  });

  it("does not match a keyword buried in the name", () => {
    expect(folderNameMatchesKeyword("Templates", keywords)).toBe(false);
    expect(folderNameMatchesKeyword("template", keywords)).toBe(false);
    expect(folderNameMatchesKeyword("myreportfiles", keywords)).toBe(false);
  });
});

describe("deleteDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const trash = vi.fn().mockResolvedValue(undefined);

  it("returns true when the path is already gone", async () => {
    vi.mocked(fs.lstat).mockRejectedValue(new Error("ENOENT"));
    await expect(deleteDirectory("/missing", trash)).resolves.toBe(true);
    expect(trash).not.toHaveBeenCalled();
  });

  it("moves a directory to the trash without walking it", async () => {
    vi.mocked(fs.lstat).mockResolvedValue({
      isSymbolicLink: () => false,
      isDirectory: () => true,
      isFile: () => false
    } as any);

    await expect(deleteDirectory("/path/to/delete", trash)).resolves.toBe(true);
    expect(trash).toHaveBeenCalledWith("/path/to/delete");
    expect(fs.readdir).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it("moves a file to the trash", async () => {
    vi.mocked(fs.lstat).mockResolvedValue({
      isSymbolicLink: () => false,
      isDirectory: () => false,
      isFile: () => true
    } as any);

    await expect(deleteDirectory("/path/.eslintcache", trash)).resolves.toBe(true);
    expect(trash).toHaveBeenCalledWith("/path/.eslintcache");
  });

  it("unlinks a symlink or junction instead of following it", async () => {
    vi.mocked(fs.lstat).mockResolvedValue({
      isSymbolicLink: () => true,
      isDirectory: () => false,
      isFile: () => false
    } as any);
    vi.mocked(fs.unlink).mockResolvedValue(undefined);

    await expect(deleteDirectory("/path/junction", trash)).resolves.toBe(true);
    expect(fs.unlink).toHaveBeenCalledWith("/path/junction");
    expect(trash).not.toHaveBeenCalled();
    expect(fs.readdir).not.toHaveBeenCalled();
  });

  it("returns false when trash fails", async () => {
    vi.mocked(fs.lstat).mockResolvedValue({
      isSymbolicLink: () => false,
      isDirectory: () => true,
      isFile: () => false
    } as any);
    const failingTrash = vi.fn().mockRejectedValue(new Error("busy"));

    await expect(deleteDirectory("/path/busy", failingTrash)).resolves.toBe(false);
  });
});
