import {
  getDirSize,
  getSavedFoldersPath,
  saveFolders,
  loadSavedFolders,
  getSavedFoldersCount,
  getSavedDeveloperProjectsPath,
  saveDeveloperProjects,
  loadSavedDeveloperProjects,
  getSavedDeveloperProjectsCount
} from "../fileUtils";
import { promises as fs, existsSync } from "fs";
import path from "path";
import os from "os";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { app } from "electron";
import type { FolderItem } from "../../renderer/types";
import type { ProjectInfo } from "../../renderer/types/developer-cleaner";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn()
  }
}));

describe("fileUtils", () => {
  let tempDir: string;
  const mockUserDataPath = path.join(os.tmpdir(), `test-userdata-${Date.now()}`);

  beforeEach(async () => {
    vi.clearAllMocks();
    // Create temporary directories
    tempDir = path.join(os.tmpdir(), `test-${Date.now()}`);
    if (existsSync(tempDir)) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(mockUserDataPath, { recursive: true });
    (app.getPath as any).mockReturnValue(mockUserDataPath);
  });

  afterEach(async () => {
    // Clean up - remove temp directories and all contents
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      await fs.rm(mockUserDataPath, { recursive: true, force: true });
    } catch (err) {
      console.error("Failed to clean up temp directories:", err);
    }
  });

  describe("getDirSize", () => {
    it("should calculate directory size correctly", async () => {
      // Create test files with known content
      const content1 = "a".repeat(100);
      const content2 = "b".repeat(200);
      await fs.writeFile(path.join(tempDir, "file1.txt"), content1);
      await fs.writeFile(path.join(tempDir, "file2.txt"), content2);

      // Create subdirectory with a file
      const subDir = path.join(tempDir, "subdir");
      await fs.mkdir(subDir);
      const content3 = "c".repeat(300);
      await fs.writeFile(path.join(subDir, "file3.txt"), content3);

      const size = await getDirSize(tempDir);
      expect(size).toBe(600); // 100 + 200 + 300 bytes
    });

    it("should handle errors gracefully", async () => {
      // Try to get size of non-existent directory
      const nonExistentDir = path.join(tempDir, "does-not-exist");
      const size = await getDirSize(nonExistentDir);
      expect(size).toBe(0);
    });
  });

  describe("Saved Folders Functions", () => {
    const mockFolders: FolderItem[] = [{
      path: "/test",
      size: 1000
    }];

    it("should get saved folders path correctly", async () => {
      const result = await getSavedFoldersPath();
      expect(result).toBe(path.join(mockUserDataPath, "saved-folders-appdata.json"));
      expect(app.getPath).toHaveBeenCalledWith("userData");
    });

    it("should save and load folders correctly", async () => {
      // Save folders
      await saveFolders(mockFolders);
      
      // Verify file was created with correct content
      const savedContent = await fs.readFile(
        path.join(mockUserDataPath, "saved-folders-appdata.json"),
        "utf-8"
      );
      expect(JSON.parse(savedContent)).toEqual(mockFolders);

      // Load folders and verify
      const loadedFolders = await loadSavedFolders();
      expect(loadedFolders).toEqual(mockFolders);
    });

    it("should handle load error and return empty array", async () => {
      const result = await loadSavedFolders();
      expect(result).toEqual([]);
    });

    it("should get saved folders count correctly", async () => {
      // Save folders first
      await saveFolders(mockFolders);
      
      // Get count and verify
      const count = await getSavedFoldersCount();
      expect(count).toBe(1);
    });

    it("should handle count error and return 0", async () => {
      const count = await getSavedFoldersCount();
      expect(count).toBe(0);
    });
  });

  describe("Developer Projects Functions", () => {
    const mockProjects: ProjectInfo[] = [{
      path: "/test",
      type: "npm",
      lastModified: new Date().toISOString(),
      totalCacheSize: 1000,
      selectedCacheSize: 500,
      caches: []
    }];

    it("should get saved developer projects path correctly", async () => {
      const result = await getSavedDeveloperProjectsPath();
      expect(result).toBe(path.join(mockUserDataPath, "saved-folders-developer.json"));
      expect(app.getPath).toHaveBeenCalledWith("userData");
    });

    it("should save and load developer projects correctly", async () => {
      // Save projects
      await saveDeveloperProjects(mockProjects);
      
      // Verify file was created with correct content
      const savedContent = await fs.readFile(
        path.join(mockUserDataPath, "saved-folders-developer.json"),
        "utf-8"
      );
      expect(JSON.parse(savedContent)).toEqual(mockProjects);

      // Load projects and verify
      const loadedProjects = await loadSavedDeveloperProjects();
      expect(loadedProjects).toEqual(mockProjects);
    });

    it("should handle load error and return empty array", async () => {
      const result = await loadSavedDeveloperProjects();
      expect(result).toEqual([]);
    });

    it("should get saved developer projects count correctly", async () => {
      // Save projects first
      await saveDeveloperProjects(mockProjects);
      
      // Get count and verify
      const count = await getSavedDeveloperProjectsCount();
      expect(count).toBe(1);
    });

    it("should handle count error and return 0", async () => {
      const count = await getSavedDeveloperProjectsCount();
      expect(count).toBe(0);
    });
  });
});
