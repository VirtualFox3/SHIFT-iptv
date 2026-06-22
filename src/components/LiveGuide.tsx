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
  const COL_W = 220;

  const [filter, setFilter] = useState('');
  const [shown, setShown] = useState(PAGE);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? allChannels.filter((c) => c.name.toLowerCase().includes(q) || c.cat.toLowerCase().includes(q)) : allChannels;
  }, [allChannels, filter]);
  const channels = filtered.slice(0, shown);

  const timeHeaders = useMemo(() => {
    const h = [];
    for (let i = 0; i <= hours; i++) {
      const hh = (start + i) % 24;
      const pad = (n: number) => String(n).padStart(2, '0');
      h.push({ label: `${pad(hh)}:00`, offset: i * COL_W });
    }
    return h;
  }, []);

  const nowOffset = Math.max(0, (nowH - start) * COL_W);

  if (allChannels.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#141414', color: '#555', gap: 12 }}>
        <div style={{ fontSize: 48 }}>📡</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#888' }}>No live channels</div>
        <div style={{ fontSize: 14, color: '#555' }}>Connect a real provider in Settings to see your channel guide.</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', paddingTop: 24, background: '#141414' }}>
      <div style={{ padding: '0 48px', marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>TV Guide</h1>
          <p style={{ color: '#8a8a8a', fontSize: 14, marginTop: 6 }}>
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {filtered.length.toLocaleString()} channels
          </p>
        </div>
        <input value={filter} onChange={(e) => { setFilter(e.target.value); setShown(PAGE); }}
          placeholder="Filter channels…"
          style={{ background: '#1f1f1f', border: '1px solid #333', borderRadius: 6, padding: '10px 14px', color: '#fff', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: 260 }} />
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 24 }}>
        <div style={{ minWidth: 900, position: 'relative' }}>
          {/* Time header */}
          <div style={{ display: 'flex', paddingLeft: 200, position: 'sticky', top: 66, background: '#0f0f0f', zIndex: 10, borderBottom: '1px solid #2a2a2a' }}>
            {timeHeaders.map((h) => (
              <div key={h.label} style={{ width: COL_W, flexShrink: 0, padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: '0.08em' }}>
                {h.label}
              </div>
            ))}
          </div>

          {/* "Now" indicator */}
          {nowH >= start && nowH <= start + hours && (
            <div style={{ position: 'absolute', left: 200 + nowOffset, top: 0, bottom: 0, width: 2, background: accentColor, zIndex: 5, pointerEvents: 'none', boxShadow: `0 0 8px ${accentColor}80` }}>
              <div style={{ position: 'absolute', top: 32, left: -18, background: accentColor, color: '#fff', fontSize: 9, fontWeight: 800, padding: '3px 6px', borderRadius: 3, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>NOW</div>
            </div>
          )}

          {/* Channel rows */}
          {channels.map((ch) => {
            const schedule = SCHEDULE[ch.id] || [];
            return (
              <div key={ch.id} style={{ display: 'flex', borderBottom: '1px solid #1c1c1c', minHeight: 64 }}>
                {/* Channel label */}
                <div onClick={() => onPlay(ch)} style={{ width: 200, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', position: 'sticky', left: 0, background: '#141414', zIndex: 4, borderRight: '1px solid #242424', cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#141414')}>
                  <div style={{ width: 38, height: 38, borderRadius: 8, background: ch.logoUrl ? '#0a0a0a' : `linear-gradient(135deg,${ch.grad[0]},${ch.grad[1]})`, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 11, flexShrink: 0, overflow: 'hidden' }}>
                    {ch.logoUrl
                      ? <img src={ch.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.parentElement as HTMLElement).textContent = ch.logo; }} />
                      : ch.logo}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#e5e5e5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.name}</div>
                    <div style={{ fontSize: 11, color: '#555' }}>CH {ch.num}</div>
                  </div>
                </div>

                {/* Programme blocks */}
                <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', height: 64 }}>
                  {schedule.length === 0 && (
                    <button onClick={() => onPlay(ch)} style={{
                      position: 'absolute', left: 0, width: hours * COL_W - 2, top: 5, bottom: 5,
                      background: '#1a1a1a',
                      border: `1px solid ${accentColor}30`,
                      borderLeft: `3px solid ${accentColor}`,
                      borderRadius: 6, cursor: 'pointer', padding: '0 14px',
                      display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', overflow: 'hidden',
                      transition: 'background 140ms',
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#222')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#1a1a1a')}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: accentColor, color: '#fff',
                        fontWeight: 800, fontSize: 10, letterSpacing: '0.06em',
                        padding: '3px 7px', borderRadius: 4, flexShrink: 0,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', opacity: 0.8 }} />LIVE
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#ddd', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.name}</span>
                      <span style={{ fontSize: 12, color: '#555', whiteSpace: 'nowrap' }}>· Live programming</span>
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
                          position: 'absolute', left, width: width - 2, top: 5, bottom: 5,
                          background: isNow ? `linear-gradient(90deg, color-mix(in srgb, ${accentColor} 25%, #1a1a1a), #1a1a1a)` : '#1a1a1a',
                          border: isNow ? `1px solid ${accentColor}50` : '1px solid #282828',
                          borderLeft: isNow ? `3px solid ${accentColor}` : '1px solid #282828',
                          borderRadius: 6, cursor: 'pointer', padding: '0 12px',
                          display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'left',
                          overflow: 'hidden', transition: 'background 140ms',
                        }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = isNow ? `linear-gradient(90deg, color-mix(in srgb, ${accentColor} 32%, #222), #222)` : '#222')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = isNow ? `linear-gradient(90deg, color-mix(in srgb, ${accentColor} 25%, #1a1a1a), #1a1a1a)` : '#1a1a1a')}>
                          {isNow && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
                              background: accentColor, color: '#fff',
                              fontWeight: 800, fontSize: 9, letterSpacing: '0.07em',
                              padding: '2px 6px', borderRadius: 3, marginBottom: 3, flexShrink: 0,
                            }}>
                              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff', opacity: 0.85 }} />LIVE
                            </span>
                          )}
                          <div style={{ fontSize: 13, fontWeight: isNow ? 700 : 500, color: isNow ? '#fff' : '#bbb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.title}
                          </div>
                          <div style={{ fontSize: 10.5, color: '#555', marginTop: 1 }}>
                            {fmt24(p.t)} – {fmt24(p.t + p.dur)}
                          </div>
                          {isNow && (
                            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: 'rgba(255,255,255,0.08)' }}>
                              <div style={{ width: `${ch.prog}%`, height: '100%', background: accentColor, opacity: 0.7 }} />
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
            style={{ background: '#1f1f1f', border: '1px solid #383838', color: '#fff', borderRadius: 6, padding: '11px 26px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Load more channels ({filtered.length - shown} left)
          </button>
        </div>
      )}
    </div>
  );
}

function fmt24(t: number): string {
  const h = Math.floor(t) % 24;
  const m = Math.round((t % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
