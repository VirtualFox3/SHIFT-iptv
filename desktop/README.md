# SHIFT Desktop (Windows)

A native Windows app that wraps the SHIFT web UI and plays video through **mpv** —
so **every format plays**: HEVC, MKV, AV1, AC3 audio, with hardware acceleration
and instant seeking. No browser codec limits, no transcoder, no server.

## Run it (development)

1. **Install mpv** (the playback engine):
   ```powershell
   winget install shinchiro.mpv
   ```
   (or download from https://mpv.io and make sure `mpv` is on your PATH)

2. **Install + start the app:**
   ```powershell
   cd desktop
   npm install
   npm start
   ```

The window loads the live SHIFT app. Browse as normal — when you press play on
**any** title (including the MKV/HEVC ones that wouldn't play in the browser),
mpv opens fullscreen and plays it. Close mpv to return to the library.

> Want it to point at a local dev build instead of the deployed site?
> `set SHIFT_URL=http://localhost:5173 && npm start`

## Build a `.exe` installer

Bundle mpv so users don't need to install anything:

```powershell
cd desktop
npm install
npm run get-mpv      # downloads mpv.exe into desktop/bin (optional but recommended)
npm run dist         # produces dist/SHIFT-Setup-<version>.exe
```

If you skip `get-mpv`, the app still works as long as mpv is on the user's PATH.

## How it works

- `main.js` — Electron main process. Loads `https://shift-iptv.vercel.app`, and
  exposes a `play-stream` IPC handler that spawns mpv with the stream URL (and a
  VLC User-Agent, since panels block browser UAs).
- `preload.js` — exposes `window.electronAPI.playStream(...)` to the web app.
- The web app (`src/components/Player.tsx`) detects `window.electronAPI` and, in
  the desktop app, hands playback to mpv instead of the browser `<video>` element.

Because the shell loads the deployed site, the app **auto-updates** whenever you
push to Vercel — no need to reship the desktop build for UI changes.
