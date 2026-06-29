import React, { useMemo, useState } from 'react';
import type { Channel } from '../types';
import { SCHEDULE, EPG_START, EPG_HOURS } from '../data';
import * as Icons from './Icons';

interface LiveGuideProps {
  channels: Channel[];
  onPlay: (ch: Channel) => void;
  accentColor: string;
}

const PAGE = 60;

export default function LiveGuide({ channels: allChannels, onPlay, accentColor }: LiveGuideProps) {
  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const start = EPG_START;
  const hours = EPG_HOURS;
  const COL_W = 220; // px per hour

  const [filter, setFilter] = useState('');
  const [shown, setShown] = useState(PAGE);

  // Filter + window the channel list so thousands of rows don't tank the UI.
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? allChannels.filter((c) => c.name.toLowerCase().includes(q) || c.cat.toLowerCase().includes(q)) : allChannels;
  }, [allChannels, filter]);
  const channels = filtered.slice(0, shown);

  const timeHeaders = useMemo(() => {
    const h = [];
    for (let i = 0; i <= hours; i++) {
      const hh = (start + i) % 24;
      const label = `${hh % 12 || 12}:00 ${hh < 12 ? 'AM' : 'PM'}`;
      h.push({ label, offset: i * COL_W });
    }
    return h;
  }, []);

  const nowOffset = Math.max(0, (nowH - start) * COL_W);

  return (
    <div style={{ minHeight: '100vh', paddingTop: 24, background: 'var(--app-bg)' }}>
      <div style={{ padding: '0 48px', marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>TV Guide</h1>
          <p style={{ color: 'var(--ink-5)', fontSize: 14, marginTop: 6 }}>
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {filtered.length.toLocaleString()} channels
          </p>
        </div>
        <input value={filter} onChange={(e) => { setFilter(e.target.value); setShown(PAGE); }}
          placeholder="Filter channels…"
          style={{ background: 'var(--surface-2)', border: '1px solid #333', borderRadius: 6, padding: '10px 14px', color: 'var(--ink-1)', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: 260 }} />
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 24 }}>
        <div style={{ minWidth: 900, position: 'relative' }}>
          {/* Time header */}
          <div style={{ display: 'flex', paddingLeft: 180, position: 'sticky', top: 66, background: 'var(--app-bg)', zIndex: 10, borderBottom: '1px solid var(--hair-1)' }}>
            {timeHeaders.map((h) => (
              <div key={h.label} style={{ width: COL_W, flexShrink: 0, padding: '8px 12px', fontSize: 12, fontWeight: 700, color: 'var(--ink-5)', letterSpacing: '0.04em' }}>
                {h.label}
              </div>
            ))}
          </div>

          {/* "Now" indicator */}
          {nowH >= start && nowH <= start + hours && (
            <div style={{ position: 'absolute', left: 180 + nowOffset, top: 0, bottom: 0, width: 2, background: accentColor, zIndex: 5, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', top: 34, left: -20, background: accentColor, color: 'var(--ink-1)', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 2, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>NOW</div>
            </div>
          )}

          {/* Channel rows */}
          {channels.map((ch) => {
            const schedule = SCHEDULE[ch.id] || [];
            return (
              <div key={ch.id} style={{ display: 'flex', borderBottom: '1px solid var(--surface-2)', minHeight: 56 }}>
                {/* Channel label */}
                <div onClick={() => onPlay(ch)} style={{ width: 180, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', position: 'sticky', left: 0, background: 'var(--app-bg)', zIndex: 4, borderRight: '1px solid var(--hair-1)', cursor: 'pointer' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 6, background: ch.logoUrl ? '#0a0a0a' : `linear-gradient(135deg,${ch.grad[0]},${ch.grad[1]})`, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 11, flexShrink: 0, overflow: 'hidden' }}>
                    {ch.logoUrl
                      ? <img src={ch.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.parentElement as HTMLElement).textContent = ch.logo; }} />
                      : ch.logo}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-5)' }}>CH {ch.num}</div>
                  </div>
                </div>

                {/* Programme blocks */}
                <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', height: 56 }}>
                  {/* No EPG → single "Live programming" block spanning the window */}
                  {schedule.length === 0 && (
                    <button onClick={() => onPlay(ch)} style={{
                      position: 'absolute', left: 0, width: hours * COL_W - 2, top: 4, bottom: 4,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--surface-3)', borderRadius: 4, cursor: 'pointer', padding: '0 12px',
                      display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', overflow: 'hidden',
                      transition: 'background 140ms',
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-active)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#9a9a9a', fontWeight: 800, fontSize: 10, letterSpacing: '0.06em' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9a9a9a' }} />LIVE
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.name} · Live programming</span>
                    </button>
                  )}
                  {schedule
                    .filter((p) => p.t + p.dur > start && p.t < start + hours)
                    .map((p, i) => {
                      const left = Math.max(0, (p.t - start) * COL_W);
                      const right = Math.min(hours * COL_W, (p.t + p.dur - start) * COL_W);
                      const width = right - left;
                      if (width <= 0) return null;
                      const isNow = p.live && nowH >= p.t && nowH < p.t + p.dur;
                      return (
                        <button key={i} onClick={() => onPlay(ch)} style={{
                          position: 'absolute', left, width: width - 2, top: 4, bottom: 4,
                          background: isNow ? `linear-gradient(90deg, color-mix(in srgb, ${accentColor} 20%, var(--surface-2)), var(--surface-2))` : 'var(--surface-2)',
                          border: isNow ? `1px solid ${accentColor}40` : '1px solid var(--surface-3)',
                          borderRadius: 4, cursor: 'pointer', padding: '0 10px',
                          display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'left',
                          overflow: 'hidden',
                        }}>
                          <div style={{ fontSize: 12.5, fontWeight: isNow ? 700 : 500, color: isNow ? 'var(--ink-1)' : '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.title}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--ink-5)', marginTop: 2 }}>
                            {fmt12(p.t)} – {fmt12(p.t + p.dur)}
                          </div>
                          {isNow && (
                            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: 'var(--hair-2)' }}>
                              <div style={{ width: `${ch.prog}%`, height: '100%', background: accentColor }} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {shown < filtered.length && (
        <div style={{ padding: '20px 48px 40px', textAlign: 'center' }}>
          <button onClick={() => setShown((s) => s + PAGE)}
            style={{ background: 'var(--surface-2)', border: '1px solid var(--input-border)', color: 'var(--ink-1)', borderRadius: 6, padding: '11px 26px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Load more channels ({filtered.length - shown} left)
          </button>
        </div>
      )}
    </div>
  );
}

function fmt12(t: number): string {
  const h = Math.floor(t) % 24;
  const m = Math.round((t % 1) * 60);
  const ap = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}
