const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Get AppData paths
  getAppDataPaths: () => ipcRenderer.invoke("get-appdata-paths"),

  // Scan for folders
  scanFolders: (paths, maxDepth) =>
    ipcRenderer.invoke("scan-folders", { paths, maxDepth }),

  // Delete folders
  deleteFolders: folderPaths =>
    ipcRenderer.invoke("delete-folders", folderPaths),

  // Check admin privileges
  checkAdmin: () => ipcRenderer.invoke("check-admin"),

  // Listen for scan progress
  onScanProgress: callback => {
    ipcRenderer.on("scan-progress", (event, count) => callback(count));
  },

  // Listen for current path being scanned
  onScanCurrentPath: callback => {
    ipcRenderer.on("scan-current-path", (event, path) => callback(path));
  },

  // Listen for delete progress
  onDeleteProgress: callback => {
    ipcRenderer.on("delete-progress", (event, count) => callback(count));
  },

  // Listen for scan-folder-found (real-time folder updates)
  onScanFolderFound: callback => {
    ipcRenderer.on("scan-folder-found", (event, folder) => callback(folder));
  },

  // Remove listeners
  removeAllListeners: channel => {
    ipcRenderer.removeAllListeners(channel);
  }
});
