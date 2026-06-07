import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useStore } from '../store/useStore';

export default function TweaksPanel() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ right: 16, bottom: 16 });
  const panelRef = useRef<HTMLDivElement>(null);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  const clamp = useCallback(() => {
    const p = panelRef.current;
    if (!p) return;
    const w = p.offsetWidth, h = p.offsetHeight;
    setPos((prev) => ({
      right: Math.min(Math.max(prev.right, 16), Math.max(16, window.innerWidth - w - 16)),
      bottom: Math.min(Math.max(prev.bottom, 16), Math.max(16, window.innerHeight - h - 16)),
    }));
  }, []);

  useEffect(() => { if (open) clamp(); }, [open]);

  function onDragStart(e: React.MouseEvent) {
    const p = panelRef.current;
    if (!p) return;
    const r = p.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev: MouseEvent) => {
      setPos({ right: Math.max(16, startRight - (ev.clientX - sx)), bottom: Math.max(16, startBottom - (ev.clientY - sy)) });
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  const accentOptions = ['#E50914', '#6E3FF3', '#14B8A6', '#F5C518', '#46D369', '#2E51A2'];

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Tweaks"
        style={{
          position: 'fixed', right: 16, bottom: open ? pos.bottom + 300 + 8 : 16,
          zIndex: 2000, width: 42, height: 42, borderRadius: '50%',
          background: open ? '#fff' : 'rgba(30,30,30,0.9)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: open ? '#0a0a0a' : '#fff',
          cursor: 'pointer', display: 'grid', placeItems: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          transition: 'bottom 200ms, background 140ms',
          fontSize: 18,
        }}
      >
        {open ? '✕' : '⚙'}
      </button>

      {open && (
        <div ref={panelRef} style={{
          position: 'fixed', right: pos.right, bottom: pos.bottom, zIndex: 1999,
          width: 276, maxHeight: 'calc(100vh - 32px)',
          display: 'flex', flexDirection: 'column',
          background: 'rgba(22,22,22,0.92)', backdropFilter: 'blur(24px) saturate(160%)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14,
          boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
          color: '#fff', fontFamily: 'inherit', overflow: 'hidden',
        }}>
          {/* Header / drag handle */}
          <div onMouseDown={onDragStart} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'move', userSelect: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.04em' }}>Tweaks</span>
          </div>

          {/* Body */}
          <div style={{ padding: '12px 14px 16px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
            <TwkSection label="Billboard" />
            <TwkRow label="Style">
              <select value={settings.bbStyle} onChange={(e) => updateSettings({ bbStyle: e.target.value as any })}
                style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
                {['Spotlight', 'Centered', 'Cinema Wall'].map((o) => <option key={o} value={o} style={{ background: '#1a1a1a', color: '#fff' }}>{o}</option>)}
              </select>
            </TwkRow>

            <TwkSection label="Appearance" />
            <TwkRow label="Accent color">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {accentOptions.map((c) => (
                  <button key={c} onClick={() => updateSettings({ accentColor: c })} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: settings.accentColor === c ? '2.5px solid #fff' : '2px solid transparent', cursor: 'pointer', outline: 'none', transition: 'transform 120ms', transform: settings.accentColor === c ? 'scale(1.2)' : 'scale(1)' }} />
                ))}
              </div>
            </TwkRow>
            <TwkRow label="Card radius" value={`${settings.cardRadius}px`}>
              <input type="range" min={0} max={16} step={2} value={settings.cardRadius}
                onChange={(e) => updateSettings({ cardRadius: Number(e.target.value) })}
                style={{ width: '100%', accentColor: settings.accentColor }} />
            </TwkRow>

            <TwkSection label="Subtitles" />
            <TwkRow label="Size">
              <TwkSeg value={settings.subSize} options={['Small', 'Medium', 'Large']} onChange={(v) => updateSettings({ subSize: v as any })} />
            </TwkRow>

            <TwkSection label="Playback" />
            <TwkToggleRow label="Autoplay next" value={settings.autoplayNext} onChange={(v) => updateSettings({ autoplayNext: v })} />
            <TwkToggleRow label="Skip intros" value={settings.skipIntros} onChange={(v) => updateSettings({ skipIntros: v })} />
          </div>
        </div>
      )}
    </>
  );
}

function TwkSection({ label }: { label: string }) {
  return <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', paddingTop: 4 }}>{label}</div>;
}

function TwkRow({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        {value && <span style={{ color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>}
      </div>
      {children}
    </div>
  );
}

function TwkToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{label}</span>
      <button onClick={() => onChange(!value)} style={{ position: 'relative', width: 32, height: 18, borderRadius: 999, border: 0, background: value ? '#34c759' : 'rgba(255,255,255,0.15)', padding: 0, cursor: 'pointer', transition: 'background 150ms' }}>
        <span style={{ position: 'absolute', top: 2, left: value ? 14 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 150ms', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </button>
    </div>
  );
}

function TwkSeg({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 2, gap: 2, flexWrap: 'wrap' }}>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} style={{
          flex: 1, minWidth: 0, border: 0, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 6px', fontSize: 11, fontWeight: 600, lineHeight: 1.2,
          background: value === o ? 'rgba(255,255,255,0.9)' : 'transparent',
          color: value === o ? '#0a0a0a' : 'rgba(255,255,255,0.6)',
          transition: 'all 150ms',
        }}>{o}</button>
      ))}
    </div>
  );
}
