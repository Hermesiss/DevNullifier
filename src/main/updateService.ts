import { BrowserWindow, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import log from "electron-log";

let updateChannelRegistered = false;

const githubFeed = {
  provider: "github" as const,
  owner: "Hermesiss",
  repo: "DevNullifier"
};

export class UpdateService {
  private readonly mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.initializeAutoUpdater();
    this.setupIpcHandlers();
  }

  private setupIpcHandlers() {
    if (updateChannelRegistered) return;
    updateChannelRegistered = true;
    ipcMain.handle(
      "set-update-channel",
      (_, channel: "latest" | "latest-dev") => {
        this.setUpdateChannel(channel);
      }
    );
  }

  public setUpdateChannel(channel: "latest" | "latest-dev") {
    autoUpdater.allowPrerelease = channel === "latest-dev";
    autoUpdater.setFeedURL(githubFeed);
  }

  private initializeAutoUpdater() {
    // Configure logging
    log.transports.file.level = "info";
    autoUpdater.logger = log;

    // Configure update source and options
    autoUpdater.allowDowngrade = false;

    // Set update channel after config path
    this.setUpdateChannel("latest");

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
