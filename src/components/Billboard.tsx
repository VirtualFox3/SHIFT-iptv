import React, { useState, useEffect, useRef } from 'react';
import type { Channel, Title } from '../types';
import { SCHEDULE } from '../data';
import { RatingsRow } from './Badges';
import * as Icons from './Icons';

interface BillboardProps {
  channel: Channel;
  bbStyle: string;
  channels: Channel[];
  titles: Title[];
  onPlay: (item: Channel | Title) => void;
  onOpen: (item: Channel | Title) => void;
  accentColor: string;
  vodHero?: Title;            // when set, render a VOD hero (Movies/Series tabs)
  heroKind?: 'Film' | 'Series';
}

export default function Billboard({ channel, bbStyle, channels, titles, onPlay, onOpen, accentColor, vodHero, heroKind }: BillboardProps) {
  if (vodHero) return <VodBillboard title={vodHero} kind={heroKind || 'Film'} bbStyle={bbStyle} posterPool={titles} onPlay={onPlay} onOpen={onOpen} accentColor={accentColor} />;
  if (!channel) return null;
  if (bbStyle === 'Mosaic') return <MosaicBillboard featured={channel} channels={channels} onPlay={onPlay} accentColor={accentColor} />;
  if (bbStyle === 'Centered') return <CenteredBillboard channel={channel} onPlay={onPlay} onOpen={onOpen} accentColor={accentColor} />;
  if (bbStyle === 'Cinema Wall') return <CinemaWallBillboard channel={channel} titles={titles} channels={channels} onPlay={onPlay} onOpen={onOpen} accentColor={accentColor} />;
  return <SpotlightBillboard channel={channel} onPlay={onPlay} onOpen={onOpen} accentColor={accentColor} />;
}

/* ── VOD billboard (Home / Movies / Series) — respects bbStyle ─────────────── */
function VodBillboard({ title, kind, bbStyle, posterPool, onPlay, onOpen, accentColor }: { title: Title; kind: 'Film' | 'Series'; bbStyle: string; posterPool: Title[]; onPlay: any; onOpen: any; accentColor: string }) {
  const centered = bbStyle === 'Centered';
  const cinemaWall = bbStyle === 'Cinema Wall';

  // Cinema Wall — a backdrop wall of movie posters behind the scrim.
  const wallPosters = React.useMemo(() => {
    if (!cinemaWall) return [];
    const withArt = posterPool.filter((t) => t.logoUrl && t.id !== title.id);
    const out: Title[] = [];
    for (let i = 0; i < 40; i++) out.push(withArt[i % Math.max(1, withArt.length)]);
    return out.filter(Boolean);
  }, [cinemaWall, posterPool, title.id]);

  const Meta = (
    <>
      {title.top && (
        <div style={{ marginBottom: 14, justifyContent: centered ? 'center' : 'flex-start', display: 'flex' }}>
          <span style={{ background: accentColor, color: '#fff', fontWeight: 800, fontSize: 12, padding: '4px 10px', borderRadius: 3, whiteSpace: 'nowrap' }}>TOP 10 · #{title.top} {kind}</span>
        </div>
      )}
      <h1 style={{ fontWeight: 900, fontSize: centered ? 'clamp(40px,5vw,72px)' : 'clamp(44px,5vw,76px)', lineHeight: 0.98, letterSpacing: '-0.02em', margin: '0 0 16px', textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>{title.title}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap', justifyContent: centered ? 'center' : 'flex-start' }}>
        {title.match != null && <span style={{ color: '#46D369', fontWeight: 700, fontSize: 15 }}>{title.match}% Match</span>}
        <span style={{ fontWeight: 700 }}>{title.year}</span>
        <span style={{ fontSize: 12, border: '1px solid rgba(255,255,255,0.5)', padding: '1px 6px', borderRadius: 2 }}>{title.rating}</span>
        <span style={{ color: 'var(--ink-3)' }}>{title.genres.slice(0, 3).join(' · ')}</span>
      </div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: centered ? 'center' : 'flex-start' }}><RatingsRow item={title} size={13} gap={14} /></div>
      {title.synopsis && <p style={{ fontSize: 17, lineHeight: 1.45, margin: '0 auto 22px', color: 'var(--ink-1)', textShadow: '0 2px 8px rgba(0,0,0,0.7)', maxWidth: 560 }}>{title.synopsis}</p>}
      <div style={{ display: 'flex', gap: 10, justifyContent: centered ? 'center' : 'flex-start' }}>
        <button onClick={() => onPlay(title)} style={bbBtn('white')}><Icons.Play size={22} />Play</button>
        <button onClick={() => onOpen(title)} style={bbBtn('grey')}><Icons.Info size={20} />More Info</button>
      </div>
    </>
  );

  return (
    <div style={{ position: 'relative', height: 680, marginBottom: -120, marginTop: -66, overflow: 'hidden' }}>
      {/* Cinema Wall poster grid */}
      {cinemaWall && wallPosters.length > 0 && (
        <div style={{ position: 'absolute', inset: -40, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gridAutoRows: '220px', gap: 8, opacity: 0.5 }}>
          {wallPosters.map((p, i) => (
            <div key={i} style={{ background: `#0a0a0a url(${p.logoUrl}) center/cover`, borderRadius: 4 }} />
          ))}
        </div>
      )}
      {/* Hero backdrop (non-cinema-wall) */}
      {!cinemaWall && title.logoUrl && <HeroImg src={title.logoUrl} />}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${title.grad[0]} 0%, ${title.grad[1]} 100%)`, opacity: cinemaWall ? 0 : (title.logoUrl ? 0.35 : 1) }} />
      <div style={{ position: 'absolute', inset: 0, background: cinemaWall ? 'rgba(10,10,10,0.55)' : 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0) 60%, rgba(20,20,20,0.95) 100%)' }} />
      {cinemaWall && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(20,20,20,0.4) 0%, rgba(20,20,20,0) 40%, rgba(20,20,20,0.95) 100%)' }} />}
      {!centered && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '60%', background: 'linear-gradient(90deg, rgba(0,0,0,0.78) 0%, transparent 100%)' }} />}

      {centered ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '66px 24px 150px', color: 'var(--ink-1)', maxWidth: 900, margin: '0 auto', left: 0, right: 0 }}>
          {Meta}
        </div>
      ) : (
        <div style={{ position: 'absolute', left: 48, bottom: 200, maxWidth: 620, color: 'var(--ink-1)' }}>
          {Meta}
        </div>
      )}
    </div>
  );
}

function SpotlightBillboard({ channel, onPlay, onOpen, accentColor }: { channel: Channel; onPlay: any; onOpen: any; accentColor: string }) {
  return (
    <div style={{ position: 'relative', height: 680, marginBottom: -120, marginTop: -66, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${channel.grad[0]} 0%, ${channel.grad[1]} 100%)` }} />
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 72% 42%, color-mix(in srgb, ${accentColor} 22%, transparent), transparent 55%)` }} />
      {/* Scrims */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0) 60%, rgba(20,20,20,0.9) 100%)' }} />
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '60%', background: 'linear-gradient(90deg, rgba(0,0,0,0.7) 0%, transparent 100%)' }} />

      <div style={{ position: 'absolute', left: 48, bottom: 200, maxWidth: 580, color: 'var(--ink-1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <LiveTag accentColor={accentColor} />
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--ink-2)' }}>{channel.name} · CH {channel.num}</span>
        </div>
        <h1 style={{ fontWeight: 900, fontSize: 'clamp(38px,4.5vw,62px)', lineHeight: 1.04, letterSpacing: '-0.02em', margin: '0 0 16px', textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>{channel.now}</h1>
        <p style={{ fontSize: 17, lineHeight: 1.45, margin: '0 0 20px', color: 'var(--ink-1)', textShadow: '0 2px 8px rgba(0,0,0,0.7)', maxWidth: 520 }}>{channel.desc}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, maxWidth: 400 }}>
          <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.22)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${channel.prog}%`, height: '100%', background: accentColor }} />
          </div>
          <span style={{ fontSize: 13, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>Up next · {channel.next}</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => onPlay(channel)} style={bbBtn('white')}>
            <Icons.Play size={22} />Watch Live
          </button>
          <button onClick={() => onOpen(channel)} style={bbBtn('grey')}>
            <Icons.Info size={20} />More Info
          </button>
        </div>
      </div>

      <div style={{ position: 'absolute', right: 48, bottom: 224, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icons.Volume size={14} />{channel.viewers} watching
        </span>
        <div style={{ padding: '5px 22px 5px 12px', background: 'rgba(35,35,35,0.6)', borderLeft: '4px solid var(--ink-1)', color: 'var(--ink-1)', fontSize: 13.5, fontWeight: 500 }}>{channel.rating}</div>
      </div>
    </div>
  );
}

function CenteredBillboard({ channel, onPlay, onOpen, accentColor }: { channel: Channel; onPlay: any; onOpen: any; accentColor: string }) {
  const chips = ['For You', 'Sports', 'News', 'Movies', 'Entertainment', 'Kids', 'Music', 'International'];
  return (
    <div style={{ position: 'relative', height: 600, marginTop: -66, marginBottom: 10, overflow: 'hidden', background: '#0c0c0c', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '66px 24px 120px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <LiveTag accentColor={accentColor} />
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--ink-1)', textTransform: 'uppercase' }}>{channel.cat} · {channel.name}</span>
        </div>
        <h1 style={{ fontWeight: 900, fontSize: 'clamp(38px,5vw,72px)', lineHeight: 1.05, letterSpacing: '-0.03em', margin: '0 0 24px', maxWidth: 900, color: 'var(--ink-1)' }}>{channel.now}</h1>
        <p style={{ fontSize: 18, lineHeight: 1.45, margin: '0 0 32px', color: '#c7c7c7', maxWidth: 660 }}>{channel.desc}</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => onPlay(channel)} style={bbBtn('white')}><Icons.Play size={22} />Watch Live</button>
          <button onClick={() => onOpen(channel)} style={bbBtn('grey')}><Icons.Info size={20} />More Info</button>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 22, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', padding: '0 24px' }}>
        {chips.map((c, i) => (
          <button key={c} style={{ fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5, padding: '8px 18px', borderRadius: 999, cursor: 'pointer', border: i === 0 ? '0' : '1px solid rgba(255,255,255,0.25)', background: i === 0 ? 'var(--ink-1)' : 'rgba(255,255,255,0.05)', color: i === 0 ? '#0a0a0a' : 'var(--ink-2)', transition: 'all 150ms' }}>{c}</button>
        ))}
      </div>
    </div>
  );
}

function MosaicBillboard({ featured, channels, onPlay, accentColor }: { featured: Channel; channels: Channel[]; onPlay: any; accentColor: string }) {
  const rest = channels.filter((c) => c.id !== featured.id);
  const grid = [rest[0], rest[2], rest[3], rest[9]].filter(Boolean).slice(0, 4);
  return (
    <div style={{ position: 'relative', marginTop: -66, padding: '100px 48px 20px', background: '#0c0c0c' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Live right now</h1>
        <div style={{ fontSize: 14, color: 'var(--ink-5)', fontWeight: 600, marginTop: 6 }}>
          {channels.length} channels <span style={{ color: accentColor }}>· {channels.length} airing</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, height: 520 }}>
        <div style={{ flex: 1 }}><MosaicCard ch={featured} featured onPlay={onPlay} accentColor={accentColor} /></div>
        <div style={{ flex: 1.1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 14 }}>
          {grid.map((ch) => <MosaicCard key={ch.id} ch={ch} onPlay={onPlay} accentColor={accentColor} />)}
        </div>
      </div>
    </div>
  );
}

function MosaicCard({ ch, featured, onPlay, accentColor }: { ch: Channel; featured?: boolean; onPlay: any; accentColor: string }) {
  const [hover, setHover] = useState(false);
  const bg = `linear-gradient(150deg, color-mix(in srgb, ${ch.grad[1]} 78%, #0a0a0c) 0%, color-mix(in srgb, ${ch.grad[0]} 55%, #0a0a0c) 52%, #0a0a0c 100%)`;
  return (
    <div onClick={() => onPlay(ch)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', height: '100%', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: bg, boxShadow: hover ? '0 0 0 2px rgba(255,255,255,0.65), 0 14px 30px rgba(0,0,0,0.55)' : 'inset 0 0 0 1px rgba(255,255,255,0.06)', transform: hover ? 'translateY(-2px)' : 'none', transition: 'all 200ms cubic-bezier(0.2,0.7,0.2,1)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55) 100%)' }} />
      <div style={{ position: 'absolute', top: featured ? 18 : 13, left: featured ? 18 : 13, right: featured ? 18 : 13, display: 'flex', alignItems: 'center', gap: featured ? 10 : 8 }}>
        <div style={{ width: featured ? 42 : 32, height: featured ? 42 : 32, borderRadius: 7, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.2)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: featured ? 14 : 12, color: 'var(--ink-1)', flexShrink: 0 }}>{ch.logo}</div>
        <div>
          <div style={{ fontSize: featured ? 15 : 13, fontWeight: 700, color: 'var(--ink-1)' }}>{ch.name}</div>
          <div style={{ fontSize: featured ? 12 : 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>CH {ch.num}</div>
        </div>
        {!featured && <span style={{ marginLeft: 'auto' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: accentColor, color: 'var(--ink-1)', fontWeight: 800, fontSize: 8, letterSpacing: '0.05em', padding: '2px 5px', borderRadius: 2 }}><span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--ink-1)' }} />LIVE</span></span>}
      </div>
      {hover && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <div style={{ width: featured ? 68 : 50, height: featured ? 68 : 50, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: '2px solid var(--ink-1)', display: 'grid', placeItems: 'center' }}><Icons.Play size={featured ? 28 : 20} /></div>
        </div>
      )}
      <div style={{ position: 'absolute', left: featured ? 22 : 14, right: featured ? 22 : 14, bottom: featured ? 26 : 18 }}>
        <div style={{ fontSize: featured ? 30 : 15, fontWeight: 800, lineHeight: 1.12, color: 'var(--ink-1)', textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>{ch.now}</div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(255,255,255,0.2)' }}>
        <div style={{ width: `${ch.prog}%`, height: '100%', background: accentColor }} />
      </div>
    </div>
  );
}

function CinemaWallBillboard({ channel, titles, channels, onPlay, onOpen, accentColor }: { channel: Channel; titles: Title[]; channels: Channel[]; onPlay: any; onOpen: any; accentColor: string }) {
  const pool = React.useMemo(() => {
    const t = titles.map((x) => ({ grad: x.grad, label: x.title, shift: x.isShift }));
    const c = channels.map((x) => ({ grad: x.grad, label: x.name, live: true }));
    const mix: typeof t = [];
    const n = Math.max(t.length, c.length);
    for (let i = 0; i < n; i++) { if (t[i]) mix.push(t[i]); if (c[i]) mix.push({ ...c[i], shift: false }); }
    const out: typeof t = [];
    for (let i = 0; i < 70; i++) out.push(mix[i % mix.length]);
    return out;
  }, []);

  return (
    <div style={{ position: 'relative', height: 680, marginBottom: -120, marginTop: -66, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: -70, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(116px, 1fr))', gridAutoRows: '174px', gap: 10, alignContent: 'start' }}>
        {pool.map((p, i) => (
          <div key={i} style={{ borderRadius: 4, overflow: 'hidden', background: `linear-gradient(150deg, ${p.grad[0]} 0%, ${p.grad[1]} 100%)`, boxShadow: '0 6px 18px rgba(0,0,0,0.4)', position: 'relative' }}>
            {p.shift && <span style={{ position: 'absolute', top: 7, left: 8, color: accentColor, fontWeight: 900, fontSize: 9, letterSpacing: '0.12em' }}>SHIFT</span>}
            {(p as any).live && <span style={{ position: 'absolute', top: 7, left: 8, display: 'inline-flex', alignItems: 'center', gap: 3, background: accentColor, color: 'var(--ink-1)', fontWeight: 800, fontSize: 7, padding: '2px 5px', borderRadius: 2 }}><span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--ink-1)' }} />LIVE</span>}
            <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, fontSize: 10, fontWeight: 700, color: 'var(--ink-1)', textShadow: '0 1px 4px rgba(0,0,0,0.8)', lineHeight: 1.15 }}>{p.label}</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,8,0.5)' }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, color-mix(in srgb, ${channel.grad[0]} 60%, transparent) 0%, transparent 60%)` }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 45%, rgba(20,20,20,0.9) 100%)' }} />
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '55%', background: 'linear-gradient(90deg, rgba(0,0,0,0.7) 0%, transparent 100%)' }} />

      <div style={{ position: 'absolute', left: 48, bottom: 200, maxWidth: 580, color: 'var(--ink-1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <LiveTag accentColor={accentColor} />
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--ink-2)' }}>{channel.name} · CH {channel.num}</span>
        </div>
        <h1 style={{ fontWeight: 900, fontSize: 'clamp(36px,4vw,58px)', lineHeight: 1.04, letterSpacing: '-0.02em', margin: '0 0 14px', textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>{channel.now}</h1>
        <p style={{ fontSize: 16, lineHeight: 1.45, margin: '0 0 20px', color: '#f0f0f0', maxWidth: 500 }}>{channel.desc}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => onPlay(channel)} style={bbBtn('white')}><Icons.Play size={22} />Watch Live</button>
          <button onClick={() => onOpen(channel)} style={bbBtn('grey')}><Icons.Info size={20} />More Info</button>
        </div>
      </div>
    </div>
  );
}

function LiveTag({ accentColor }: { accentColor: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: accentColor, color: 'var(--ink-1)', fontWeight: 800, fontSize: 11.5, letterSpacing: '0.08em', padding: '4px 10px', borderRadius: 3 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-1)' }} />LIVE
    </span>
  );
}

/** Hero backdrop image with automatic retry (up to 2 retries) for flaky provider CDNs.
 *  Proxied through /api/proxy to fix HTTP→HTTPS mixed-content blocks. */
function HeroImg({ src }: { src: string }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const retriesRef = useRef(0);

  useEffect(() => {
    retriesRef.current = 0;
    setAttempt(0);
    setFailed(false);
  }, [src]);

  const proxied = `/api/proxy?url=${encodeURIComponent(src)}`;

  if (failed) return null;
  return (
    <img
      key={`${proxied}_${attempt}`}
      src={proxied}
      alt=""
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      {...{ fetchPriority: 'high' }}
      onError={() => {
        if (retriesRef.current < 2) {
          const delay = (retriesRef.current + 1) * 1200;
          retriesRef.current++;
          setTimeout(() => setAttempt((a) => a + 1), delay);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}

export function bbBtn(variant: 'white' | 'grey' | 'ghostAccent'): React.CSSProperties {
  const base: React.CSSProperties = { fontFamily: 'inherit', fontWeight: 700, fontSize: 17, padding: '11px 26px', borderRadius: 4, border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10, transition: 'all 140ms' };
  if (variant === 'white') return { ...base, background: 'var(--ink-1)', color: '#000' };
  if (variant === 'grey') return { ...base, background: 'rgba(109,109,110,0.7)', color: 'var(--ink-1)' };
  return { ...base, background: 'rgba(229,9,20,0.2)', color: 'var(--ink-1)', border: '1px solid rgba(229,9,20,0.5)' };
}
