// Exposes a tiny, locked-down bridge to the web app. The React code checks for
// window.electronAPI.playStream and, when present, hands playback to mpv —
// which renders *inside* the SHIFT window (see --wid in main.js).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  playStream: (payload) => ipcRenderer.invoke('play-stream', payload),
  stopStream: () => ipcRenderer.invoke('stop-stream'),
  // Fired when mpv exits so the UI can restore the library view.
  onPlayerClosed: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('player-closed', handler);
    return () => ipcRenderer.removeListener('player-closed', handler);
  },
});
