const Store = require('electron-store');

const store = new Store({
  defaults: {
    // Add default settings here
  },
  encryptionKey: "your-encryption-key"
});

module.exports = { store };