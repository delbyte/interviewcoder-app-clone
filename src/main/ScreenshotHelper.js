const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { v4: uuidv4 } = require('uuid');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

class ScreenshotHelper {
  constructor(view = "queue") {
    this.screenshotQueue = [];
    this.extraScreenshotQueue = [];
    this.MAX_SCREENSHOTS = 2;
    this.view = "queue";

    // Screenshot spam protection properties
    this.isCapturingScreenshot = false;
    this.lastScreenshotTime = 0;
    this.MIN_SCREENSHOT_INTERVAL = 500;
    this.screenshotAttempts = [];
    this.MAX_ATTEMPTS_PER_WINDOW = 5;
    this.RATE_LIMIT_WINDOW = 10000;

    this.view = view;

    // Initialize directories
    this.screenshotDir = path.join(app.getPath("userData"), "screenshots");
    this.extraScreenshotDir = path.join(app.getPath("userData"), "extra_screenshots");

    // Create directories if they don't exist
    try {
      if (!fs.existsSync(this.screenshotDir)) {
        fs.mkdirSync(this.screenshotDir, { recursive: true });
      }
      if (!fs.existsSync(this.extraScreenshotDir)) {
        fs.mkdirSync(this.extraScreenshotDir, { recursive: true });
      }
      console.log("Screenshot directories initialized:", {
        screenshotDir: this.screenshotDir,
        extraScreenshotDir: this.extraScreenshotDir
      });
    } catch (error) {
      console.error("Failed to create screenshot directories:", error);
      throw new Error(`Failed to initialize screenshot directories: ${error.message}`);
    }
  }

  getView() {
    return this.view;
  }

  setView(view) {
    console.log("Setting view in ScreenshotHelper:", view);
    console.log("Current queues - Main:", this.screenshotQueue, "Extra:", this.extraScreenshotQueue);
    this.view = view;
    if (view === "queue" && this.extraScreenshotQueue) {
      this.clearExtraScreenshotQueue();
    }
  }

  getScreenshotQueue() {
    return this.screenshotQueue;
  }

  getExtraScreenshotQueue() {
    console.log("Getting extra screenshot queue:", this.extraScreenshotQueue);
    return this.extraScreenshotQueue;
  }

  clearQueues() {
    console.log("Clearing all screenshot queues...");
    this.screenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err) console.error(`Error deleting screenshot at ${screenshotPath}:`, err);
      });
    });
    this.screenshotQueue = [];
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err) console.error(`Error deleting extra screenshot at ${screenshotPath}:`, err);
      });
    });
    this.extraScreenshotQueue = [];
    this.isCapturingScreenshot = false;
    this.lastScreenshotTime = 0;
    this.screenshotAttempts = [];
    console.log("All queues cleared and spam protection state reset");
  }

  checkScreenRecordingPermission() {
    if (process.platform === "darwin") {
      return require('./PermissionHelper').PermissionHelper.checkScreenRecordingPermission();
    }
    return true;
  }

  async captureScreenshotMac() {
    if (!this.checkScreenRecordingPermission()) {
      throw new Error("Screen recording permission not granted. Please enable it in System Preferences > Security & Privacy > Privacy > Screen Recording");
    }
    const tmpPath = path.join(app.getPath("temp"), `${uuidv4()}.png`);
    console.log("Capturing screenshot to temporary path:", tmpPath);
    try {
      const { stdout, stderr } = await execFileAsync("screencapture", ["-x", tmpPath]);
      if (stderr) {
        console.warn("screencapture stderr:", stderr);
      }
      if (!fs.existsSync(tmpPath)) {
        throw new Error("Screenshot file was not created by screencapture command");
      }
      const buffer = fs.readFileSync(tmpPath);
      console.log(`Screenshot file read successfully: ${buffer.length} bytes`);
      try {
        fs.unlinkSync(tmpPath);
        console.log("Temporary screenshot file cleaned up");
      } catch (cleanupError) {
        console.warn("Failed to clean up temporary screenshot file:", cleanupError);
      }
      return buffer;
    } catch (error) {
      console.error("Error capturing screenshot on macOS:", error);
      try {
        if (fs.existsSync(tmpPath)) {
          fs.unlinkSync(tmpPath);
        }
      } catch (cleanupError) {
        console.warn("Failed to clean up temporary file after error:", cleanupError);
      }
      throw new Error(`Failed to capture screenshot: ${error.message}`);
    }
  }

  async captureScreenshotWindows() {
    const tmpPath = path.join(app.getPath("temp"), `${uuidv4()}.png`);
    const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$bitmap = New-Object System.Drawing.Bitmap $screen.Bounds.Width, $screen.Bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Bounds.X, $screen.Bounds.Y, 0, 0, $bitmap.Size)
$bitmap.Save('${tmpPath.replace(/\\/g, "\\\\")}')
$graphics.Dispose()
$bitmap.Dispose()
`;
    const powerShellPaths = [
      "powershell",
      "powershell.exe",
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
      "pwsh",
      "pwsh.exe"
    ];
    let lastError = null;
    for (const psPath of powerShellPaths) {
      try {
        console.log(`Attempting to use PowerShell at: ${psPath}`);
        await execFileAsync(psPath, ["-command", script]);
        const buffer = fs.readFileSync(tmpPath);
        try {
          fs.unlinkSync(tmpPath);
        } catch (cleanupError) {
          console.warn("Failed to clean up temp file:", cleanupError);
        }
        console.log(`Screenshot captured successfully using ${psPath}`);
        return buffer;
      } catch (error) {
        console.warn(`Failed to use PowerShell at ${psPath}:`, error.message);
        lastError = error;
        try {
          if (fs.existsSync(tmpPath)) {
            fs.unlinkSync(tmpPath);
          }
        } catch (cleanupError) {
        }
        continue;
      }
    }
    throw new Error(`PowerShell not found. Tried all common locations. Last error: ${lastError?.message || 'Unknown error'}. Please ensure PowerShell is installed and accessible.`);
  }

  isRateLimited() {
    const now = Date.now();
    this.screenshotAttempts = this.screenshotAttempts.filter(attempt => now - attempt < this.RATE_LIMIT_WINDOW);
    if (this.screenshotAttempts.length >= this.MAX_ATTEMPTS_PER_WINDOW) {
      console.warn(`Screenshot rate limit exceeded: ${this.screenshotAttempts.length} attempts in ${this.RATE_LIMIT_WINDOW}ms window`);
      return true;
    }
    return false;
  }

  isThrottled() {
    const now = Date.now();
    const timeSinceLastScreenshot = now - this.lastScreenshotTime;
    if (timeSinceLastScreenshot < this.MIN_SCREENSHOT_INTERVAL) {
      console.log(`Screenshot throttled: ${timeSinceLastScreenshot}ms since last screenshot (min: ${this.MIN_SCREENSHOT_INTERVAL}ms)`);
      return true;
    }
    return false;
  }

  recordScreenshotAttempt() {
    this.screenshotAttempts.push(Date.now());
  }

  async takeScreenshot() {
    console.log("Screenshot requested in view:", this.view);
    if (this.isCapturingScreenshot) {
      const error = "Screenshot already in progress. Please wait for the current screenshot to complete.";
      console.warn("Screenshot rejected: Already capturing");
      throw new Error(error);
    }
    if (this.isRateLimited()) {
      const error = `Too many screenshot attempts. Please wait before taking another screenshot. (Max ${this.MAX_ATTEMPTS_PER_WINDOW} per ${this.RATE_LIMIT_WINDOW / 1000} seconds)`;
      console.warn("Screenshot rejected: Rate limited");
      throw new Error(error);
    }
    if (this.isThrottled()) {
      const remainingTime = Math.ceil((this.MIN_SCREENSHOT_INTERVAL - (Date.now() - this.lastScreenshotTime)) / 1000);
      const error = `Please wait ${remainingTime} second(s) before taking another screenshot.`;
      console.warn("Screenshot rejected: Throttled");
      throw new Error(error);
    }
    this.recordScreenshotAttempt();
    this.isCapturingScreenshot = true;
    console.log("Screenshot protection checks passed, proceeding with capture...");
    let screenshotPath = "";
    try {
      if (process.platform === "darwin" && !this.checkScreenRecordingPermission()) {
        throw new Error("Screen recording permission not granted. Please enable it in System Preferences > Security & Privacy > Privacy > Screen Recording");
      }
      console.log("Capturing screenshot using native OS methods...");
      const screenshotBuffer = process.platform === "darwin"
        ? await this.captureScreenshotMac()
        : await this.captureScreenshotWindows();
      console.log(`Screenshot captured successfully (${screenshotBuffer.length} bytes)`);
      this.lastScreenshotTime = Date.now();
      if (this.view === "queue") {
        screenshotPath = path.join(this.screenshotDir, `${uuidv4()}.png`);
        try {
          fs.writeFileSync(screenshotPath, screenshotBuffer);
          console.log("Successfully saved screenshot to main queue:", screenshotPath);
          this.screenshotQueue.push(screenshotPath);
        } catch (saveError) {
          console.error("Failed to save screenshot to main queue:", saveError);
          throw new Error(`Failed to save screenshot: ${saveError.message}`);
        }
        if (this.screenshotQueue.length > this.MAX_SCREENSHOTS) {
          const removedPath = this.screenshotQueue.shift();
          if (removedPath) {
            try {
              fs.unlinkSync(removedPath);
              console.log("Removed old screenshot from main queue to maintain size limit:", removedPath);
            } catch (error) {
              console.error("Error removing old screenshot from main queue:", error);
            }
          }
        }
        console.log(`Main queue now contains ${this.screenshotQueue.length} screenshot(s)`);
      } else if (this.view === "solutions" || this.view === "debug") {
        screenshotPath = path.join(this.extraScreenshotDir, `${uuidv4()}.png`);
        try {
          fs.writeFileSync(screenshotPath, screenshotBuffer);
          console.log("Successfully saved screenshot to extra queue:", screenshotPath);
        } catch (saveError) {
          console.error("Failed to save screenshot to extra queue:", saveError);
          throw new Error(`Failed to save screenshot: ${saveError.message}`);
        }
        this.extraScreenshotQueue.push(screenshotPath);
        if (this.extraScreenshotQueue.length > this.MAX_SCREENSHOTS) {
          const removedPath = this.extraScreenshotQueue.shift();
          if (removedPath) {
            try {
              fs.unlinkSync(removedPath);
              console.log("Removed old screenshot from extra queue to maintain size limit:", removedPath);
            } catch (error) {
              console.error("Error removing old screenshot from extra queue:", error);
            }
          }
        }
        console.log(`Extra queue now contains ${this.extraScreenshotQueue.length} screenshot(s)`);
      }
    } catch (error) {
      console.error("Screenshot capture failed:", error);
      throw error;
    } finally {
      this.isCapturingScreenshot = false;
      console.log("Screenshot operation completed, capturing flag reset");
    }
    console.log("Screenshot operation successful, returning path:", screenshotPath);
    return screenshotPath;
  }

  async getImagePreview(filepath) {
    try {
      const data = fs.readFileSync(filepath);
      return `data:image/png;base64,${data.toString("base64")}`;
    } catch (error) {
      console.error("Error reading image:", error);
      throw error;
    }
  }

  clearExtraScreenshotQueue() {
    console.log(`Clearing extra screenshot queue (${this.extraScreenshotQueue.length} screenshots)`);
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err) console.error(`Error deleting extra screenshot at ${screenshotPath}:`, err);
      });
    });
    this.extraScreenshotQueue = [];
    console.log("Extra screenshot queue cleared");
  }

  getProtectionStatus() {
    const now = Date.now();
    const timeSinceLastScreenshot = now - this.lastScreenshotTime;
    this.screenshotAttempts = this.screenshotAttempts.filter(attempt => now - attempt < this.RATE_LIMIT_WINDOW);
    return {
      isCapturing: this.isCapturingScreenshot,
      lastScreenshotTime: this.lastScreenshotTime,
      timeSinceLastScreenshot,
      attemptsInWindow: this.screenshotAttempts.length,
      canTakeScreenshot: !this.isCapturingScreenshot && !this.isThrottled() && !this.isRateLimited(),
      nextAllowedTime: this.lastScreenshotTime + this.MIN_SCREENSHOT_INTERVAL
    };
  }
}

module.exports = { ScreenshotHelper };