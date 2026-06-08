// SHIFT desktop (Electron + mpv).
//
// The window loads the existing SHIFT web app; playback is handed to mpv, a
// native engine that decodes EVERYTHING (HEVC, MKV, AV1, AC3) with hardware
// acceleration and instant seeking — no browser codec limits, no transcoder.

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load the deployed app by default (auto-updates). Override with SHIFT_URL.
const APP_URL = process.env.SHIFT_URL || 'https://shift-iptv.vercel.app';
// IPTV panels block browser User-Agents — ask as a player.
const UA = 'VLC/3.0.20 LibVLC/3.0.20';

let mpvProc = null;

// Find mpv: bundled binary first (packaged build), then the system PATH
// (e.g. installed via `winget install shinchiro.mpv`).
function mpvPath() {
  const candidates = [
    path.join(process.resourcesPath || '', 'bin', 'mpv.exe'),
    path.join(__dirname, 'bin', 'mpv.exe'),
  ];
  for (const c of candidates) { try { if (c && fs.existsSync(c)) return c; } catch {} }
  return 'mpv';
}

function playStream(_e, payload) {
  const { url, title, subUrl } = payload || {};
  if (!url) return { ok: false, error: 'no url' };
  try { if (mpvProc) mpvProc.kill(); } catch {}

  const args = [
    `--user-agent=${UA}`,
    '--force-window=yes',
    '--fullscreen',
    '--keep-open=no',
    '--osc=yes',
    title ? `--force-media-title=${title}` : '',
    subUrl ? `--sub-file=${subUrl}` : '',
    url,
  ].filter(Boolean);

  try {
    mpvProc = spawn(mpvPath(), args, { stdio: 'ignore' });
    mpvProc.on('error', (err) => { console.error('mpv launch failed:', err.message); });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#141414',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(APP_URL);
  // External links open in the system browser, not inside the app shell.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  ipcMain.handle('play-stream', playStream);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  try { mpvProc?.kill(); } catch {}
  if (process.platform !== 'darwin') app.quit();
});
