const { systemPreferences } = require('electron');

class PermissionHelper {
  static getAppInfo() {
    const appName = require('electron').app.getName();
    const isDev = process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged;
    return {
      name: appName,
      isDevelopment: isDev
    };
  }

  static checkScreenRecordingPermission() {
    try {
      if (process.platform === "darwin") {
        const status = systemPreferences.getMediaAccessStatus("screen");
        return status === "granted";
      }
      return true;
    } catch (error) {
      console.error("Error checking screen recording permission:", error);
      return true;
    }
  }

  static getAllPermissionStatus() {
    try {
      const appInfo = this.getAppInfo();
      if (process.platform !== "darwin") {
        return {
          screenRecording: 'granted',
          appName: appInfo.name,
          isDevelopment: appInfo.isDevelopment
        };
      }
      const screenRecordingStatus = systemPreferences.getMediaAccessStatus("screen");
      const status = {
        screenRecording: screenRecordingStatus,
        appName: appInfo.name,
        isDevelopment: appInfo.isDevelopment
      };
      return status;
    } catch (error) {
      console.error("Error getting permission status:", error);
      // Fallback status to prevent app crash
      return {
        screenRecording: 'granted',
        appName: 'Interview Coder',
        isDevelopment: false
      };
    }
  }

  static async requestScreenRecordingPermission() {
    try {
      if (process.platform === "darwin") {
        // This will trigger the system permission dialog
        systemPreferences.getMediaAccessStatus("screen");
      }
    } catch (error) {
      console.error("Error requesting screen recording permission:", error);
    }
  }

  static async openScreenRecordingSettings() {
    try {
      if (process.platform === "darwin") {
        await require('electron').shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
      }
    } catch (error) {
      console.error("Error opening screen recording settings:", error);
    }
  }

  static async openSystemPreferences() {
    try {
      if (process.platform === "darwin") {
        await require('electron').shell.openExternal("x-apple.systempreferences:com.apple.preference.security");
      }
    } catch (error) {
      console.error("Error opening system preferences:", error);
    }
  }

  static async showPermissionDialog() {
    try {
      if (process.platform !== "darwin") {
        return true;
      }
      const { dialog } = require('electron');
      const result = await dialog.showMessageBox({
        type: "info",
        title: "Screen Recording Permission Required",
        message: "Interview Coder needs screen recording permission to capture screenshots",
        detail: "Click 'Open System Preferences' to grant permission, then restart the app",
        buttons: ["Open System Preferences", "Skip"],
        defaultId: 0,
        cancelId: 1
      });
      if (result.response === 0) {
        await this.openScreenRecordingSettings();
        return false; // needs restart
      }
      return false; // user skipped
    } catch (error) {
      console.error("Error showing permission dialog:", error);
      return true; // Fallback to continue
    }
  }

  static async showWelcomePermissionDialog() {
    try {
      if (process.platform !== "darwin") {
        return 'continue';
      }
      const { dialog } = require('electron');
      const permissions = this.getAllPermissionStatus();
      const needsPermissions = permissions.screenRecording !== 'granted';
      if (!needsPermissions) {
        return 'continue';
      }
      const appInfo = this.getAppInfo();
      const appDisplayName = appInfo.isDevelopment ? 'Interview Coder (Development)' : 'Interview Coder';
      const result = await dialog.showMessageBox({
        type: "info",
        title: `Welcome to ${appDisplayName}!`,
        message: `Before you can start using ${appDisplayName}, we need to ask you for a few permissions.`,
        detail: "These permissions are required for the app to capture screenshots and provide keyboard shortcuts during interviews.",
        buttons: ["Continue to Permissions", "Skip Setup"],
        defaultId: 0,
        cancelId: 1
      });
      return result.response === 0 ? 'continue' : 'skip';
    } catch (error) {
      console.error("Error showing welcome permission dialog:", error);
      return 'continue'; // Safe fallback
    }
  }
}

module.exports = { PermissionHelper };