import { parentPort } from "worker_threads";
import path from "path";
import fs from "fs/promises";
import type { Dirent } from "fs";
import * as fileUtils from "./fileUtils";
import { folderNameMatchesKeyword } from "./appDataCleaner";
import { isUnderUserPath } from "./deletionPolicy";
import { directoryExcludedByMarker, pathMatchesExclude } from "./excludeGlobs";

export interface Folder {
  path: string;
  size: number;
  name: string;
}

export interface WorkerMessage {
  type: "scan" | "stop";
  paths: string[];
  maxDepth: number;
  keywords: string[];
  userDataPath: string;
  protectedPaths?: string[];
  excludeGlobs?: string[];
}

export type WorkerResponse =
  | { type: "folder-found"; folders: Folder[] }
  | { type: "current-path"; path: string }
  | { type: "progress"; count: number }
  | { type: "done"; results: Folder[] }
  | { type: "error"; error: string }
  | { type: "stop" };

export interface IMessagePort {
  postMessage(message: WorkerResponse): void;
  on(event: "message", listener: (message: WorkerResponse) => void): void;
}

export class FolderScanner {
  private foundCount = 0;
  private isScanning = true;
  private foldersToSend: Folder[] = [];
  private userDataPath = "";
  private protectedPaths: readonly string[] = [];
  private excludeGlobs: readonly string[] = [];
  private readonly maxFoldersPerMessage = 20;

  constructor(
    private readonly messagePort: IMessagePort,
    private readonly fsOps = {
      readdir: fs.readdir,
      getDirSize: fileUtils.getDirSize
    }
  ) {}

  stop() {
    this.messagePort.postMessage({ type: "stop" });
    this.isScanning = false;
  }

  private normalizePath(p: string): string {
    return path.normalize(p).replace(/\\/g, "/");
  }

  private async processDirectoryEntry(
    entry: Dirent,
    dirPath: string,
    maxDepth: number,
    keywords: string[],
    currentDepth: number
  ): Promise<Folder[]> {
    const results: Folder[] = [];
    if (typeof entry.isSymbolicLink === "function" && entry.isSymbolicLink()) {
      return results;
    }

    const fullPath = this.normalizePath(path.join(dirPath, entry.name));
    if (this.isInsideUserData(fullPath) || this.isUserProtected(fullPath) || this.isExcluded(fullPath)) {
      return results;
    }

    try {
      if (folderNameMatchesKeyword(entry.name, keywords)) {
        if (await this.excludedByMarker(fullPath)) return results;
        const size = await this.fsOps.getDirSize(fullPath, () => this.isScanning);
        if (size > 0) {
          const folder: Folder = {
            path: fullPath,
            size,
            name: entry.name
          };
          results.push(folder);
          this.foundCount++;
          this.foldersToSend.push(folder);
          this.sendFolders();
        }
        return results;
      }

      // Only recurse if maxDepth is not reached
      if (maxDepth === -1 || currentDepth < maxDepth) {
        const subResults = await this.scanDirectory(
          fullPath,
          maxDepth,
          keywords,
          currentDepth + 1
        );
        results.push(...subResults);
      }
    } catch (err) {
      console.warn(`Cannot access ${fullPath}:`, (err as Error).message);
    }

    return results;
  }
  public sendFolders(force = false) {
    if (this.foldersToSend.length >= this.maxFoldersPerMessage || force) {
      this.messagePort.postMessage({
        type: "folder-found",
        folders: this.foldersToSend
      });
      this.foldersToSend = [];
    }
  }

  private async scanDirectory(
    dirPath: string,
    maxDepth: number,
    keywords: string[],
    currentDepth = 0
  ): Promise<Folder[]> {
    const results: Folder[] = [];
    const normalizedPath = this.normalizePath(dirPath);
    if (
      !this.isScanning ||
      this.isInsideUserData(normalizedPath) ||
      this.isUserProtected(normalizedPath) ||
      this.isExcluded(normalizedPath)
    ) {
      return results;
    }

    try {
      const entries = await this.fsOps.readdir(normalizedPath, {
        withFileTypes: true
      });
      if (directoryExcludedByMarker(childFileNames(entries), this.excludeGlobs)) return results;

      for (const entry of entries) {
        if (!this.isScanning) {
          return results;
        }
        if (!entry.isDirectory()) continue;

        const entryResults = await this.processDirectoryEntry(
          entry,
          normalizedPath,
          maxDepth,
          keywords,
          currentDepth
        );

        results.push(...entryResults);
      }
    } catch (err) {
      console.warn(`Cannot access ${normalizedPath}:`, (err as Error).message);
    }

    return results;
  }

  private isInsideUserData(fullPath: string): boolean {
    if (!this.userDataPath) return false;
    const norm = this.normalizePath(fullPath).toLowerCase();
    const user = this.normalizePath(this.userDataPath).toLowerCase();
    return norm === user || norm.startsWith(`${user}/`);
  }

  private isUserProtected(fullPath: string): boolean {
    return isUnderUserPath(fullPath, this.protectedPaths);
  }

  private isExcluded(fullPath: string): boolean {
    return pathMatchesExclude(fullPath, this.excludeGlobs);
  }

  private async excludedByMarker(fullPath: string): Promise<boolean> {
    if (!hasMarkerGlob(this.excludeGlobs)) return false;
    const entries = await this.fsOps.readdir(fullPath, { withFileTypes: true });
    return directoryExcludedByMarker(childFileNames(entries), this.excludeGlobs);
  }

  async scanPaths(
    paths: string[],
    maxDepth: number,
    keywords: string[],
    userDataPath: string,
    protectedPaths: readonly string[] = [],
    excludeGlobs: readonly string[] = []
  ): Promise<Folder[]> {
    const allResults: Folder[] = [];
    this.foundCount = 0;
    this.isScanning = true;
    this.userDataPath = userDataPath;
    this.protectedPaths = protectedPaths;
    this.excludeGlobs = excludeGlobs;

    try {
      // Set the userDataPath for fileUtils
      fileUtils.setUserDataPath(userDataPath);

      for (const basePath of paths) {
        if (!this.isScanning) {
          break;
        }
        const normalizedPath = this.normalizePath(basePath);
        this.messagePort.postMessage({
          type: "current-path",
          path: normalizedPath
        });
        const results = await this.scanDirectory(
          normalizedPath,
          maxDepth,
          keywords
        );
        allResults.push(...results);
        // Send progress update even if no new folders were found
        this.messagePort.postMessage({
          type: "progress",
          count: this.foundCount
        });
      }

      this.isScanning = false;
      this.messagePort.postMessage({ type: "done", results: allResults });
      return allResults;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.messagePort.postMessage({ type: "error", error: errorMessage });
      this.isScanning = false;
      return [];
    }
  }
}

export function initializeWorker(injectedPort: IMessagePort | null = null) {
  const port = injectedPort || parentPort;
  if (!port) throw new Error("Worker thread parent port not available");

  const scanner = new FolderScanner(port);

  port.on("message", async (message: WorkerMessage) => {
    if (message.type === "stop") {
      scanner.stop();
      return;
    }
    await scanner.scanPaths(
      message.paths,
      message.maxDepth,
      message.keywords,
      message.userDataPath,
      message.protectedPaths ?? [],
      message.excludeGlobs ?? []
    );
    scanner.sendFolders(true);
  });
}

function childFileNames(entries: Array<{ name: string; isDirectory?: () => boolean }>): string[] {
  const names: string[] = [];
  for (const entry of entries) {
    if (typeof entry.isDirectory === "function" && entry.isDirectory()) continue;
    names.push(entry.name);
  }
  return names;
}

function hasMarkerGlob(globs: readonly string[]): boolean {
  for (const glob of globs) {
    const trimmed = glob.trim();
    if (trimmed && !trimmed.includes("/") && !trimmed.includes("\\")) return true;
  }
  return false;
}

// Only run worker initialization when this file is being run as a worker thread
if (require.main === module) {
  initializeWorker();
}
