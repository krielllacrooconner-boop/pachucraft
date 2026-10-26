const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.ico');
  const opts = {
    width: 1024, height: 768,
    minWidth: 640, minHeight: 480,
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  };
  if (fs.existsSync(iconPath)) opts.icon = iconPath;
  const win = new BrowserWindow(opts);
  win.removeMenu();
  win.loadFile('index.html');
}

ipcMain.on('exit-app', () => app.quit());

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
