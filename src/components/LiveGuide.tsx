import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { Channel, Provider } from '../types';
import { SCHEDULE } from '../data';
import { xtreamGetShortEPG, type EPGListing } from '../api/xtream';

interface LiveGuideProps {
  channels: Channel[];
  onPlay: (ch: Channel) => void;
  onOpen: (ch: Channel) => void;
  accentColor: string;
  provider: Provider | null;
}

interface ScheduleEntry { t: number; dur: number; title: string; desc: string; live?: boolean; }

const PAGE = 60;
const COL_W = 220;
const ROW_H = 68;
const LABEL_W = 220;
const MAX_CATS = 11; // + "All"
// Show from 1 hour before now, 7 hours total
const EPG_WINDOW_BEFORE = 1;
const EPG_WINDOW_HOURS = 7;

function tsToHour(ts: number): number {
  const d = new Date(ts * 1000);
  return d.getHours() + d.getMinutes() / 60;
}

export default function LiveGuide({ channels: allChannels, onPlay, onOpen, accentColor, provider }: LiveGuideProps) {
  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const start = Math.max(0, Math.floor(nowH) - EPG_WINDOW_BEFORE);
  const hours = EPG_WINDOW_HOURS;

  const [filter, setFilter] = useState('');
  const [cat, setCat] = useState('All');
  const [shown, setShown] = useState(PAGE);
  const [epgMap, setEpgMap] = useState<Record<string, ScheduleEntry[]>>({});
  const [epgLoading, setEpgLoading] = useState(false);
  const fetchedIds = useRef(new Set<string>());

  const cats = useMemo(() => {
    const count = new Map<string, number>();
    allChannels.forEach((c) => count.set(c.cat || 'General', (count.get(c.cat || 'General') || 0) + 1));
    const top = [...count.keys()].sort((a, b) => (count.get(b) || 0) - (count.get(a) || 0)).slice(0, MAX_CATS);
    return ['All', ...top];
  }, [allChannels]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return allChannels.filter((c) =>
      (cat === 'All' || c.cat === cat) &&
      (!q || c.name.toLowerCase().includes(q) || c.cat.toLowerCase().includes(q))
    );
  }, [allChannels, filter, cat]);
  const channels = filtered.slice(0, shown);

  useEffect(() => setShown(PAGE), [filter, cat]);

  // Fetch EPG for visible Xtream channels
  useEffect(() => {
    if (!provider || provider.type !== 'xtream') return;
    const auth = { serverUrl: provider.serverUrl!, username: provider.username!, password: provider.password! };

    const toFetch = channels.filter((ch) => ch.id.startsWith('xt_live_') && !fetchedIds.current.has(ch.id));
    if (toFetch.length === 0) return;

    toFetch.forEach((ch) => fetchedIds.current.add(ch.id));
    setEpgLoading(true);

    // Batch in groups of 10 to avoid flooding the provider
    const BATCH = 10;
    const batches: Channel[][] = [];
    for (let i = 0; i < toFetch.length; i += BATCH) batches.push(toFetch.slice(i, i + BATCH));

    (async () => {
      for (const batch of batches) {
        await Promise.all(batch.map(async (ch) => {
          const streamId = ch.id.replace('xt_live_', '');
          const listings = await xtreamGetShortEPG(auth, streamId);
          if (!listings.length) return;
          const entries: ScheduleEntry[] = listings.map((e: EPGListing) => {
            const t = tsToHour(e.start);
            const dur = (e.end - e.start) / 3600;
            const nowTs = Date.now() / 1000;
            return { t, dur, title: e.title, desc: e.description, live: e.start <= nowTs && e.end > nowTs };
          }).filter((e: ScheduleEntry) => e.dur > 0);
          setEpgMap((prev) => ({ ...prev, [ch.id]: entries }));
        }));
      }
      setEpgLoading(false);
    })();
  }, [channels.map((c) => c.id).join(','), provider?.id]);

  const timeHeaders = useMemo(() => {
    const h = [];
    for (let i = 0; i <= hours; i++) {
      const hh = (start + i) % 24;
      const pad = (n: number) => String(n).padStart(2, '0');
      h.push({ label: `${pad(hh)}:00`, offset: i * COL_W });
    }
    return h;
  }, [start]);

  const nowOffset = Math.max(0, (nowH - start) * COL_W);

  if (allChannels.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--app-bg)', color: 'var(--ink-5)', gap: 12 }}>
        <div style={{ fontSize: 48 }}>📡</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-3)' }}>No live channels</div>
        <div style={{ fontSize: 14, color: 'var(--ink-5)' }}>Connect a real provider in Settings to see your channel guide.</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', paddingTop: 24, background: 'var(--app-bg)' }}>
      <div style={{ padding: '0 48px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink-1)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', color: accentColor }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: accentColor }} />LIVE
            </span>
            TV Guide
          </h1>
          <input value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter channels…"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--input-border)', borderRadius: 8, padding: '10px 14px', color: 'var(--ink-1)', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: 260 }} />
        </div>
        <p style={{ color: 'var(--ink-5)', fontSize: 14, margin: '0 0 16px' }}>
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {filtered.length.toLocaleString()} channels
          {epgLoading && <span style={{ marginLeft: 10, color: accentColor, fontSize: 12, fontWeight: 700 }}>● Loading guide…</span>}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} style={{
              padding: '7px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              border: cat === c ? '1px solid transparent' : '1px solid var(--input-border)',
              background: cat === c ? accentColor : 'transparent', color: cat === c ? '#fff' : 'var(--ink-3)', transition: 'all 150ms',
            }}>{c}</button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: 24, borderTop: '1px solid var(--hair-1)' }}>
        <div style={{ minWidth: 900, position: 'relative' }}>
          {/* Time header */}
          <div style={{ display: 'flex', paddingLeft: LABEL_W, position: 'sticky', top: 66, background: 'var(--surface-2)', zIndex: 10, borderBottom: '1px solid var(--hair-1)' }}>
            {timeHeaders.map((h) => (
              <div key={h.label} style={{ width: COL_W, flexShrink: 0, padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--ink-5)', letterSpacing: '0.08em' }}>
                {h.label}
              </div>
            ))}
          </div>

          {/* "Now" indicator */}
          {nowH >= start && nowH <= start + hours && (
            <div style={{ position: 'absolute', left: LABEL_W + nowOffset, top: 0, bottom: 0, width: 2, background: accentColor, zIndex: 5, pointerEvents: 'none', boxShadow: `0 0 8px ${accentColor}80` }}>
              <div style={{ position: 'absolute', top: 32, left: -18, background: accentColor, color: '#fff', fontSize: 9, fontWeight: 800, padding: '3px 6px', borderRadius: 3, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>NOW</div>
            </div>
          )}

          {/* Channel rows */}
          {channels.map((ch, ri) => {
            const schedule = epgMap[ch.id] || SCHEDULE[ch.id] || [];
            return (
              <div key={ch.id} style={{ display: 'flex', borderBottom: '1px solid var(--hair-1)', minHeight: ROW_H, background: ri % 2 === 1 ? 'var(--bg-hover)' : 'transparent' }}>
                {/* Channel label */}
                <div onClick={() => onPlay(ch)}
                  style={{ width: LABEL_W, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', position: 'sticky', left: 0, background: ri % 2 === 1 ? 'var(--surface-2)' : 'var(--app-bg)', zIndex: 4, borderRight: '1px solid var(--hair-1)', cursor: 'pointer', transition: 'background 140ms' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = ri % 2 === 1 ? 'var(--surface-2)' : 'var(--app-bg)')}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: ch.logoUrl ? '#0a0a0a' : `linear-gradient(135deg,${ch.grad[0]},${ch.grad[1]})`, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 11, color: '#fff', flexShrink: 0, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
                    {ch.logoUrl
                      ? <img src={ch.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.parentElement as HTMLElement).textContent = ch.logo; }} />
                      : ch.logo}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-5)' }}>CH {ch.num} · {ch.cat}</div>
                  </div>
                </div>

                {/* Programme blocks */}
                <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', height: ROW_H }}>
                  {schedule.length === 0 && (
                    <button onClick={() => onPlay(ch)} style={{
                      position: 'absolute', left: 0, width: hours * COL_W - 2, top: 6, bottom: 6,
                      background: 'var(--surface-2)', border: `1px solid ${accentColor}30`,
                      borderLeft: `3px solid ${accentColor}`,
                      borderRadius: 6, cursor: 'pointer', padding: '0 14px',
                      display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', overflow: 'hidden',
                      transition: 'background 140ms',
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-3)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}>
                      <LiveBadge color={accentColor} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--ink-5)', whiteSpace: 'nowrap', flexShrink: 0 }}>· Live programming</span>
                    </button>
                  )}
                  {schedule
                    .filter((p) => p.t + p.dur > start && p.t < start + hours)
                    .map((p, i) => {
                      const left = Math.max(0, (p.t - start) * COL_W);
                      const right = Math.min(hours * COL_W, (p.t + p.dur - start) * COL_W);
                      const width = right - left;
                      if (width <= 0) return null;
                      const isNow = !!p.live || (nowH >= p.t && nowH < p.t + p.dur);
                      // Live TV can only be tuned to what's airing now — past/future
                      // slots open the channel's info instead of jumping the stream.
                      const handleClick = () => (isNow ? onPlay(ch) : onOpen(ch));
                      return (
                        <button key={i} onClick={handleClick} title={p.desc || p.title} style={{
                          position: 'absolute', left, width: width - 2, top: 6, bottom: 6,
                          background: isNow ? `linear-gradient(90deg, color-mix(in srgb, ${accentColor} 22%, var(--surface-2)), var(--surface-2))` : 'var(--surface-2)',
                          border: isNow ? `1px solid ${accentColor}50` : '1px solid var(--hair-1)',
                          borderLeft: isNow ? `3px solid ${accentColor}` : '1px solid var(--hair-1)',
                          borderRadius: 6, cursor: 'pointer', padding: '4px 12px',
                          display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'left',
                          overflow: 'hidden', transition: 'background 140ms',
                        }}
                          onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.18)')}
                          onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}>
                          {isNow && <LiveBadge color={accentColor} style={{ alignSelf: 'flex-start', marginBottom: 2 }} />}
                          <div style={{ fontSize: 13, fontWeight: isNow ? 700 : 500, color: isNow ? 'var(--ink-1)' : 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.title}
                          </div>
                          <div style={{ fontSize: 10.5, color: 'var(--ink-5)', marginTop: 1 }}>
                            {fmt24(p.t)} – {fmt24(p.t + p.dur)}
                          </div>
                          {isNow && (
                            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: 'rgba(128,128,128,0.2)' }}>
                              <div style={{ width: `${Math.min(100, ((nowH - p.t) / p.dur) * 100)}%`, height: '100%', background: accentColor, opacity: 0.8 }} />
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

function LiveBadge({ color, style }: { color: string; style?: React.CSSProperties }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: color, color: '#fff',
      fontWeight: 800, fontSize: 9, letterSpacing: '0.07em',
      padding: '2px 6px', borderRadius: 3, flexShrink: 0,
      ...style,
    }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff', opacity: 0.85 }} />LIVE
    </span>
  );
}

function fmt24(t: number): string {
  const h = Math.floor(t) % 24;
  const m = Math.round((t % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
