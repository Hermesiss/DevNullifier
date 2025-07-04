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
  type: "scan" | "stop";
  paths: string[];
  maxDepth: number;
  keywords: string[];
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
  private readonly maxFoldersPerMessage = 20;

  constructor(
    private readonly messagePort: IMessagePort,
    private readonly fsOps = {
      readdir: fs.readdir,
      getDirSize
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
    if (!this.isScanning) {
      return results;
    }

    try {
      const entries = await this.fsOps.readdir(normalizedPath, {
        withFileTypes: true
      });

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

  async scanPaths(
    paths: string[],
    maxDepth: number,
    keywords: string[]
  ): Promise<Folder[]> {
    const allResults: Folder[] = [];
    this.foundCount = 0;
    this.isScanning = true;

    try {
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
    await scanner.scanPaths(message.paths, message.maxDepth, message.keywords);
    scanner.sendFolders(true);
  });
}

// Only run worker initialization when this file is being run as a worker thread
if (require.main === module) {
  initializeWorker();
}
