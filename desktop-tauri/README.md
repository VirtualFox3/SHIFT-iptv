# SHIFT — Tauri desktop (Windows installer / Microsoft Store)

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

## Getting it on the Microsoft Store

You need a **Microsoft Partner Center** developer account (one-time ~$19):
https://partner.microsoft.com/dashboard

Two paths:

**A. Submit the MSI/EXE directly (simplest).**
The Store now accepts unpackaged Win32 installers (EXE/MSI). Create a new app in
Partner Center → "Packages" → upload the `.msi` (or `-setup.exe`). Microsoft
wraps it for distribution. Least effort.

**B. Wrap to MSIX (cleaner Store integration).**
Install the **MSIX Packaging Tool** from the Store, point it at the generated
`.msi`, and it produces a `.msix` you upload to Partner Center. Better Store
features (auto-update, clean uninstall) at the cost of one extra step.

Reserve the app name in Partner Center first — it must match `productName`
("SHIFT") in `src-tauri/tauri.conf.json`.

---

## Notes
- `identifier` (`com.shift.iptv`) must be unique to your publisher — change it
  if the Store reports a conflict.
- Signing: the Store signs Store submissions for you. For distributing the
  installer *outside* the Store without SmartScreen warnings, you'd need your
  own code-signing certificate (optional).
