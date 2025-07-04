import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDirectorySize } from "../appDataCleaner";

describe("getDirectorySize", () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory
    tempDir = path.join(os.tmpdir(), `test-${Date.now()}`);
    await fs.mkdir(tempDir);
  });

  afterEach(async () => {
    // Clean up - remove temp directory and all contents
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.error("Failed to clean up temp directory:", err);
    }
  });

  it("should calculate size of directory with files", async () => {
    // Create test files with known content
    const content1 = "a".repeat(100);
    const content2 = "b".repeat(200);
    await fs.writeFile(path.join(tempDir, "file1.txt"), content1);
    await fs.writeFile(path.join(tempDir, "file2.txt"), content2);

    const size = await getDirectorySize(tempDir);
    expect(size).toBe(300); // 100 + 200 bytes
  });

  it("should calculate size of directory with nested directories", async () => {
    // Create nested directory structure
    const subDir = path.join(tempDir, "subdir");
    await fs.mkdir(subDir);

    // Create files in both root and nested directory
    const rootContent = "a".repeat(100);
    const nestedContent = "b".repeat(50);
    await fs.writeFile(path.join(tempDir, "root.txt"), rootContent);
    await fs.writeFile(path.join(subDir, "nested.txt"), nestedContent);

    const size = await getDirectorySize(tempDir);
    expect(size).toBe(150); // 100 + 50 bytes
  });

  it("should handle empty directories", async () => {
    const size = await getDirectorySize(tempDir);
    expect(size).toBe(0);
  });
});
