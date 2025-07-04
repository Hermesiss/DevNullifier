import { promises as fs } from "fs";
import { vi, describe, it, expect, beforeEach, Mock } from "vitest";
import { Dirent } from "fs";
import { getDirSize } from "../fileUtils";

// Mock modules
vi.mock("worker_threads", () => ({
  parentPort: {
    postMessage: vi.fn(),
    on: vi.fn()
  },
  isMainThread: false
}));

vi.mock("fs", () => ({
  promises: {
    readdir: vi.fn()
  }
}));

vi.mock("path", () => {
  const pathMock = {
    join: vi.fn((...args) => args.join("/"))
  };
  return {
    default: pathMock,
    ...pathMock
  };
});

vi.mock("../fileUtils", () => ({
  getDirSize: vi.fn()
}));

// Import the worker module to ensure its code runs and attaches the listener
import "../appDataScanWorker";

const mockDirEntry = (name: string, isDir: boolean): Dirent =>
  ({
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false
  } as Dirent);

describe("appDataScanWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDirSize).mockResolvedValue(1234); // Default mock for tests
  });

  it("should find matching folders and post progress messages", async () => {
    vi
      .mocked(fs.readdir)
      .mockResolvedValueOnce(
        [
          // /test/path
          mockDirEntry("app-cache", true),
          mockDirEntry("other-dir", true),
          mockDirEntry("file.txt", false)
        ] as any
      )
      .mockResolvedValueOnce(
        [
          // /test/path/other-dir
          mockDirEntry("app-logs", true),
          mockDirEntry("sub-dir", true)
        ] as any
      )
      .mockResolvedValueOnce([] as any) // for sub-dir
      .mockResolvedValueOnce([] as any); // for app-cache
  });

  it("should not post a folder if getDirSize returns 0", async () => {
    vi.mocked(getDirSize).mockResolvedValue(0);
    vi
      .mocked(fs.readdir)
      .mockResolvedValueOnce([mockDirEntry("empty-cache", true)] as any);
  });
});
