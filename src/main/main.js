const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

// Import helpers
const { ScreenshotHelper } = require('./ScreenshotHelper');
const { ProcessingHelper } = require('./ProcessingHelper');
const { ShortcutsHelper } = require('./shortcuts');
const { initializeIpcHandlers } = require('./ipcHandlers');
const { dpiManager } = require('./WindowDPIManager');

// Global state
let mainWindow = null;
let permissionWindow = null;
let mainPanelWindow = null;
let screenshotHelper = null;
let processingHelper = null;
let shortcutsHelper = null;

// State variables
let view = 'queue';
let hasDebugged = false;
let problemInfo = null;
let isFloatingWindowVisible = false;
let isMainWindowVisible = false;
let isMainPanelVisible = false;
let currentX = 100;
let currentY = 100;
let windowSize = { width: 800, height: 600 };

function createMainWindow() {
  if (mainWindow) return;

  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // For permission dialog
  mainWindow.on('closed', () => {
    mainWindow = null;
    isMainWindowVisible = false;
  });
}

function createMainPanelWindow() {
  if (mainPanelWindow) return;

  mainPanelWindow = new BrowserWindow({
    width: 600,
    height: 400,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // For settings/onboarding
  mainPanelWindow.on('closed', () => {
    mainPanelWindow = null;
    isMainPanelVisible = false;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: windowSize.width,
    height: windowSize.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    x: currentX,
    y: currentY,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
    },
  });

  // Set window to be click-through by default
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    // mainWindow.webContents.openDevTools(); // Disabled for testing
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  dpiManager.setupWindow(mainWindow, 'Floating Window', { enableDevTools: false });

  mainWindow.on('closed', () => {
    mainWindow = null;
    isFloatingWindowVisible = false;
  });

  mainWindow.on('move', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      currentX = bounds.x;
      currentY = bounds.y;
    }
  });

  mainWindow.on('resize', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      windowSize = { width: bounds.width, height: bounds.height };
    }
  });
}

function initializeHelpers() {
  screenshotHelper = new ScreenshotHelper(view);
  processingHelper = new ProcessingHelper({
    getScreenshotHelper: () => screenshotHelper,
    getMainWindow: () => mainWindow,
    getView: () => view,
    setView: (newView) => { view = newView; screenshotHelper.setView(newView); },
    setHasDebugged: (value) => { hasDebugged = value; },
    setProblemInfo: (info) => { problemInfo = info; },
    clearQueues: () => screenshotHelper.clearQueues(),
    getScreenshotQueue: () => screenshotHelper.getScreenshotQueue(),
    getExtraScreenshotQueue: () => screenshotHelper.getExtraScreenshotQueue(),
    takeScreenshot: () => screenshotHelper.takeScreenshot(),
    getImagePreview: (path) => screenshotHelper.getImagePreview(path),
  });
  shortcutsHelper = new ShortcutsHelper({
    takeScreenshot: () => screenshotHelper.takeScreenshot(),
    toggleWindow: () => toggleMainWindow(),
    startOver: () => {
      screenshotHelper.clearQueues();
      view = 'queue';
      if (mainWindow) mainWindow.webContents.send('start-over');
    },
    solve: () => processingHelper.processScreenshots(),
    moveWindowHorizontal: (delta) => moveWindowHorizontal(delta),
    moveWindowVertical: (delta) => moveWindowVertical(delta),
    getMainWindow: () => mainWindow,
    getFloatingWindow: () => mainWindow,
    getFloatingWindowVisible: () => isFloatingWindowVisible,
    hideFloatingWindow: () => hideFloatingWindow(),
    showFloatingWindow: () => showFloatingWindow(),
  });
}

function showFloatingWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    isFloatingWindowVisible = true;
  }
}

function hideFloatingWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
    isFloatingWindowVisible = false;
  }
}

function toggleMainWindow() {
  if (isFloatingWindowVisible) {
    hideFloatingWindow();
  } else {
    showFloatingWindow();
  }
}

function showPermissionWindow() {
  if (!permissionWindow || permissionWindow.isDestroyed()) {
    createMainWindow();
    permissionWindow = mainWindow;
  }
  if (permissionWindow && !permissionWindow.isDestroyed()) {
    permissionWindow.show();
    isMainWindowVisible = true;
  }
}

function hidePermissionWindow() {
  if (permissionWindow && !permissionWindow.isDestroyed()) {
    permissionWindow.hide();
    isMainWindowVisible = false;
  }
}

function showMainPanel() {
  if (!mainPanelWindow || mainPanelWindow.isDestroyed()) {
    createMainPanelWindow();
  }
  if (mainPanelWindow && !mainPanelWindow.isDestroyed()) {
    mainPanelWindow.show();
    isMainPanelVisible = true;
  }
}

function hideMainPanel() {
  if (mainPanelWindow && !mainPanelWindow.isDestroyed()) {
    mainPanelWindow.hide();
    isMainPanelVisible = false;
  }
}

function broadcastOnboardingState(state) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('onboarding-state', state);
  }
}

function moveWindowHorizontal(updateFn) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const delta = typeof updateFn === 'function' ? updateFn() : updateFn;
    currentX += delta;
    mainWindow.setPosition(Math.round(currentX), Math.round(currentY));
  }
}

function moveWindowVertical(updateFn) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const delta = typeof updateFn === 'function' ? updateFn() : updateFn;
    currentY += delta;
    mainWindow.setPosition(Math.round(currentX), Math.round(currentY));
  }
}

function setWindowDimensions(width, height) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    windowSize = { width, height };
    mainWindow.setSize(width, height);
  }
}

app.whenReady().then(() => {
  initializeHelpers();
  createWindow();
  // Register shortcuts after window is created
  shortcutsHelper.registerGlobalShortcuts();
  initializeIpcHandlers({
    getMainWindow: () => mainWindow,
    setWindowDimensions,
    getScreenshotQueue: () => screenshotHelper.getScreenshotQueue(),
    getExtraScreenshotQueue: () => screenshotHelper.getExtraScreenshotQueue(),
    getImagePreview: (path) => screenshotHelper.getImagePreview(path),
    getView: () => view,
    showPermissionWindow,
    hidePermissionWindow,
    hideFloatingWindow,
    showFloatingWindow,
    showMainPanel,
    hideMainPanel,
    broadcastOnboardingState,
    screenshotHelper,
    processingHelper,
    clearQueues: () => screenshotHelper.clearQueues(),
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (shortcutsHelper) {
    shortcutsHelper.unregisterAll();
  }
});