// Exposes a tiny, locked-down bridge to the web app. The React code checks for
// window.electronAPI.playStream and, when present, hands playback to mpv.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  playStream: (payload) => ipcRenderer.invoke('play-stream', payload),
});
