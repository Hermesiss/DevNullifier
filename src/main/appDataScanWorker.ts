import { parentPort } from "worker_threads";
import path from "path";
import { promises as fs, Dirent } from "fs";
import { getDirSize } from "./fileUtils";

export interface Folder {
  path: string;
  size: number;
  name: string;
}

export interface WorkerMessage {
  paths: string[];
  maxDepth: number;
  keywords: string[];
}

export type WorkerResponse =
  | { type: "folder-found"; folder: Folder }
  | { type: "current-path"; path: string }
  | { type: "progress"; count: number }
  | { type: "done"; results: Folder[] }
  | { type: "error"; error: string };

export interface IMessagePort {
  postMessage(message: WorkerResponse): void;
}

export class FolderScanner {
  private foundCount = 0;

  constructor(
    private readonly messagePort: IMessagePort,
    private readonly fsOps = {
      readdir: fs.readdir,
      getDirSize
    }
  ) {}

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
    const fullPath = this.normalizePath(path.join(dirPath, entry.name));
    const folderName = entry.name.toLowerCase();

    try {
      // Check if folder name contains any keywords
      if (keywords.some(keyword => folderName.includes(keyword))) {
        const size = await this.fsOps.getDirSize(fullPath);
        if (size > 0) {
          const folder: Folder = {
            path: fullPath,
            size,
            name: entry.name
          };
          results.push(folder);
          this.foundCount++;
          this.messagePort.postMessage({ type: "folder-found", folder });
          this.messagePort.postMessage({
            type: "progress",
            count: this.foundCount
          });
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

  private async scanDirectory(
    dirPath: string,
    maxDepth: number,
    keywords: string[],
    currentDepth = 0
  ): Promise<Folder[]> {
    const results: Folder[] = [];
    const normalizedPath = this.normalizePath(dirPath);

    try {
      const entries = await this.fsOps.readdir(normalizedPath, {
        withFileTypes: true
      });

      for (const entry of entries) {
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

  async scanPaths(
    paths: string[],
    maxDepth: number,
    keywords: string[]
  ): Promise<Folder[]> {
    const allResults: Folder[] = [];
    this.foundCount = 0;

    try {
      for (const basePath of paths) {
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

      this.messagePort.postMessage({ type: "done", results: allResults });
      return allResults;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.messagePort.postMessage({ type: "error", error: errorMessage });
      return [];
    }
  }
}

export function initializeWorker() {
  if (!parentPort) {
    throw new Error("Worker thread parent port not available");
  }

  const scanner = new FolderScanner(parentPort);

  parentPort.on("message", async (message: WorkerMessage) => {
    await scanner.scanPaths(message.paths, message.maxDepth, message.keywords);
  });
}

// Only run worker initialization when this file is being run as a worker thread
if (require.main === module) {
  initializeWorker();
}
