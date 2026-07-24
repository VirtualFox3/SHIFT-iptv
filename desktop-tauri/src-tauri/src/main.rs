// SHIFT desktop shell (Tauri v2). Wraps the deployed SHIFT web app in a native
// window so the Vercel serverless proxy / API routes keep working. Playback
// runs through the system WebView2 engine (HLS/MP4). For MKV/HEVC + native mpv,
// use the separate Electron build in ../desktop.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running SHIFT");
}
