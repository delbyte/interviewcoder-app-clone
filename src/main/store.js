const Store = require('electron-store').default;

const store = new Store({
  defaults: {
    onboardingCompleted: false
  },
  encryptionKey: "your-encryption-key"
});

module.exports = { store };