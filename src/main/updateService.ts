import { BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import log from "electron-log";

export class UpdateService {
  private readonly mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.initializeAutoUpdater();
  }

  private initializeAutoUpdater() {
    // Configure logging
    log.transports.file.level = "info";
    autoUpdater.logger = log;

    // Configure update source and options
    autoUpdater.channel = "latest";
    autoUpdater.allowDowngrade = false;
    autoUpdater.setFeedURL({
      provider: "github",
      owner: "Hermesiss",
      repo: "DevNullifier"
    });

    // Platform-specific configurations
    if (process.platform === "win32") {
      autoUpdater.updateConfigPath = "latest.yml";
    } else if (process.platform === "darwin") {
      autoUpdater.updateConfigPath = "latest-mac.yml";
    } else if (process.platform === "linux") {
      autoUpdater.updateConfigPath = "latest-linux.yml";
    }

    // Handle events
    autoUpdater.on("checking-for-update", () => {
      this.sendStatusToWindow("Checking for updates...");
    });

    autoUpdater.on("update-available", info => {
      this.sendStatusToWindow("Update available.", info);
    });

    autoUpdater.on("update-not-available", info => {
      this.sendStatusToWindow("Update not available.", info);
    });

    autoUpdater.on("error", err => {
      this.sendStatusToWindow("Error in auto-updater.", err);
    });

    autoUpdater.on("download-progress", progressObj => {
      this.sendStatusToWindow("Download progress", progressObj);
    });

    autoUpdater.on("update-downloaded", info => {
      this.sendStatusToWindow("Update downloaded", info);
    });
  }

  private sendStatusToWindow(message: string, data?: any) {
    this.mainWindow.webContents.send("update-status", { message, data });
  }

  public checkForUpdates() {
    autoUpdater.checkForUpdates();
  }

  public quitAndInstall() {
    autoUpdater.quitAndInstall();
  }
}
