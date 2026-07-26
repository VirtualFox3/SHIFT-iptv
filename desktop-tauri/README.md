# SHIFT — Tauri desktop (Windows installer)

A lightweight native Windows shell around the deployed SHIFT web app
(`https://shift-iptv.vercel.app`). It loads the live site so the Vercel
serverless proxy and API routes keep working, and renders through the system
**WebView2** engine.

**Bundle size:** ~5–10 MB (vs ~150 MB for the Electron build).
**Playback:** HLS / MP4 via WebView2. For **MKV / HEVC + native mpv**, use the
Electron build in `../desktop` instead — Tauri's system webview can't decode
those.

---

## One-time setup (on a Windows machine)

Tauri builds a *Windows* installer, so this must run on Windows — it can't be
cross-compiled from Linux/CI easily.

1. **Install Rust** — https://rustup.rs (run `rustup-init.exe`, accept defaults)
2. **Install the WebView2 runtime** — preinstalled on Windows 10/11; otherwise
   grab the Evergreen runtime from Microsoft.
3. **Install Visual Studio Build Tools** with the *Desktop development with C++*
   workload (Rust needs the MSVC linker).
4. From this folder:
   ```powershell
   cd desktop-tauri
   npm install
   npm run icons     # generates src-tauri/icons/* from ../public/icon-1024.png
   ```

## Run it locally
```powershell
npm run dev
```

## Build the installer
```powershell
npm run build
```
Output lands in `src-tauri/target/release/bundle/`:
- `msi/SHIFT_1.0.0_x64_en-US.msi`   ← Windows Installer
- `nsis/SHIFT_1.0.0_x64-setup.exe`  ← NSIS setup .exe

Either is a real, double-clickable native installer.

---

## Notes
- `identifier` (`com.shift.iptv`) is the app's unique id — change it if you fork
  this for your own distribution.
- Signing: to hand the installer to other people without a Windows SmartScreen
  warning you'd need your own code-signing certificate (optional — it installs
  fine either way, SmartScreen just shows a "more info" prompt first).
