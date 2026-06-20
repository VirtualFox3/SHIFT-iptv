import React, { useState, useRef, useEffect } from 'react';
import type { Title, Channel } from '../types';
import { useStore } from '../store/useStore';
import { RatingsRow } from './Badges';
import * as Icons from './Icons';

const POP_W = 348;
const HEADER_SAFE = 78;

interface PosterProps {
  title: Title;
  idx?: number;
  isTopRow?: boolean;
  progress?: number;
  onPlay: (item: Title | Channel) => void;
  onOpen: (item: Title | Channel) => void;
}

export default function Poster({ title, idx = 0, isTopRow, progress, onPlay, onOpen }: PosterProps) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [previewActive, setPreviewActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myList = useStore((s) => s.myList);
  const toggleMyList = useStore((s) => s.toggleMyList);
  const inList = myList.includes(title.id);
  const accentColor = useStore((s) => s.settings.accentColor);
  const cardRadius = useStore((s) => s.settings.cardRadius);

  function openPreview() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const heroH = POP_W * 9 / 16;
    const popH = heroH + 170;
    let left = r.left + r.width / 2 - POP_W / 2;
    left = Math.max(12, Math.min(left, vw - POP_W - 12));
    let top = r.top + r.height / 2 - popH / 2;
    top = Math.max(HEADER_SAFE, Math.min(top, vh - popH - 12));
    setPos({ left, top });
    setHover(true);
  }
  function onEnter() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(openPreview, 260);
    previewTimer.current = setTimeout(() => setPreviewActive(true), 1260);
  }
  function onLeave() {
    if (timer.current) clearTimeout(timer.current);
    if (previewTimer.current) clearTimeout(previewTimer.current);
    setHover(false);
    setPos(null);
    setPreviewActive(false);
  }
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (previewTimer.current) clearTimeout(previewTimer.current);
  }, []);

  return (
    <div ref={ref} onMouseEnter={onEnter} onMouseLeave={onLeave} style={{ position: 'relative', width: 280, flexShrink: 0 }}>
      {/* Card */}
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '16/9',
        borderRadius: cardRadius, overflow: 'hidden',
        background: `linear-gradient(135deg, ${title.grad[0]} 0%, ${title.grad[1]} 100%)`,
        cursor: 'pointer',
      }} onClick={() => onOpen(title)}>
        {title.logoUrl && (
          <img src={title.logoUrl} alt="" loading="lazy"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        )}
        {isTopRow && (
          <div style={{ position: 'absolute', left: -14, bottom: -38, fontWeight: 900, fontSize: 200, lineHeight: 1, color: 'transparent', WebkitTextStroke: '8px #fff', letterSpacing: '-0.08em', userSelect: 'none' }}>
            {idx + 1}
          </div>
        )}
        {title.isShift && (
          <span style={{ position: 'absolute', top: 10, left: 12, color: accentColor, fontWeight: 900, fontSize: 13, letterSpacing: '0.12em' }}>SHIFT</span>
        )}
        <div style={{ position: 'absolute', right: 14, bottom: 14, left: 14, color: '#fff', fontWeight: 800, fontSize: 16, textAlign: 'right', textShadow: '0 2px 6px rgba(0,0,0,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title.title}
        </div>
        {progress != null && progress > 0 && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(255,255,255,0.3)' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: accentColor }} />
          </div>
        )}
      </div>

      {/* Viewport-clamped fixed hover popup */}
      {hover && pos && (
        <div
          onClick={() => onOpen(title)}
          style={{
            position: 'fixed', left: pos.left, top: pos.top, width: POP_W,
            background: '#1F1F1F', borderRadius: cardRadius || 6, overflow: 'hidden',
            boxShadow: '0 12px 30px rgba(0,0,0,0.75)', zIndex: 2000, cursor: 'pointer',
            animation: 'nfxPop2 180ms cubic-bezier(0.2,0.7,0.2,1)',
          }}
        >
          {/* Hero thumbnail — trailer animation kicks in after 1s on hover */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: `linear-gradient(135deg, ${title.grad[0]} 0%, ${title.grad[1]} 100%)`, overflow: 'hidden' }}>
            {title.logoUrl && (
              <img src={title.logoUrl} alt=""
                className={previewActive ? 'poster-trailer-img' : undefined}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 600ms ease' }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            )}
            {title.isShift && (
              <span style={{ position: 'absolute', top: 10, left: 12, color: accentColor, fontWeight: 900, fontSize: 13, letterSpacing: '0.12em' }}>SHIFT</span>
            )}
            <div style={{ position: 'absolute', right: 14, bottom: 14, left: 14, color: '#fff', fontWeight: 800, fontSize: 18, textAlign: 'right', textShadow: '0 2px 6px rgba(0,0,0,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {title.title}
            </div>
          </div>

          {/* Info shelf */}
          <div style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
              <IconBtn variant="white" onClick={(e: React.MouseEvent) => { e.stopPropagation(); onPlay(title); }}>
                <Icons.Play size={14} />
              </IconBtn>
              <IconBtn onClick={(e: React.MouseEvent) => { e.stopPropagation(); toggleMyList(title.id); }}>
                {inList ? <Icons.Check size={14} /> : <Icons.Plus size={14} />}
              </IconBtn>
              <IconBtn><Icons.ThumbUp size={14} /></IconBtn>
              <IconBtn style={{ marginLeft: 'auto' }} onClick={(e: React.MouseEvent) => { e.stopPropagation(); onOpen(title); }}>
                <Icons.CaretDown size={14} />
              </IconBtn>
            </div>

            {/* Match + meta */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 9, flexWrap: 'wrap' }}>
              {title.match != null && <span style={{ color: '#46D369', fontWeight: 700 }}>{title.match}% Match</span>}
              <span style={{ padding: '1px 6px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 2, fontSize: 11, color: '#e5e5e5' }}>{title.rating}</span>
              <span style={{ color: '#b3b3b3' }}>{title.year}</span>
              <span style={{ padding: '0 4px', border: '1px solid rgba(255,255,255,0.3)', fontSize: 10, borderRadius: 2, color: '#e5e5e5' }}>HD</span>
            </div>

            {/* RT + Trakt + seasons */}
            <div style={{ marginBottom: 10 }}>
              <RatingsRow item={title} size={12.5} gap={12} />
            </div>

            {/* Genres */}
            <div style={{ display: 'flex', gap: 6, fontSize: 12, color: '#e5e5e5', flexWrap: 'wrap' }}>
              {title.genres.map((g, i) => (
                <React.Fragment key={g}>
                  {i > 0 && <span style={{ color: '#737373' }}>•</span>}
                  <span>{g}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ChannelCard({ channel, onPlay, onOpen }: { channel: Channel; onPlay: (c: Channel) => void; onOpen: (c: Channel) => void }) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRadius = useStore((s) => s.settings.cardRadius);
  const accentColor = useStore((s) => s.settings.accentColor);

  function openPreview() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const popH = POP_W * 9 / 16 + 158;
    const left = Math.max(12, Math.min(r.left + r.width / 2 - POP_W / 2, vw - POP_W - 12));
    const top = Math.max(HEADER_SAFE, Math.min(r.top + r.height / 2 - popH / 2, vh - popH - 12));
    setPos({ left, top });
    setHover(true);
  }
  function onEnter() { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(openPreview, 260); }
  function onLeave() { if (timer.current) clearTimeout(timer.current); setHover(false); setPos(null); }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <div ref={ref} onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={() => onPlay(channel)}
      style={{ position: 'relative', width: 280, flexShrink: 0, cursor: 'pointer' }}>

      {/* Base card */}
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '16/9',
        borderRadius: cardRadius, overflow: 'hidden',
        background: `linear-gradient(135deg, ${channel.grad[0]} 0%, ${channel.grad[1]} 100%)`,
      }}>
        {/* Channel logo image (centered watermark) */}
        {channel.logoUrl && (
          <img src={channel.logoUrl} alt="" loading="lazy"
            style={{ position: 'absolute', inset: 0, margin: 'auto', maxWidth: '55%', maxHeight: '45%', objectFit: 'contain', opacity: 0.92, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        )}
        {/* Logo chip */}
        <div style={{ position: 'absolute', top: 12, left: 12, width: 40, height: 40, borderRadius: 6, background: 'rgba(0,0,0,0.42)', border: '1px solid rgba(255,255,255,0.25)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15, color: '#fff', overflow: 'hidden' }}>
          {channel.logoUrl ? <img src={channel.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.parentElement as HTMLElement).textContent = channel.logo; }} /> : channel.logo}
        </div>
        {/* LIVE badge */}
        <span style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 5, background: accentColor, color: '#fff', fontWeight: 800, fontSize: 11, letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 3 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'pulse 1.4s ease-in-out infinite' }} />LIVE
        </span>
        {/* Now playing strip */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '22px 12px 9px', background: 'linear-gradient(0deg, rgba(0,0,0,0.85), transparent)' }}>
          <div style={{ fontSize: 11, color: '#cfcfcf', fontWeight: 600, letterSpacing: '0.03em', marginBottom: 2 }}>{channel.name} · CH {channel.num}</div>
          <div style={{ fontSize: 14, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{channel.now}</div>
        </div>
        {/* Progress */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(255,255,255,0.25)' }}>
          <div style={{ width: `${channel.prog}%`, height: '100%', background: accentColor }} />
        </div>
      </div>

      {/* Viewport-clamped hover popup */}
      {hover && pos && (
        <div onClick={(e) => { e.stopPropagation(); onOpen(channel); }}
          style={{
            position: 'fixed', left: pos.left, top: pos.top, width: POP_W,
            background: '#1F1F1F', borderRadius: cardRadius || 6, overflow: 'hidden',
            boxShadow: '0 12px 30px rgba(0,0,0,0.75)', zIndex: 2000, cursor: 'pointer',
            animation: 'nfxPop2 180ms cubic-bezier(0.2,0.7,0.2,1)',
          }}
        >
          {/* Hero */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: `linear-gradient(135deg, ${channel.grad[0]} 0%, ${channel.grad[1]} 100%)` }}>
            <div style={{ position: 'absolute', top: 12, left: 12, width: 42, height: 42, borderRadius: 6, background: 'rgba(0,0,0,0.42)', border: '1px solid rgba(255,255,255,0.25)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 16, color: '#fff' }}>{channel.logo}</div>
            <span style={{ position: 'absolute', top: 14, right: 14, display: 'flex', alignItems: 'center', gap: 5, background: accentColor, color: '#fff', fontWeight: 800, fontSize: 11, letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />LIVE
            </span>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(255,255,255,0.25)' }}>
              <div style={{ width: `${channel.prog}%`, height: '100%', background: accentColor }} />
            </div>
          </div>

          {/* Info */}
          <div style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
              <IconBtn variant="white" onClick={(e: React.MouseEvent) => { e.stopPropagation(); onPlay(channel); }}><Icons.Play size={14} /></IconBtn>
              <IconBtn onClick={(e: React.MouseEvent) => e.stopPropagation()}><Icons.Plus size={14} /></IconBtn>
              <IconBtn onClick={(e: React.MouseEvent) => e.stopPropagation()}><Icons.ThumbUp size={14} /></IconBtn>
              <IconBtn style={{ marginLeft: 'auto' }} onClick={(e: React.MouseEvent) => { e.stopPropagation(); onOpen(channel); }}><Icons.CaretDown size={14} /></IconBtn>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{channel.now}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ color: accentColor, fontWeight: 800 }}>● LIVE</span>
              <span style={{ color: '#b3b3b3' }}>{channel.viewers} watching</span>
              <span style={{ padding: '1px 6px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 2, fontSize: 11, color: '#e5e5e5' }}>{channel.rating}</span>
            </div>
            <div style={{ fontSize: 12.5, color: '#8a8a8a' }}><span style={{ color: '#b3b3b3' }}>Up next:</span> {channel.next}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, variant, style, onClick }: { children: React.ReactNode; variant?: 'white'; style?: React.CSSProperties; onClick?: (e: React.MouseEvent) => void }) {
  const white = variant === 'white';
  return (
    <button onClick={onClick} style={{
      width: 34, height: 34, borderRadius: '50%',
      border: white ? '0' : '1.5px solid rgba(255,255,255,0.5)',
      background: white ? '#fff' : 'rgba(42,42,42,0.6)',
      color: white ? '#000' : '#fff',
      cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'all 150ms',
      ...style,
    }}>{children}</button>
  );
}
