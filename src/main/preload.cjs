const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deskPet', {
  setAction(action) {
    ipcRenderer.send('pet-action', action);
  },
  reportAction(action) {
    ipcRenderer.send('pet-state', action);
  },
  close() {
    ipcRenderer.send('pet-close');
  },
  onAction(callback) {
    ipcRenderer.on('pet-action', (_event, action, options) => callback(action, options));
  }
});
