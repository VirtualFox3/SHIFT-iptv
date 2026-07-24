import React from 'react';

// "Shifty" — the SHIFT cat mascot, animated. One transparent PNG, brought to
// life with transform-based CSS (float / bounce / peek / wiggle) so it reads as
// alive without needing per-feature SVG rigging.
type Mood = 'idle' | 'loading' | 'peek' | 'sad';

interface ShiftyProps {
  size?: number;
  mood?: Mood;
  /** Accent glow color (defaults to the app accent var). */
  glow?: string;
  style?: React.CSSProperties;
}

let injected = false;
function useShiftyStyles() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const el = document.createElement('style');
  el.textContent = `
    @keyframes shifty-float { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-7%) rotate(1deg)} }
    @keyframes shifty-bounce {
      0%,100%{transform:translateY(0) scale(1,1)}
      15%{transform:translateY(-2%) scale(1.03,0.97)}
      45%{transform:translateY(-26%) scale(0.97,1.03)}
      70%{transform:translateY(0) scale(1.05,0.95)}
      80%{transform:translateY(0) scale(0.98,1.02)}
    }
    @keyframes shifty-peek { 0%{transform:translateY(60%)} 60%{transform:translateY(-6%)} 100%{transform:translateY(0)} }
    @keyframes shifty-wiggle { 0%,100%{transform:rotate(-3deg)} 50%{transform:rotate(3deg)} }
    @keyframes shifty-sad { 0%,100%{transform:translateY(0) rotate(0)} 50%{transform:translateY(4%) rotate(0.5deg)} }
    @keyframes shifty-glow { 0%,100%{opacity:0.35;transform:translate(-50%,-50%) scale(0.9)} 50%{opacity:0.7;transform:translate(-50%,-50%) scale(1.1)} }
    .shifty-wrap:hover .shifty-img { animation: shifty-wiggle 420ms ease-in-out; }
    @media (prefers-reduced-motion: reduce) {
      .shifty-img, .shifty-glow { animation: none !important; }
    }
  `;
  document.head.appendChild(el);
}

const ANIM: Record<Mood, string> = {
  idle: 'shifty-float 4s ease-in-out infinite',
  loading: 'shifty-bounce 1.1s cubic-bezier(0.3,0.1,0.3,1) infinite',
  peek: 'shifty-peek 600ms cubic-bezier(0.2,0.8,0.2,1) both',
  sad: 'shifty-sad 3s ease-in-out infinite',
};

export default function Shifty({ size = 120, mood = 'idle', glow, style }: ShiftyProps) {
  useShiftyStyles();
  const glowColor = glow || 'var(--accent, #E50914)';
  return (
    <div className="shifty-wrap" style={{ position: 'relative', width: size, height: size, display: 'grid', placeItems: 'center', ...style }}>
      {/* pulsing accent glow behind the cat (only while loading) */}
      {mood === 'loading' && (
        <div className="shifty-glow" style={{
          position: 'absolute', top: '58%', left: '50%', width: size * 0.85, height: size * 0.5,
          borderRadius: '50%', background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
          filter: 'blur(6px)', animation: 'shifty-glow 1.1s ease-in-out infinite', pointerEvents: 'none',
        }} />
      )}
      <img
        className="shifty-img"
        src="/favicon-cat.png"
        alt="Shifty"
        width={size}
        height={size}
        draggable={false}
        style={{ display: 'block', animation: ANIM[mood], transformOrigin: 'center bottom', filter: mood === 'sad' ? 'grayscale(0.4)' : 'none' }}
      />
    </div>
  );
}
