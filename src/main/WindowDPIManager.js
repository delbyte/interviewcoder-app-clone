class WindowDPIManager {
  constructor() {
    this.defaultConfig = {
      zoomFactor: 1.0,
      enableDevTools: false,
      enableLogging: true,
    };
  }

  static getInstance() {
    if (!WindowDPIManager.instance) {
      WindowDPIManager.instance = new WindowDPIManager();
    }
    return WindowDPIManager.instance;
  }

  setGlobalConfig(config) {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  setupWindow(window, windowName, customConfig) {
    const config = { ...this.defaultConfig, ...customConfig };
    window.webContents.on("did-finish-load", () => {
      // Set zoom factor for consistent DPI across environments
      window.webContents.setZoomFactor(config.zoomFactor);
      if (config.enableLogging) {
        console.log(`${windowName}: Set zoom factor to ${config.zoomFactor}`);
      }
      // Open DevTools if enabled
      if (config.enableDevTools) {
        window.webContents.openDevTools({ mode: 'detach' });
      }
    });
  }
}

// Export singleton instance
const dpiManager = WindowDPIManager.getInstance();

// Simple presets
const DPIPresets = {
  dev: { zoomFactor: 1.0, enableDevTools: true, enableLogging: true },
  prod: { zoomFactor: 1.0, enableDevTools: false, enableLogging: false },
  debug: { zoomFactor: 1.0, enableDevTools: true, enableLogging: true },
};

module.exports = { WindowDPIManager, dpiManager, DPIPresets };