import { BrowserWindow, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import log from "electron-log";

export class UpdateService {
  private readonly mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.initializeAutoUpdater();
    this.setupIpcHandlers();
  }

  private setupIpcHandlers() {
    ipcMain.handle(
      "set-update-channel",
      (_, channel: "latest" | "latest-develop") => {
        this.setUpdateChannel(channel);
      }
    );
  }

  private setUpdateChannel(channel: "latest" | "latest-develop") {
    autoUpdater.allowPrerelease = channel === "latest-develop";

    let baseUrl =
      channel === "latest"
        ? "https://github.com/Hermesiss/DevNullifier/releases/latest/download/"
        : "https://github.com/Hermesiss/DevNullifier/releases/download/latest-dev/";

    autoUpdater.setFeedURL(baseUrl);

    // Set platform-specific update config path
    // if (process.platform === "win32") {
    //   autoUpdater.updateConfigPath = baseUrl + "latest.yml";
    // } else if (process.platform === "darwin") {
    //   autoUpdater.updateConfigPath = baseUrl + "latest-mac.yml";
    // } else if (process.platform === "linux") {
    //   autoUpdater.updateConfigPath = baseUrl + "latest-linux.yml";
    // }
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
