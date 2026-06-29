import React from 'react';

// First-run welcome / intro screen — branded SHIFT hero shown before the login
// screen. Themed (dark/light) via the app's CSS variables.
export default function Welcome({ onStart }: { onStart: () => void }) {
  const features = [
    { icon: '📺', title: 'Live TV & EPG', desc: 'Thousands of channels with a full programme guide.' },
    { icon: '🎬', title: 'Movies & Series', desc: 'Your whole VOD library, organised Netflix-style.' },
    { icon: '💬', title: 'Subtitles built in', desc: 'OpenSubtitles + keyless sources, auto-matched.' },
    { icon: '🎨', title: 'Dark & Light', desc: 'A clean theme for day or night, your call.' },
  ];
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--fg-1)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* soft accent glow backdrop */}
      <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 900, height: 900, borderRadius: '50%', background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 22%, transparent) 0%, transparent 60%)', pointerEvents: 'none', filter: 'blur(30px)' }} />

      <header style={{ padding: '26px 48px', position: 'relative', zIndex: 1 }}>
        <span className="shift-wordmark" style={{ fontSize: 30 }}>SHIFT</span>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px 24px 60px', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 18 }}>
          Your IPTV, beautifully
        </div>
        <h1 style={{ fontSize: 'clamp(40px, 6vw, 76px)', fontWeight: 900, lineHeight: 1.02, letterSpacing: '-0.03em', margin: '0 0 18px', maxWidth: 900 }}>
          Every channel. Every show.<br />One stunning app.
        </h1>
        <p style={{ fontSize: 18, color: 'var(--fg-3)', lineHeight: 1.5, maxWidth: 560, margin: '0 0 34px' }}>
          Connect your IPTV provider and stream live TV, movies and series with subtitles — on a player that finally looks the part.
        </p>
        <button onClick={onStart}
          style={{ background: 'var(--accent)', color: '#fff', border: 0, borderRadius: 8, padding: '15px 40px', fontSize: 17, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 10px 30px color-mix(in srgb, var(--accent) 45%, transparent)' }}>
          Get Started  →
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginTop: 64, maxWidth: 880, width: '100%' }}>
          {features.map((f) => (
            <div key={f.title} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px 20px', textAlign: 'left', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
              <div style={{ fontSize: 26, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 5 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: 'var(--fg-4)', lineHeight: 1.45 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </main>

      <footer style={{ padding: '20px 48px', textAlign: 'center', color: 'var(--fg-4)', fontSize: 12.5, position: 'relative', zIndex: 1 }}>
        SHIFT — bring your own IPTV provider. No content included.
      </footer>
    </div>
  );
}
