import { promises as fs } from "fs";
import path from "path";

// Calculate directory size recursively
export async function getDirSize(dirPath: string): Promise<number> {
  let size = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        size += await getDirSize(fullPath);
      } else {
        try {
          const stats = await fs.stat(fullPath);
          size += stats.size;
        } catch (err) {
          console.warn("Error getting file size:", err);
        }
      }
    }
  } catch (err) {
    console.warn("Error getting directory size:", err);
  }

  return size;
}
