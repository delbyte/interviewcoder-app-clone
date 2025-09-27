const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Platform
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // App control
  quitApp: () => ipcRenderer.invoke('quit-app'),
  rebootApp: () => ipcRenderer.invoke('reboot-app'),

  // Window management
  updateContentDimensions: (dimensions) => ipcRenderer.invoke('update-content-dimensions', dimensions),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.invoke('set-ignore-mouse-events', ignore, options),
  hideFloatingWindow: () => ipcRenderer.invoke('hide-floating-window'),
  showFloatingWindow: () => ipcRenderer.invoke('show-floating-window'),
  openMainPanel: () => ipcRenderer.invoke('open-main-panel'),
  hideMainPanel: () => ipcRenderer.invoke('hide-main-panel'),

  // Screenshots
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
  getScreenshots: () => ipcRenderer.invoke('get-screenshots'),
  
  // Problem solving
  solve: (screenshots, language) => ipcRenderer.invoke('solve', screenshots, language),
  startOver: () => ipcRenderer.invoke('start-over'),

  // Permissions
  getPermissionStatus: () => ipcRenderer.invoke('get-permission-status'),
  requestScreenRecordingPermission: () => ipcRenderer.invoke('request-screen-recording-permission'),
  openScreenRecordingSettings: () => ipcRenderer.invoke('open-screen-recording-settings'),
  openSystemPreferences: () => ipcRenderer.invoke('open-system-preferences'),
  showWelcomePermissionDialog: () => ipcRenderer.invoke('show-welcome-permission-dialog'),
  showPermissionWindow: () => ipcRenderer.invoke('show-permission-window'),
  hidePermissionWindow: () => ipcRenderer.invoke('hide-permission-window'),

  // External links
  openSettingsPortal: () => ipcRenderer.invoke('open-settings-portal'),
  openSubscriptionPortal: () => ipcRenderer.invoke('open-subscription-portal'),

  // Focus and click-through management
  setClickThrough: (enabled) => ipcRenderer.invoke('set-click-through', enabled),
  takeFocus: () => ipcRenderer.invoke('take-focus'),
  releaseFocus: () => ipcRenderer.invoke('release-focus'),

  // Onboarding
  startOnboardingFlow: () => ipcRenderer.invoke('start-onboarding-flow'),

  // Storage
  getStorageValue: (key) => ipcRenderer.invoke('get-storage-value', key),
  setStorageValue: (key, value) => ipcRenderer.invoke('set-storage-value', key, value),

  // Error logging
  logError: (errorData) => ipcRenderer.invoke('log-error', errorData),

  // IPC listeners for events
  on: (channel, callback) => {
    ipcRenderer.on(channel, callback);
    return () => ipcRenderer.removeListener(channel, callback);
  },

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});