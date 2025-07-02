const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Get AppData paths
  getAppDataPaths: () => ipcRenderer.invoke("get-appdata-paths"),

  // Scan for folders
  scanFolders: (paths, maxDepth) =>
    ipcRenderer.invoke("scan-folders", { paths, maxDepth }),

  // Scan for developer caches
  scanDeveloperCaches: (basePaths, enabledCategories) =>
    ipcRenderer.invoke("scan-developer-caches", {
      basePaths,
      enabledCategories
    }),

  // Stop scanning
  stopScan: () => ipcRenderer.invoke("stop-scan"),

  // Stop developer scanning
  stopDeveloperScan: () => ipcRenderer.invoke("stop-developer-scan"),

  // Delete folders
  deleteFolders: folderPaths =>
    ipcRenderer.invoke("delete-folders", folderPaths),

  // Check admin privileges
  checkAdmin: () => ipcRenderer.invoke("check-admin"),

  // Select directory
  selectDirectory: () => ipcRenderer.invoke("select-directory"),

  // Get user home directory
  getUserHome: () => ipcRenderer.invoke("get-user-home"),

  // Get folder contents
  getFolderContents: folderPath =>
    ipcRenderer.invoke("get-folder-contents", folderPath),

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

  // Listen for developer-project-found (real-time project updates)
  onDeveloperProjectFound: callback => {
    ipcRenderer.on("developer-project-found", (event, project) =>
      callback(project)
    );
  },

  // Remove listeners
  removeAllListeners: channel => {
    ipcRenderer.removeAllListeners(channel);
  }
});
