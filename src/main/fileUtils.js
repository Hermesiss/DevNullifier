const fs = require("fs").promises;
const path = require("path");

// Calculate directory size recursively
async function getDirSize(dirPath) {
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

module.exports = {
  getDirSize
};
