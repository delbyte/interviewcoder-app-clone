const { ipcMain, shell, dialog } = require('electron');
const { PermissionHelper } = require('./PermissionHelper');
const { store } = require('./store');

function initializeIpcHandlers(deps) {
  console.log("Initializing IPC handlers");

  ipcMain.handle("get-platform", () => {
    console.log("get-platform handler called, returning:", process.platform);
    return process.platform;
  });

  ipcMain.handle("quit-app", () => {
    console.log("Quit app requested from renderer");
    const allWindows = require('electron').BrowserWindow.getAllWindows();
    console.log(`Closing ${allWindows.length} windows`);
    allWindows.forEach(window => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    require('electron').app.quit();
  });

  ipcMain.handle("reboot-app", () => {
    console.log("Reboot app requested from renderer");
    const allWindows = require('electron').BrowserWindow.getAllWindows();
    console.log(`Closing ${allWindows.length} windows for reboot`);
    allWindows.forEach(window => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    require('electron').app.relaunch();
    setTimeout(() => {
      process.exit(0);
    }, 500);
  });

  ipcMain.handle("update-content-dimensions", async (_event, { width, height }) => {
    if (width && height) {
      deps.setWindowDimensions(width, height);
    }
  });

  ipcMain.handle("get-screenshots", async () => {
    try {
      let previews = [];
      const currentView = deps.getView();
      console.log("get-screenshots called - current view:", currentView);
      if (currentView === "queue") {
        const queue = deps.getScreenshotQueue();
        console.log("Getting main queue screenshots, count:", queue.length);
        previews = await Promise.all(queue.map(async (path) => ({
          path,
          preview: await deps.getImagePreview(path),
        })));
      } else {
        const extraQueue = deps.getExtraScreenshotQueue();
        console.log("Getting extra queue screenshots, count:", extraQueue.length);
        previews = await Promise.all(extraQueue.map(async (path) => ({
          path,
          preview: await deps.getImagePreview(path),
        })));
      }
      console.log("Returning screenshots, count:", previews.length);
      return {
        success: true,
        previews: previews || [],
      };
    } catch (error) {
      console.error("Error getting screenshots:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        previews: [],
      };
    }
  });

  ipcMain.handle("open-settings-portal", () => {
    shell.openExternal("https://www.interviewcoder.co/settings");
  });

  ipcMain.handle("open-subscription-portal", async () => {
    try {
      const url = "https://www.interviewcoder.co/checkout";
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error("Error opening page:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to open page",
      };
    }
  });

  ipcMain.handle("set-ignore-mouse-events", (_event, ignore, options) => {
    const win = deps.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(ignore, options);
    }
  });

  ipcMain.handle("get-permission-status", async () => {
    try {
      return PermissionHelper.getAllPermissionStatus();
    } catch (error) {
      console.error("Error in get-permission-status handler:", error);
      return {
        screenRecording: 'unknown',
        appName: 'Interview Coder',
        isDevelopment: false
      };
    }
  });

  ipcMain.handle("request-screen-recording-permission", async () => {
    try {
      console.log("request-screen-recording-permission handler called");
      await PermissionHelper.requestScreenRecordingPermission();
    } catch (error) {
      console.error("Error in request-screen-recording-permission handler:", error);
    }
  });

  ipcMain.handle("open-screen-recording-settings", async () => {
    try {
      console.log("open-screen-recording-settings handler called");
      await PermissionHelper.openScreenRecordingSettings();
    } catch (error) {
      console.error("Error in open-screen-recording-settings handler:", error);
    }
  });

  ipcMain.handle("open-system-preferences", async () => {
    try {
      console.log("open-system-preferences handler called");
      await PermissionHelper.openSystemPreferences();
    } catch (error) {
      console.error("Error in open-system-preferences handler:", error);
    }
  });

  ipcMain.handle("show-welcome-permission-dialog", async () => {
    try {
      console.log("show-welcome-permission-dialog handler called");
      return await PermissionHelper.showWelcomePermissionDialog();
    } catch (error) {
      console.error("Error in show-welcome-permission-dialog handler:", error);
      return 'continue';
    }
  });

  ipcMain.handle("show-permission-window", async () => {
    try {
      console.log("show-permission-window handler called");
      deps.showPermissionWindow();
    } catch (error) {
      console.error("Error in show-permission-window handler:", error);
    }
  });

  ipcMain.handle("hide-permission-window", async () => {
    try {
      console.log("hide-permission-window handler called");
      deps.hidePermissionWindow();
    } catch (error) {
      console.error("Error in hide-permission-window handler:", error);
    }
  });

  ipcMain.on("permission-get-started", () => {
    try {
      console.log("permission-get-started event received, forwarding to main window");
      const mainWindow = deps.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('permission-get-started');
      }
      deps.showFloatingWindow();
    } catch (error) {
      console.error("Error forwarding permission-get-started event:", error);
    }
  });

  ipcMain.handle("hide-floating-window", () => {
    try {
      console.log("hide-floating-window handler called");
      deps.hideFloatingWindow();
    } catch (error) {
      console.error("Error hiding floating window:", error);
    }
  });

  ipcMain.handle("show-floating-window", () => {
    try {
      console.log("show-floating-window handler called");
      deps.showFloatingWindow();
    } catch (error) {
      console.error("Error showing floating window:", error);
    }
  });

  ipcMain.on("permission-flow-completed", () => {
    try {
      console.log("permission-flow-completed event received, forwarding to floating window");
      const mainWindow = deps.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send("permission-flow-completed");
      }
    } catch (error) {
      console.error("Error forwarding permission-flow-completed event:", error);
    }
  });

  ipcMain.handle("log-error", (_event, errorData) => {
    console.error("REACT ERROR BOUNDARY TRIGGERED");
    console.error(`Timestamp: ${errorData.timestamp}`);
    console.error(`Error name: ${errorData.name || 'Unknown'}`);
    console.error(`Error message: ${errorData.message}`);
    if (errorData.stack) {
      console.error(`Stack trace:\n${errorData.stack}`);
    }
    if (errorData.componentStack) {
      console.error(`Component stack:\n${errorData.componentStack}`);
    }
    console.error("END ERROR REPORT");
  });

  ipcMain.handle("open-main-panel", async () => {
    try {
      console.log("open-main-panel handler called");
      deps.showMainPanel();
    } catch (error) {
      console.error("Error in open-main-panel handler:", error);
    }
  });

  ipcMain.handle("hide-main-panel", async () => {
    try {
      console.log("hide-main-panel handler called");
      deps.hideMainPanel();
    } catch (error) {
      console.error("Error in hide-main-panel handler:", error);
    }
  });

  ipcMain.handle("start-onboarding-flow", async () => {
    try {
      console.log("start-onboarding-flow handler called");
      deps.broadcastOnboardingState({ isActive: true, step: 'screenshot' });
    } catch (error) {
      console.error("Error in start-onboarding-flow handler:", error);
    }
  });

  ipcMain.handle("get-storage-value", async (_event, key) => {
    try {
      return store.get(key);
    } catch (error) {
      console.error(`Error getting "${key}" from store:`, error);
      return undefined;
    }
  });

  ipcMain.handle("set-storage-value", async (_event, key, value) => {
    try {
      console.log(`Setting "${key}" to:`, value);
      store.set(key, value);
      return true;
    } catch (error) {
      console.error(`Error setting "${key}" in store:`, error);
      return false;
    }
  });
}

module.exports = { initializeIpcHandlers };