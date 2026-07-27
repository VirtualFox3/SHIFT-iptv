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

// Read the OS window handle for the main window so mpv can render *into* it.
function windowHandle(win) {
  try {
    const buf = win.getNativeWindowHandle();
    // 64-bit builds return an 8-byte pointer; 32-bit returns 4.
    return buf.length === 8 ? buf.readBigUInt64LE(0).toString() : String(buf.readUInt32LE(0));
  } catch {
    return null;
  }
}

function playStream(_e, payload) {
  const { url, title, subUrl } = payload || {};
  if (!url) return { ok: false, error: 'no url' };
  try { if (mpvProc) mpvProc.kill(); } catch {}

  const win = BrowserWindow.getAllWindows()[0];
  // --wid embeds mpv's video output into SHIFT's own window, so playback happens
  // INSIDE the app (no second window, no extra taskbar entry). Falls back to a
  // standalone mpv window only if the handle can't be read.
  const wid = win ? windowHandle(win) : null;

  const args = [
    `--user-agent=${UA}`,
    '--force-window=yes',
    '--keep-open=no',
    '--osc=yes',                 // mpv's on-screen controls (seek bar etc.)
    '--osd-bar=yes',
    '--input-default-bindings=yes',
    wid ? `--wid=${wid}` : '--fullscreen',
    title ? `--force-media-title=${title}` : '',
    subUrl ? `--sub-file=${subUrl}` : '',
    url,
  ].filter(Boolean);

  try {
    mpvProc = spawn(mpvPath(), args, { stdio: 'ignore' });
    mpvProc.on('error', (err) => { console.error('mpv launch failed:', err.message); });
    // When playback ends the embedded surface goes away — tell the UI so it can
    // restore the library view instead of sitting on a blank window.
    mpvProc.on('close', () => {
      mpvProc = null;
      try { win?.webContents.send('player-closed'); } catch {}
      try { win?.focus(); } catch {}
    });
    return { ok: true, embedded: !!wid };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

// Let the renderer stop playback (e.g. its own Back button).
function stopStream() {
  try { mpvProc?.kill(); } catch {}
  mpvProc = null;
  return { ok: true };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#141414',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.ico'),
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
  ipcMain.handle('stop-stream', stopStream);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  try { mpvProc?.kill(); } catch {}
  if (process.platform !== 'darwin') app.quit();
});
