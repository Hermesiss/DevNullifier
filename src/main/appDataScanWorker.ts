import { parentPort } from "worker_threads";
import path from "path";
import { promises as fs } from "fs";
import { Dirent } from "fs";
import { getDirSize } from "./fileUtils";

interface Folder {
  path: string;
  size: number;
  name: string;
}

interface WorkerMessage {
  paths: string[];
  maxDepth: number;
  keywords: string[];
}

type WorkerResponse =
  | { type: "folder-found"; folder: Folder }
  | { type: "current-path"; path: string }
  | { type: "progress"; count: number }
  | { type: "done"; results: Folder[] }
  | { type: "error"; error: string };

// Process a single directory entry
async function processDirectoryEntry(
  entry: Dirent,
  dirPath: string,
  maxDepth: number,
  keywords: string[],
  currentDepth: number
): Promise<Folder[]> {
  const results: Folder[] = [];
  const fullPath = path.join(dirPath, entry.name);
  const folderName = entry.name.toLowerCase();

  // Check if folder name contains any keywords
  if (keywords.some(keyword => folderName.includes(keyword))) {
    try {
      const size = await getDirSize(fullPath);
      if (size > 0) {
        const folder: Folder = {
          path: fullPath,
          size: size,
          name: entry.name
        };
        results.push(folder);
        port.postMessage({ type: "folder-found", folder } as WorkerResponse);
      }
    } catch (err) {
      console.warn(`Cannot access ${fullPath}:`, (err as Error).message);
    }
    return results;
  }

  // Recurse into subdirectories
  try {
    const subResults = await scanDirectory(
      fullPath,
      maxDepth,
      keywords,
      currentDepth + 1
    );
    results.push(...subResults);
  } catch (err) {
    console.warn(`Cannot access ${fullPath}:`, (err as Error).message);
  }

  return results;
}

// Scan directories for matching folders
async function scanDirectory(
  dirPath: string,
  maxDepth: number,
  keywords: string[],
  currentDepth = 0
): Promise<Folder[]> {
  const results: Folder[] = [];

  if (maxDepth > 0 && currentDepth > maxDepth) {
    return results;
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const entryResults = await processDirectoryEntry(
        entry,
        dirPath,
        maxDepth,
        keywords,
        currentDepth
      );
      results.push(...entryResults);
    }
  } catch (err) {
    console.warn(`Cannot access ${dirPath}:`, (err as Error).message);
  }

  return results;
}

// Listen for messages from the main thread
if (!parentPort) {
  throw new Error("Worker thread parent port not available");
}

const port = parentPort;
port.on("message", async (message: WorkerMessage) => {
  const { paths, maxDepth, keywords } = message;
  const allResults: Folder[] = [];
  let totalCount = 0;

  try {
    for (const basePath of paths) {
      port.postMessage(
        { type: "current-path", path: basePath } as WorkerResponse
      );
      const results = await scanDirectory(basePath, maxDepth, keywords);
      allResults.push(...results);
      totalCount += results.length;
      port.postMessage(
        { type: "progress", count: totalCount } as WorkerResponse
      );
    }

    port.postMessage({ type: "done", results: allResults } as WorkerResponse);
  } catch (error) {
    port.postMessage(
      { type: "error", error: (error as Error).message } as WorkerResponse
    );
  }
});
