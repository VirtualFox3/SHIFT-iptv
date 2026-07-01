import React, { useMemo, useState, useEffect } from 'react';
import type { Channel, Provider } from '../types';
import { SCHEDULE } from '../data';
import { xtreamGetFullEpg, type EPGListing } from '../api/xtream';

interface LiveGuideProps {
  channels: Channel[];
  onPlay: (ch: Channel) => void;
  onOpen: (ch: Channel) => void;
  accentColor: string;
  provider: Provider | null;
}

interface ScheduleEntry { t: number; dur: number; title: string; desc?: string; live?: boolean; }

const PAGE = 60;
const COL_W = 240;
const ROW_H = 78;
const LABEL_W = 260;
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
  const [fullEpg, setFullEpg] = useState<Map<string, EPGListing[]>>(new Map());
  const [epgLoading, setEpgLoading] = useState(false);

  // Fetch the WHOLE multi-day guide in one request — far richer than the old
  // per-channel approach, and lets us know which channels are live right now
  // before deciding which page of the (possibly huge) channel list to show.
  useEffect(() => {
    if (!provider || provider.type !== 'xtream' || !provider.serverUrl || !provider.username) {
      setFullEpg(new Map());
      return;
    }
    const auth = { serverUrl: provider.serverUrl, username: provider.username, password: provider.password || '' };
    setEpgLoading(true);
    xtreamGetFullEpg(auth).then((map) => { setFullEpg(map); setEpgLoading(false); });
  }, [provider?.id]);

  const scheduleFor = (ch: Channel): ScheduleEntry[] => {
    const listings = ch.epgId ? fullEpg.get(ch.epgId) : undefined;
    if (listings?.length) {
      const nowTs = Date.now() / 1000;
      return listings.map((e) => ({
        t: tsToHour(e.start),
        dur: (e.end - e.start) / 3600,
        title: e.title,
        desc: e.description,
        live: e.start <= nowTs && e.end > nowTs,
      })).filter((e) => e.dur > 0);
    }
    return SCHEDULE[ch.id] || [];
  };
  const isLiveNow = (ch: Channel) => {
    const sched = scheduleFor(ch);
    return sched.some((p) => p.live || (nowH >= p.t && nowH < p.t + p.dur));
  };

  const cats = useMemo(() => {
    const count = new Map<string, number>();
    allChannels.forEach((c) => count.set(c.cat || 'General', (count.get(c.cat || 'General') || 0) + 1));
    const top = [...count.keys()].sort((a, b) => (count.get(b) || 0) - (count.get(a) || 0)).slice(0, MAX_CATS);
    return ['All', ...top];
  }, [allChannels]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = allChannels.filter((c) =>
      (cat === 'All' || c.cat === cat) &&
      (!q || c.name.toLowerCase().includes(q) || c.cat.toLowerCase().includes(q))
    );
    // Currently-airing channels float to the top across the WHOLE filtered
    // list (not just the loaded page) now that we have the full guide upfront.
    return [...list].sort((a, b) => Number(isLiveNow(b)) - Number(isLiveNow(a)));
  }, [allChannels, filter, cat, fullEpg]);
  const channels = filtered.slice(0, shown);

  useEffect(() => setShown(PAGE), [filter, cat]);

  const timeHeaders = useMemo(() => {
    const slots = [];
    for (let h = start; h < start + hours; h += 0.5) slots.push(h);
    return slots;
  }, [start, hours]);

  const nowOffset = Math.max(0, (nowH - start) * COL_W);
  const fmt24h = (h: number) => {
    const hh = Math.floor(h) % 24, mm = Math.round((h - Math.floor(h)) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 6 }}>
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

      <div style={{ overflowX: 'auto', paddingBottom: 60 }}>
        <div style={{ minWidth: LABEL_W + hours * COL_W }}>
          {/* time header */}
          <div style={{ display: 'flex', position: 'sticky', top: 66, zIndex: 4 }}>
            <div style={{ width: LABEL_W, flexShrink: 0, background: 'var(--app-bg)' }} />
            <div style={{ position: 'relative', height: 38, flex: 1, background: 'var(--app-bg)', borderBottom: '1px solid var(--hair-2)' }}>
              {timeHeaders.map((h, i) => (
                <div key={h} style={{ position: 'absolute', left: (h - start) * COL_W, top: 0, height: '100%', display: 'flex', alignItems: 'center', color: 'var(--ink-5)', fontSize: 12, fontWeight: 700, borderLeft: i % 2 === 0 ? '1px solid var(--hair-2)' : 'none', paddingLeft: 10 }}>
                  {i % 2 === 0 ? fmt24h(h) : ''}
                </div>
              ))}
              {nowH >= start && nowH <= start + hours && (
                <div style={{ position: 'absolute', left: nowOffset, top: 0, transform: 'translateX(-50%)', background: accentColor, color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 3, zIndex: 5, letterSpacing: '0.06em' }}>NOW</div>
              )}
            </div>
          </div>

          {/* rows */}
          <div style={{ position: 'relative' }}>
            {nowH >= start && nowH <= start + hours && (
              <div style={{ position: 'absolute', left: LABEL_W + nowOffset, top: 0, bottom: 0, width: 2, background: accentColor, zIndex: 3, pointerEvents: 'none' }} />
            )}
            {channels.map((ch) => {
              const schedule = scheduleFor(ch);
              return (
                <div key={ch.id} style={{ display: 'flex', height: ROW_H, borderBottom: '1px solid var(--hair-1)' }}>
                  {/* channel label */}
                  <div onClick={() => onPlay(ch)}
                    style={{ width: LABEL_W, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', cursor: 'pointer', background: 'var(--app-bg)', borderRight: '1px solid var(--hair-1)', position: 'sticky', left: 0, zIndex: 2, transition: 'background 140ms' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-soft)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--app-bg)')}>
                    <div style={{ width: 46, height: 46, borderRadius: 6, background: ch.logoUrl ? '#0a0a0a' : `linear-gradient(135deg,${ch.grad[0]},${ch.grad[1]})`, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                      {ch.logoUrl
                        ? <img src={ch.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.parentElement as HTMLElement).textContent = ch.logo; }} />
                        : ch.logo}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isLiveNow(ch) && <span style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />}
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.name}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-5)' }}>CH {ch.num} · {ch.cat}</div>
                    </div>
                  </div>

                  {/* programmes track */}
                  <div style={{ position: 'relative', flex: 1 }}>
                    {schedule.length === 0 && (
                      <button onClick={() => onPlay(ch)} style={{
                        position: 'absolute', left: 3, top: 6, width: hours * COL_W - 6, height: ROW_H - 12,
                        borderRadius: 6, padding: '0 14px', cursor: 'pointer', overflow: 'hidden',
                        display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                        background: 'var(--surface-2)', border: `1px solid ${accentColor}30`, transition: 'background 150ms',
                      }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-3)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}>
                        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color: '#fff', background: accentColor, padding: '1px 5px', borderRadius: 2, flexShrink: 0 }}>LIVE</span>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.name} · Live programming</span>
                      </button>
                    )}
                    {schedule
                      .filter((p) => p.t + p.dur > start && p.t < start + hours)
                      .map((p, i) => {
                        const visStart = Math.max(p.t, start);
                        const left = (visStart - start) * COL_W;
                        const width = (Math.min(p.t + p.dur, start + hours) - visStart) * COL_W;
                        if (width <= 0) return null;
                        const isOn = !!p.live || (nowH >= p.t && nowH < p.t + p.dur);
                        // Live TV can only be tuned to what's airing now — past/future
                        // slots open the channel's info instead of jumping the stream.
                        const handleClick = () => (isOn ? onPlay(ch) : onOpen(ch));
                        return (
                          <button key={i} onClick={handleClick} title={p.desc || p.title} style={{
                            position: 'absolute', left: left + 3, top: 6, width: width - 6, height: ROW_H - 12,
                            borderRadius: 6, padding: '10px 12px', cursor: 'pointer', overflow: 'hidden', textAlign: 'left',
                            background: isOn ? `color-mix(in srgb, ${accentColor} 26%, var(--surface-2))` : 'var(--surface-2)',
                            border: isOn ? `1px solid ${accentColor}` : '1px solid var(--hair-2)', transition: 'background 150ms',
                          }}
                            onMouseEnter={(e) => { if (!isOn) e.currentTarget.style.background = 'var(--surface-3)'; }}
                            onMouseLeave={(e) => { if (!isOn) e.currentTarget.style.background = 'var(--surface-2)'; }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              {isOn && <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color: '#fff', background: accentColor, padding: '1px 5px', borderRadius: 2 }}>LIVE</span>}
                              <span style={{ fontSize: 11.5, color: 'var(--ink-5)' }}>{fmt24h(p.t)}</span>
                            </div>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {shown < filtered.length && (
        <div style={{ padding: '0 48px 40px', textAlign: 'center' }}>
          <button onClick={() => setShown((s) => s + PAGE)}
            style={{ background: 'var(--surface-2)', border: '1px solid var(--input-border)', color: 'var(--ink-1)', borderRadius: 6, padding: '11px 26px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Load more channels ({filtered.length - shown} left)
          </button>
        </div>
      )}
    </div>
  );
}
