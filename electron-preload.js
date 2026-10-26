const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  exit: () => ipcRenderer.send('exit-app'),
  getVersion: () => process.versions
});
