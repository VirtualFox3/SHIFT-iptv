import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/global.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Register the service worker (enables "Install app") — production only.
if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// Auto-apply new deploys to open tabs WITHOUT a manual hard-refresh: poll the
// current bundle hash and reload — but ONLY when nothing is playing, so it never
// interrupts a video. Runs on focus and every 5 minutes.
if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  const running = Array.from(document.querySelectorAll('script[src]'))
    .map((s) => (s as HTMLScriptElement).src)
    .find((s) => /assets\/index-.*\.js/.test(s)) || ''
  let reloaded = false
  const checkDeploy = async () => {
    if (reloaded || !running) return
    const v = document.querySelector('video')
    if (v && !v.paused && !v.ended && v.currentTime > 0) return  // don't interrupt playback
    try {
      const html = await fetch('/index.html?_=' + Date.now(), { cache: 'no-store' }).then((r) => r.text())
      const m = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)
      if (m && !running.includes(m[0])) { reloaded = true; location.reload() }
    } catch { /* offline / transient — ignore */ }
  }
  setInterval(checkDeploy, 5 * 60 * 1000)
  window.addEventListener('focus', checkDeploy)
}
