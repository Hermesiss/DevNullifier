import { vi, describe, it, expect, beforeEach } from "vitest";
import { UpdateService } from "../updateService";
import { BrowserWindow } from "electron";
import { autoUpdater, UpdateInfo, ProgressInfo } from "electron-updater";
import log from "electron-log";

// Mock modules
vi.mock("electron", () => ({
  BrowserWindow: vi.fn()
}));

type UpdaterEvents = {
  "checking-for-update": () => void;
  "update-available": (info: UpdateInfo) => void;
  "update-not-available": (info: UpdateInfo) => void;
  "error": (error: Error) => void;
  "download-progress": (progress: ProgressInfo) => void;
  "update-downloaded": (info: UpdateInfo) => void;
};

vi.mock("electron-updater", () => ({
  autoUpdater: {
    logger: undefined,
    setFeedURL: vi.fn(),
    checkForUpdates: vi.fn(),
    quitAndInstall: vi.fn(),
    on: vi.fn(<K extends keyof UpdaterEvents>(event: K, callback: UpdaterEvents[K]) => {
      // Store the callback for later use in tests
      return callback;
    })
  },
  UpdateInfo: vi.fn(),
  ProgressInfo: vi.fn()
}));

vi.mock("electron-log", () => ({
  default: {
    transports: {
      file: {
        level: undefined
      }
    }
  }
}));

describe("UpdateService", () => {
  let updateService: UpdateService;
  let mockMainWindow: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock window
    mockMainWindow = {
      webContents: {
        send: vi.fn()
      }
    };

    // Create new instance for each test
    updateService = new UpdateService(mockMainWindow as BrowserWindow);
  });

  describe("initialization", () => {
    it("should configure logging and update source correctly", () => {
      expect(log.transports.file.level).toBe("info");
      expect(autoUpdater.logger).toBe(log);
      expect(autoUpdater.setFeedURL).toHaveBeenCalledWith({
        provider: "github",
        owner: "Hermesiss",
        repo: "DevNullifier"
      });
    });

    it("should set up all required event listeners", () => {
      expect(vi.mocked(autoUpdater.on)).toHaveBeenCalledTimes(6);
      expect(vi.mocked(autoUpdater.on)).toHaveBeenCalledWith("checking-for-update", expect.any(Function));
      expect(vi.mocked(autoUpdater.on)).toHaveBeenCalledWith("update-available", expect.any(Function));
      expect(vi.mocked(autoUpdater.on)).toHaveBeenCalledWith("update-not-available", expect.any(Function));
      expect(vi.mocked(autoUpdater.on)).toHaveBeenCalledWith("error", expect.any(Function));
      expect(vi.mocked(autoUpdater.on)).toHaveBeenCalledWith("download-progress", expect.any(Function));
      expect(vi.mocked(autoUpdater.on)).toHaveBeenCalledWith("update-downloaded", expect.any(Function));
    });
  });

  describe("event handlers", () => {
    it("should send status to window when checking for updates", () => {
      const checkingCallback = vi.mocked(autoUpdater.on).mock.calls.find(
        call => call[0] === "checking-for-update"
      )?.[1] as UpdaterEvents["checking-for-update"];
      
      checkingCallback();
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        "update-status",
        { message: "Checking for updates...", data: undefined }
      );
    });

    it("should send status to window when update is available", () => {
      const updateInfo = { version: "1.0.0" } as UpdateInfo;
      const availableCallback = vi.mocked(autoUpdater.on).mock.calls.find(
        call => call[0] === "update-available"
      )?.[1] as UpdaterEvents["update-available"];
      
      availableCallback(updateInfo);
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        "update-status",
        { message: "Update available.", data: updateInfo }
      );
    });

    it("should send status to window when update is not available", () => {
      const updateInfo = { version: "1.0.0" } as UpdateInfo;
      const notAvailableCallback = vi.mocked(autoUpdater.on).mock.calls.find(
        call => call[0] === "update-not-available"
      )?.[1] as UpdaterEvents["update-not-available"];
      
      notAvailableCallback(updateInfo);
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        "update-status",
        { message: "Update not available.", data: updateInfo }
      );
    });

    it("should send status to window when error occurs", () => {
      const error = new Error("Update failed");
      const errorCallback = vi.mocked(autoUpdater.on).mock.calls.find(
        call => call[0] === "error"
      )?.[1] as UpdaterEvents["error"];
      
      errorCallback(error);
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        "update-status",
        { message: "Error in auto-updater.", data: error }
      );
    });

    it("should send status to window for download progress", () => {
      const progress = { percent: 50 } as ProgressInfo;
      const progressCallback = vi.mocked(autoUpdater.on).mock.calls.find(
        call => call[0] === "download-progress"
      )?.[1] as UpdaterEvents["download-progress"];
      
      progressCallback(progress);
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        "update-status",
        { message: "Download progress", data: progress }
      );
    });

    it("should send status to window when update is downloaded", () => {
      const updateInfo = { version: "1.0.0" } as UpdateInfo;
      const downloadedCallback = vi.mocked(autoUpdater.on).mock.calls.find(
        call => call[0] === "update-downloaded"
      )?.[1] as UpdaterEvents["update-downloaded"];
      
      downloadedCallback(updateInfo);
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        "update-status",
        { message: "Update downloaded", data: updateInfo }
      );
    });
  });

  describe("public methods", () => {
    it("should call checkForUpdates on autoUpdater", () => {
      updateService.checkForUpdates();
      expect(autoUpdater.checkForUpdates).toHaveBeenCalled();
    });

    it("should call quitAndInstall on autoUpdater", () => {
      updateService.quitAndInstall();
      expect(autoUpdater.quitAndInstall).toHaveBeenCalled();
    });
  });
}); 