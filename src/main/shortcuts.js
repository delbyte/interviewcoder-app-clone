const { globalShortcut } = require('electron');

class ShortcutsHelper {
  constructor(deps) {
    this.deps = deps;
    this.shortcuts = new Map();
  }

  registerGlobalShortcuts() {
    // Clear any existing shortcuts
    globalShortcut.unregisterAll();

    // Define shortcuts
    const shortcuts = [
      {
        accelerator: 'CommandOrControl+H',
        action: 'takeScreenshot',
        description: 'Take screenshot'
      },
      {
        accelerator: 'CommandOrControl+B',
        action: 'toggleWindow',
        description: 'Toggle window visibility'
      },
      {
        accelerator: 'CommandOrControl+G',
        action: 'startOver',
        description: 'Start over'
      },
      {
        accelerator: 'CommandOrControl+Enter',
        action: 'solve',
        description: 'Solve problem'
      },
      {
        accelerator: 'CommandOrControl+Up',
        action: 'moveUp',
        description: 'Move window up'
      },
      {
        accelerator: 'CommandOrControl+Down',
        action: 'moveDown',
        description: 'Move window down'
      },
      {
        accelerator: 'CommandOrControl+Left',
        action: 'moveLeft',
        description: 'Move window left'
      },
      {
        accelerator: 'CommandOrControl+Right',
        action: 'moveRight',
        description: 'Move window right'
      }
    ];

    shortcuts.forEach(({ accelerator, action, description }) => {
      try {
        const success = globalShortcut.register(accelerator, () => {
          console.log(`Shortcut triggered: ${description} (${accelerator})`);
          this.handleShortcut(action);
        });

        if (success) {
          console.log(`Registered shortcut: ${accelerator} - ${description}`);
          this.shortcuts.set(action, accelerator);
        } else {
          console.warn(`Failed to register shortcut: ${accelerator} - ${description}`);
        }
      } catch (error) {
        console.error(`Error registering shortcut ${accelerator}:`, error);
      }
    });
  }

  handleShortcut(action) {
    switch (action) {
      case 'takeScreenshot':
        this.takeScreenshot();
        break;
      case 'toggleWindow':
        this.toggleWindow();
        break;
      case 'startOver':
        this.startOver();
        break;
      case 'solve':
        this.solve();
        break;
      case 'moveUp':
        this.moveWindow(0, -10);
        break;
      case 'moveDown':
        this.moveWindow(0, 10);
        break;
      case 'moveLeft':
        this.moveWindow(-10, 0);
        break;
      case 'moveRight':
        this.moveWindow(10, 0);
        break;
      default:
        console.warn(`Unknown shortcut action: ${action}`);
    }
  }

  async takeScreenshot() {
    try {
      const screenshotPath = await this.deps.takeScreenshot();
      console.log('Screenshot taken:', screenshotPath);
      
      // Generate preview and send structured object
      const preview = await this.deps.getImagePreview(screenshotPath);
      const result = { success: true, path: screenshotPath, preview: preview, id: Date.now() };

      // Notify renderer about new screenshot
      const mainWindow = this.deps.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('screenshot-taken', result);
      }
    } catch (error) {
      console.error('Screenshot failed:', error);
      const mainWindow = this.deps.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('screenshot-error', error.message);
      }
    }
  }

  toggleWindow() {
    const isVisible = this.deps.getFloatingWindowVisible ? this.deps.getFloatingWindowVisible() : false;
    if (isVisible) {
      this.deps.hideFloatingWindow();
    } else {
      this.deps.showFloatingWindow();
    }
  }

  startOver() {
    console.log('Start over triggered');
    this.deps.clearQueues();
    this.deps.setView('queue');
    const mainWindow = this.deps.getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('start-over');
    }
  }

  solve() {
    console.log('Solve triggered');
    this.deps.processScreenshots();
  }

  moveWindow(deltaX, deltaY) {
    if (this.deps.moveWindowHorizontal && this.deps.moveWindowVertical) {
      if (deltaX !== 0) {
        this.deps.moveWindowHorizontal(() => deltaX);
      }
      if (deltaY !== 0) {
        this.deps.moveWindowVertical(() => deltaY);
      }
    }
  }

  getRegisteredShortcuts() {
    return Object.fromEntries(this.shortcuts);
  }

  unregisterAll() {
    globalShortcut.unregisterAll();
    this.shortcuts.clear();
  }
}

module.exports = { ShortcutsHelper };