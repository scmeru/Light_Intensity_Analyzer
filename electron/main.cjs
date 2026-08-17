const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');

// Ensure Windows taskbar correctly groups and displays app icon
if (process.platform === 'win32') {
  app.setAppUserModelId('com.lightscope.analyzer');
}

function getAppIcon() {
  if (process.platform === 'win32') {
    const distIco = path.join(__dirname, '../dist/icon.ico');
    if (fs.existsSync(distIco)) return distIco;
    const pubIco = path.join(__dirname, '../public/icon.ico');
    if (fs.existsSync(pubIco)) return pubIco;
  }
  const distPng = path.join(__dirname, '../dist/icon.png');
  if (fs.existsSync(distPng)) return distPng;
  const pubPng = path.join(__dirname, '../public/icon.png');
  if (fs.existsSync(pubPng)) return pubPng;
  return path.join(__dirname, '../public/icon.png');
}

function createWindow() {
  // ── Camera & Media Permissions ────────────────────────────────────────────
  // Electron blocks getUserMedia from file:// by default.
  // These handlers grant camera access exactly like a browser would.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true); // allow camera / microphone
    } else {
      callback(false);
    }
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'media') return true;
    return null; // default for everything else
  });

  // ── Main Window ───────────────────────────────────────────────────────────
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 820,
    minHeight: 560,
    title: 'LightScope — Analisis Intensitas Cahaya',
    backgroundColor: '#0a0a0f', // matches --bg in app.css, avoids white flash
    icon: getAppIcon(),
    show: false, // show after ready-to-show to avoid visual flicker
    webPreferences: {
      nodeIntegration: false,     // keep renderer sandboxed
      contextIsolation: true,     // security best practice
      webSecurity: false,         // allows getUserMedia & canvas from file://
    },
  });

  // ── Load built app ────────────────────────────────────────────────────────
  win.loadFile(path.join(__dirname, '../dist/index.html'));

  // Remove default menu bar (File/Edit/View/…)
  win.setMenuBarVisibility(false);

  // Show window only when fully rendered (no white flash)
  win.once('ready-to-show', () => {
    win.show();
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // On macOS apps stay open until Cmd+Q; on Windows/Linux quit immediately
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  // macOS: re-create window if dock icon is clicked and no windows are open
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
