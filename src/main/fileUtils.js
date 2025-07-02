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
          // Skip files that can't be accessed
        }
      }
    }
  } catch (err) {
    // Skip directories that can't be accessed
  }

  return size;
}

module.exports = {
  getDirSize
};
