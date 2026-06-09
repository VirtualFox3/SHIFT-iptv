import React, { useRef, useEffect, useState, useCallback } from 'react';
import Hls from 'hls.js';
import type { Channel, Title } from '../types';
import { useStore } from '../store/useStore';
import { type SubCue } from '../api/opensubtitles';
import { findSubtitles, loadSubtitleCues, type SubResult } from '../api/subtitles';
import { xtreamGetVodInfo } from '../api/xtream';
import { deproxify, streamSrc, proxify } from '../api/proxy';
import { traktScrobbleStart, traktScrobbleStop } from '../api/trakt';
import * as Icons from './Icons';

interface PlayerProps {
  item: Channel | Title;
  onClose: () => void;
  channels?: Channel[];
}

function isChannel(item: Channel | Title): item is Channel {
  return 'num' in item;
}

// Platform detection for external-player deep links.
const IS_IOS = typeof navigator !== 'undefined' && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1));
const IS_ANDROID = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

// Hand a stream URL to a native player via its URL scheme.
function openInExternal(kind: 'vlc' | 'infuse', rawUrl: string) {
  const url = rawUrl;
  let scheme: string;
  if (kind === 'infuse') {
    scheme = `infuse://x-callback-url/play?url=${encodeURIComponent(url)}`;
  } else if (IS_IOS) {
    scheme = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(url)}`;
  } else if (IS_ANDROID) {
    scheme = `intent:${url}#Intent;package=org.videolan.vlc;type=video/*;end`;
  } else {
    scheme = `vlc://${url}`;
  }
  // Copy as a safety net in case the scheme isn't registered.
  try { navigator.clipboard.writeText(url); } catch {}
  window.location.href = scheme;
}

export default function Player({ item, onClose, channels = [] }: PlayerProps) {
  const settings = useStore((s) => s.settings);
  const setProgress = useStore((s) => s.setProgress);
  const provider = useStore((s) => s.provider);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrobbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const live = isChannel(item);
  const [chIdx, setChIdx] = useState(() => {
    const i = channels.findIndex((c) => c.id === item.id);
    return i >= 0 ? i : 0;
  });
  const current = live ? (channels[chIdx] || item) : item;
  const streamUrl = (current as any).streamUrl || '';

  const [playing, setPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(0.8);
  const [uiVisible, setUiVisible] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [quality, setQuality] = useState('Auto');
  const [showQuality, setShowQuality] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pip, setPip] = useState(false);
  const [aspect, setAspect] = useState<'fit' | 'fill' | '16:9' | '4:3' | 'stretch'>('fit');
  const [uiHidden, setUiHidden] = useState(false);  // explicit hide via 'h' / button
  const [isFs, setIsFs] = useState(false);

  // Subtitles
  const [subtitles, setSubtitles] = useState<SubResult[]>([]);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [subCues, setSubCues] = useState<SubCue[]>([]);
  const [currentCue, setCurrentCue] = useState<string>('');
  const [loadingSubs, setLoadingSubs] = useState(false);

  const [streamError, setStreamError] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Stream setup with a smart container-fallback chain (the trick Xtream web
  // players use): browsers can't decode MKV/HEVC, but most panels also expose
  // the SAME stream id as HLS (.m3u8 — transcoded server-side by the provider)
  // and sometimes .mp4 / .ts. So when the original container fails to play, we
  // retry the same URL with alternate extensions before giving up. Each non-HLS
  // attempt also tries the proxy (UA spoof / mixed-content fix). Only after the
  // whole chain is exhausted do we show the "open in VLC" screen.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;
    setStreamError(false);
    setBuffering(true);

    // Build the candidate chain. Swap a trailing video extension for alternates
    // the provider may transcode to. HLS (.m3u8) first since it's most likely to
    // be a browser-playable H.264 rendition.
    const extMatch = streamUrl.match(/\.(mkv|avi|mp4|ts|m3u8|mov|m4v|flv|wmv)(\?.*)?$/i);
    const candidates: string[] = [streamUrl];
    if (extMatch) {
      const qs = extMatch[2] || '';
      const baseNoExt = streamUrl.slice(0, extMatch.index!);
      for (const alt of ['m3u8', 'mp4', 'ts']) {
        const url = `${baseNoExt}.${alt}${qs}`;
        if (!candidates.includes(url)) candidates.push(url);
      }
    }

    let idx = 0;
    let cancelled = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    const clearWatch = () => { if (watchdog) { clearTimeout(watchdog); watchdog = null; } };

    const playDirectFile = (src: string) => { video.src = src; video.play().catch(() => {}); };

    const advance = () => {
      clearWatch();
      idx++;
      if (!tryCandidate()) setStreamError(true);
    };

    // Stall watchdog: HEVC/MKV often "plays" without ever firing an error event —
    // the clock just never moves. If we don't see real progress in time, treat the
    // candidate as dead and fall through to the next container.
    const armWatch = () => {
      clearWatch();
      watchdog = setTimeout(() => {
        if (cancelled) return;
        if (video.currentTime > 0.3) return;  // genuinely progressing
        advance();
      }, 7000);
    };

    // Try candidate[idx]. Returns false when the chain is exhausted.
    const tryCandidate = (): boolean => {
      if (cancelled) return true;
      if (idx >= candidates.length) return false;
      setBuffering(true);
      const url = candidates[idx];
      const isHls = /\.m3u8(\?|$)/i.test(url);

      hlsRef.current?.destroy();
      hlsRef.current = null;

      if (isHls && Hls.isSupported()) {
        let hlsFellBack = false;
        const hls = new Hls({ enableWorker: true, lowLatencyMode: live });
        hlsRef.current = hls;
        hls.loadSource(proxify(url));
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !hlsFellBack) { try { hls.startLoad(); return; } catch {} }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !hlsFellBack) { hlsFellBack = true; try { hls.recoverMediaError(); return; } catch {} }
          // This HLS candidate failed — advance the chain.
          try { hls.destroy(); } catch {}
          hlsRef.current = null;
          advance();
        });
      } else {
        // Non-HLS: try direct first (fast native seeking), proxy retry handled in onErr.
        triedProxyForIdx = false;
        playDirectFile(streamSrc(url));
      }
      armWatch();  // catch the silent "plays but clock never moves" HEVC case
      return true;
    };

    let triedProxyForIdx = false;

    // Genuine media error with no playback: proxy-retry this candidate once,
    // then advance to the next container in the chain.
    const onErr = () => {
      if (cancelled || !video.error || video.currentTime > 0) return;
      const url = candidates[idx];
      const isHls = /\.m3u8(\?|$)/i.test(url || '');
      if (!isHls && !triedProxyForIdx) {
        triedProxyForIdx = true;
        const proxied = proxify(url);
        if (proxied !== video.src) { clearWatch(); playDirectFile(proxied); armWatch(); return; }
      }
      advance();
    };

    // Real playback progress → the current candidate works; disarm the watchdog.
    const onProgress = () => { if (video.currentTime > 0.3) clearWatch(); };

    video.addEventListener('error', onErr);
    video.addEventListener('timeupdate', onProgress);
    tryCandidate();
    return () => {
      cancelled = true;
      clearWatch();
      video.removeEventListener('error', onErr);
      video.removeEventListener('timeupdate', onProgress);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [streamUrl, live, chIdx]);

  // Video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      setCurrentTime(video.currentTime);
      if (video.currentTime > 0) setStreamError(false);  // real playback → clear any error
      if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
    };
    const onDur = () => setDuration(video.duration);
    const onWait = () => setBuffering(true);
    const onPlay2 = () => { setPlaying(true); setBuffering(false); setStreamError(false); };
    const onPause = () => setPlaying(false);
    const onPipEnter = () => setPip(true);
    const onPipLeave = () => setPip(false);

    video.addEventListener('timeupdate', onTime);
    video.addEventListener('durationchange', onDur);
    video.addEventListener('waiting', onWait);
    video.addEventListener('playing', onPlay2);
    video.addEventListener('pause', onPause);
    video.addEventListener('enterpictureinpicture', onPipEnter);
    video.addEventListener('leavepictureinpicture', onPipLeave);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('durationchange', onDur);
      video.removeEventListener('waiting', onWait);
      video.removeEventListener('playing', onPlay2);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('enterpictureinpicture', onPipEnter);
      video.removeEventListener('leavepictureinpicture', onPipLeave);
    };
  }, []);

  // Progress bar drag
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => seekFromEvent(e);
    const up = () => setDragging(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [dragging]);

  // Auto-hide UI
  const poke = useCallback(() => {
    setUiVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { setUiVisible(false); setShowQuality(false); }, 3200);
  }, []);
  useEffect(() => { poke(); return () => { if (hideTimer.current) clearTimeout(hideTimer.current); }; }, [poke]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); }
      else if (e.key === ' ') { e.preventDefault(); togglePlay(); poke(); }
      else if (e.key === 'ArrowRight' && !live) { seekRel(10); poke(); }
      else if (e.key === 'ArrowLeft' && !live) { seekRel(-10); poke(); }
      else if (e.key === 'ArrowUp' && live) { zap(1); }
      else if (e.key === 'ArrowDown' && live) { zap(-1); }
      else if (e.key === 'm') { setMuted((m) => !m); }
      else if (e.key === 'h') { setUiHidden((h) => !h); }   // hide/show all UI
      else if (e.key === 'f') { toggleFullscreen(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Save VOD progress + trakt scrobble
  useEffect(() => {
    if (live || !duration) return;
    const pct = Math.round((currentTime / duration) * 100);
    setProgress(item.id, pct);

    // Trakt periodic scrobble
    if (settings.traktAccessToken && playing) {
      clearTimeout(scrobbleTimer.current!);
      scrobbleTimer.current = setTimeout(() => {
        traktScrobbleStart(settings.traktAccessToken!, (item as Title).title, (item as Title).year, pct).catch(() => {});
      }, 5000);
    }

    // Subtitle cue matching
    if (subCues.length) {
      const cue = subCues.find((c) => currentTime >= c.start && currentTime <= c.end);
      setCurrentCue(cue ? cue.text : '');
    }
  }, [currentTime]);

  // Cleanup trakt on unmount
  useEffect(() => {
    return () => {
      if (settings.traktAccessToken && !live && duration) {
        const pct = Math.round((currentTime / duration) * 100);
        traktScrobbleStop(settings.traktAccessToken, (item as Title).title, (item as Title).year, pct).catch(() => {});
      }
    };
  }, []);

  // Load subtitle search when panel opens — Wyzie (keyless) + OpenSubtitles fallback
  useEffect(() => {
    if (!showSubMenu || live) return;
    setLoadingSubs(true);
    const t = item as Title;
    const lang = settings.subLang?.slice(0, 2).toLowerCase() || 'en';
    // For Xtream movies, resolve a TMDB/IMDB id from vod_info so Wyzie can match.
    const resolveId = async (): Promise<string | undefined> => {
      const m = t.id.match(/^xt_vod_(.+)$/);
      if (m && provider?.type === 'xtream' && provider.serverUrl && provider.username) {
        const info = await xtreamGetVodInfo({ serverUrl: provider.serverUrl, username: provider.username, password: provider.password || '' }, m[1]);
        return info?.imdbId || info?.tmdbId;
      }
      return undefined;
    };
    findSubtitles(t, lang, settings.openSubtitlesToken, resolveId)
      .then((subs) => setSubtitles(subs.slice(0, 12)))
      .catch(() => setSubtitles([]))
      .finally(() => setLoadingSubs(false));
  }, [showSubMenu]);

  async function loadSubtitle(sub: SubResult) {
    try {
      const cues = await loadSubtitleCues(sub, settings.openSubtitlesToken);
      if (!cues.length) throw new Error('Empty subtitle');
      setSubCues(cues);
      setActiveSub(sub.id);
      setShowSubMenu(false);
    } catch {}
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  }

  function seekRel(delta: number) {
    const v = videoRef.current;
    if (!v || live) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
  }

  function seekFromEvent(e: PointerEvent | React.PointerEvent) {
    const v = videoRef.current;
    if (!v || live || !barRef.current) return;
    const r = barRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    v.currentTime = frac * v.duration;
  }

  function zap(dir: number) {
    setChIdx((i) => (i + dir + channels.length) % channels.length);
    setBuffering(true);
    poke();
  }

  async function togglePip() {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await v.requestPictureInPicture();
    }
  }

  async function toggleFullscreen() {
    const v = videoRef.current as any;
    // iPhone Safari only supports fullscreen on the <video> element itself.
    if (IS_IOS && v?.webkitEnterFullscreen) { try { v.webkitEnterFullscreen(); } catch {} return; }
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (rootRef.current?.requestFullscreen) await rootRef.current.requestFullscreen();
      else if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen();
    } catch {}
  }
  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);


  const pct = live ? ((current as Channel).prog || 0) : (duration ? (currentTime / duration) * 100 : 0);
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;

  const subSize = { Small: 16, Medium: 20, Large: 26 }[settings.subSize] || 20;

  // Aspect-ratio → CSS for the <video>
  const videoStyle: React.CSSProperties = (() => {
    const base: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 'auto' };
    switch (aspect) {
      case 'fill': return { ...base, objectFit: 'cover' };
      case 'stretch': return { ...base, objectFit: 'fill' };
      case '16:9': return { ...base, objectFit: 'contain', aspectRatio: '16 / 9', height: 'auto', maxHeight: '100%' };
      case '4:3': return { ...base, objectFit: 'contain', aspectRatio: '4 / 3', height: 'auto', maxHeight: '100%' };
      default: return { ...base, objectFit: 'contain' };  // 'fit'
    }
  })();

  // When UI is explicitly hidden, suppress all chrome
  const chromeVisible = uiVisible && !uiHidden;

  return (
    <div
      ref={rootRef}
      onMouseMove={() => { if (!uiHidden) poke(); }}
      onClick={() => { if (uiHidden) { setUiHidden(false); return; } setShowQuality(false); setShowSubMenu(false); poke(); }}
      style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200, cursor: chromeVisible ? 'default' : 'none', overflow: 'hidden' }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        style={videoStyle}
        muted={muted}
        autoPlay
        playsInline
        onVolumeChange={() => {
          const v = videoRef.current;
          if (v) { setVol(v.volume); setMuted(v.muted); }
        }}
      />

      {/* Gradient fallback (shown when stream not playing) */}
      {buffering && (
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${(current as any).grad?.[0] || '#111'} 0%, ${(current as any).grad?.[1] || '#333'} 100%)`, opacity: 0.7, pointerEvents: 'none' }} />
      )}

      {/* Buffering spinner */}
      {buffering && !streamError && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}

      {/* Stream error */}
      {streamError && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 32, background: 'rgba(0,0,0,0.85)', zIndex: 30 }}>
          <div style={{ background: '#181818', border: '1px solid #2a2a2a', borderRadius: 12, padding: '32px 40px', maxWidth: 560, boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(229,9,20,0.15)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
              <Icons.Info size={26} color="var(--accent,#E50914)" />
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#fff', marginBottom: 10 }}>Can't play this format in the browser</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.55, marginBottom: 22 }}>
              This file is an <strong style={{ color: '#ddd' }}>MKV / HEVC</strong> video — no web browser (incl. {IS_IOS ? 'iPhone/iPad Safari' : 'Chrome/Safari'}) can play that container. Open it in a free player like <strong style={{ color: '#ddd' }}>{IS_IOS ? 'VLC or Infuse' : 'VLC'}</strong> to watch it.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => openInExternal('vlc', deproxify(streamUrl))}
                style={{ background: '#E8821E', color: '#fff', border: 0, borderRadius: 6, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
                ▶ Open in VLC
              </button>
              {IS_IOS && (
                <button onClick={() => openInExternal('infuse', deproxify(streamUrl))}
                  style={{ background: '#3478F6', color: '#fff', border: 0, borderRadius: 6, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
                  ▶ Open in Infuse
                </button>
              )}
              <button onClick={() => { navigator.clipboard.writeText(deproxify(streamUrl)).then(() => { setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000); }); }}
                style={{ background: '#2a2a2a', color: '#fff', border: '1px solid #3a3a3a', borderRadius: 6, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icons.Copy size={15} />{copiedUrl ? 'Copied!' : 'Copy link'}
              </button>
              <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ background: 'var(--accent,#E50914)', color: '#fff', border: 0, borderRadius: 6, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                ← Go Back
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 16, lineHeight: 1.5 }}>
              {IS_IOS
                ? <>Don't have it? Get <strong style={{ color: '#888' }}>VLC</strong> or <strong style={{ color: '#888' }}>Infuse</strong> free from the App Store — the link is copied, just paste it in.</>
                : <>Tip: in VLC use <strong style={{ color: '#888' }}>Media → Open Network Stream</strong> and paste the copied link.</>}
            </div>
          </div>
        </div>
      )}

      {/* Subtitle display */}
      {(activeSub || settings.subEnabled) && currentCue && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 110, textAlign: 'center', pointerEvents: 'none', padding: '0 64px' }}>
          <span style={{ background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: subSize, padding: '5px 14px', borderRadius: 4, lineHeight: 1.5, display: 'inline-block' }}>
            {currentCue}
          </span>
        </div>
      )}

      {/* TOP BAR */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, padding: '20px 28px',
        display: 'flex', alignItems: 'center', gap: 14, zIndex: 20,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, transparent 100%)',
        opacity: chromeVisible ? 1 : 0, transition: 'opacity 250ms',
        transform: chromeVisible ? 'none' : 'translateY(-8px)',
        pointerEvents: chromeVisible ? 'auto' : 'none',
      }}>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} title="Back" style={{ ...ctrlBtn, background: 'rgba(0,0,0,0.35)', borderRadius: '50%', width: 42, height: 42 }}>
          <Icons.Back size={24} />
        </button>
        {live && (
          <div style={{ width: 40, height: 40, borderRadius: 6, background: `linear-gradient(135deg,${(current as Channel).grad[0]},${(current as Channel).grad[1]})`, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14 }}>
            {(current as Channel).logo}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
            {live ? (current as Channel).name : (item as Title).title}
            {live && <LiveBadge />}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
            {live ? `CH ${(current as Channel).num} · ${(current as Channel).now}` : `${(item as Title).year} · ${(item as Title).rating}`}
          </div>
        </div>
        {/* PiP indicator */}
        {pip && <span style={{ fontSize: 12, color: '#46D369', fontWeight: 700, letterSpacing: '0.06em' }}>PiP ACTIVE</span>}
      </div>

      {/* CENTER TRANSPORT */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 52, opacity: chromeVisible ? 1 : 0, transition: 'opacity 250ms', pointerEvents: chromeVisible ? 'auto' : 'none' }}>
        {!live && (
          <button onClick={(e) => { e.stopPropagation(); seekRel(-10); poke(); }} style={{ ...ctrlBtn, opacity: 0.85 }}>
            <Icons.Replay10 size={38} />
          </button>
        )}
        {live && (
          <button onClick={(e) => { e.stopPropagation(); zap(-1); }} style={{ ...ctrlBtn, opacity: 0.85 }}>
            <Icons.ChevronLeft size={38} />
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); togglePlay(); poke(); }}
          style={{ ...ctrlBtn, width: 80, height: 80, background: 'rgba(255,255,255,0.12)', borderRadius: '50%' }}>
          {playing ? <Icons.Pause size={40} /> : <Icons.Play size={40} />}
        </button>
        {!live && (
          <button onClick={(e) => { e.stopPropagation(); seekRel(10); poke(); }} style={{ ...ctrlBtn, opacity: 0.85 }}>
            <Icons.Forward10 size={38} />
          </button>
        )}
        {live && (
          <button onClick={(e) => { e.stopPropagation(); zap(1); }} style={{ ...ctrlBtn, opacity: 0.85 }}>
            <Icons.ChevronRight size={38} />
          </button>
        )}
      </div>

      {/* BOTTOM BAR */}
      <div onClick={(e) => e.stopPropagation()} style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 28px 18px',
        background: 'linear-gradient(0deg, rgba(0,0,0,0.9) 0%, transparent 100%)',
        opacity: chromeVisible ? 1 : 0, transition: 'opacity 250ms',
        transform: chromeVisible ? 'none' : 'translateY(8px)',
      }}>
        {/* SCRUBBER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0 8px' }}>
          <span style={{ fontSize: 13, color: '#fff', fontWeight: 600, minWidth: 48, textAlign: 'right' }}>
            {live ? fmt(((current as Channel).prog / 100) * 7200) : fmt(currentTime)}
          </span>
          <div
            ref={barRef}
            onPointerDown={(e) => { if (!live) { e.preventDefault(); setDragging(true); seekFromEvent(e as any); } }}
            style={{ position: 'relative', flex: 1, height: 5, background: 'rgba(255,255,255,0.25)', borderRadius: 3, cursor: live ? 'default' : 'pointer', userSelect: 'none' }}
          >
            {/* Buffered */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${bufferedPct}%`, background: 'rgba(255,255,255,0.2)', borderRadius: 3 }} />
            {/* Progress */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'var(--accent,#E50914)', borderRadius: 3, transition: dragging ? 'none' : 'width 250ms linear' }} />
            {/* Thumb */}
            {!live && (
              <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 14, height: 14, borderRadius: '50%', background: 'var(--accent,#E50914)', boxShadow: '0 0 0 4px rgba(229,9,20,0.28)', transition: dragging ? 'none' : 'left 250ms linear' }} />
            )}
          </div>
          <span style={{ fontSize: 13, color: '#fff', fontWeight: 600, minWidth: 52 }}>
            {live
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--accent,#E50914)' }}><LiveDot />LIVE</span>
              : duration ? `-${fmt(duration - currentTime)}` : '--:--'
            }
          </span>
        </div>

        {/* CONTROL ROW */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, paddingBottom: 4 }}>
          <button onClick={() => { togglePlay(); poke(); }} style={ctrlBtn}>
            {playing ? <Icons.Pause size={24} /> : <Icons.Play size={24} />}
          </button>
          {live
            ? <button onClick={() => zap(1)} style={ctrlBtn}><Icons.Next size={22} /></button>
            : <button onClick={() => { seekRel(10); poke(); }} style={ctrlBtn}><Icons.Forward10 size={24} /></button>
          }
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => { setMuted((m) => !m); if (videoRef.current) videoRef.current.muted = !muted; }} style={ctrlBtn}>
              {muted || vol === 0 ? <Icons.Mute size={22} /> : <Icons.Volume size={22} />}
            </button>
            <input type="range" min="0" max="1" step="0.01" value={muted ? 0 : vol}
              onChange={(e) => { const v = parseFloat(e.target.value); setVol(v); setMuted(false); if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = false; } }}
              style={{ width: 80, accentColor: 'var(--accent,#E50914)', cursor: 'pointer' }} />
          </div>
          {live && (
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 5, marginLeft: 4 }}>
              <Icons.Volume size={14} />{(current as Channel).viewers} watching
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 18, position: 'relative' }}>
            {/* Subtitles */}
            {!live && (
              <div style={{ position: 'relative' }}>
                <button onClick={(e) => { e.stopPropagation(); setShowSubMenu((s) => !s); setShowQuality(false); }} title="Subtitles"
                  style={{ ...ctrlBtn, opacity: activeSub ? 1 : 0.7, borderBottom: activeSub ? '2px solid var(--accent,#E50914)' : '2px solid transparent' }}>
                  <Icons.Subtitles size={22} />
                </button>
                {showSubMenu && (
                  <div onClick={(e) => e.stopPropagation()} style={menuPanel}>
                    <div style={menuHead}>SUBTITLES · opensubtitles.com</div>
                    {loadingSubs && (
                      <div style={{ padding: '10px 12px', fontSize: 12.5, color: '#8a8a8a', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #444', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                        Searching…
                      </div>
                    )}
                    {!loadingSubs && subtitles.length === 0 && (
                      <div style={{ padding: '10px 12px', fontSize: 12.5, color: '#8a8a8a' }}>No subtitles found.</div>
                    )}
                    {activeSub && <SubMenuItem label="Off" active={false} onClick={() => { setActiveSub(null); setSubCues([]); setCurrentCue(''); setShowSubMenu(false); }} />}
                    {subtitles.map((s) => (
                      <SubMenuItem key={s.id} label={s.label} active={activeSub === s.id} onClick={() => loadSubtitle(s)} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quality */}
            <div style={{ position: 'relative' }}>
              <button onClick={(e) => { e.stopPropagation(); setShowQuality((s) => !s); setShowSubMenu(false); }} style={ctrlBtn}>
                <Icons.Settings size={21} />
              </button>
              {showQuality && (
                <div onClick={(e) => e.stopPropagation()} style={{ ...menuPanel, width: 250 }}>
                  <div style={menuHead}>QUALITY</div>
                  {['Auto', '1080p', '720p', '480p'].map((q) => (
                    <SubMenuItem key={q} label={q} active={quality === q} onClick={() => { setQuality(q); }} />
                  ))}
                  <div style={{ ...menuHead, marginTop: 6, borderTop: '1px solid #2a2a2a', paddingTop: 10 }}>ASPECT RATIO</div>
                  {([
                    ['fit', 'Fit (default)'],
                    ['fill', 'Fill screen'],
                    ['16:9', '16:9 Widescreen'],
                    ['4:3', '4:3'],
                    ['stretch', 'Stretch'],
                  ] as const).map(([val, label]) => (
                    <SubMenuItem key={val} label={label} active={aspect === val} onClick={() => { setAspect(val); }} />
                  ))}
                </div>
              )}
            </div>

            {/* Hide UI */}
            <button onClick={() => { setUiHidden(true); setShowQuality(false); setShowSubMenu(false); }} title="Hide controls (H)" style={ctrlBtn}>
              <Icons.EyeOff size={21} />
            </button>

            {/* PiP */}
            {'pictureInPictureEnabled' in document && (
              <button onClick={togglePip} title="Picture-in-Picture" style={{ ...ctrlBtn, opacity: pip ? 1 : 0.85 }}>
                <Icons.Pip size={21} />
              </button>
            )}

            <button onClick={toggleFullscreen} title="Fullscreen (F)" style={ctrlBtn}>
              {isFs ? <Icons.FullscreenExit size={21} /> : <Icons.Fullscreen size={21} />}
            </button>
            <button onClick={onClose} title="Close" style={ctrlBtn}><Icons.Close size={20} /></button>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function LiveBadge() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#E50914', color: '#fff', fontWeight: 800, fontSize: 10, letterSpacing: '0.08em', padding: '2px 7px', borderRadius: 3 }}>
      <LiveDot />LIVE
    </span>
  );
}
function LiveDot() {
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', flexShrink: 0, animation: 'pulse 1.4s ease-in-out infinite', display: 'inline-block' }} />;
}

const ctrlBtn: React.CSSProperties = { background: 'transparent', border: 0, color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, opacity: 0.95, transition: 'opacity 140ms, transform 120ms' };
const menuPanel: React.CSSProperties = { position: 'absolute', bottom: 40, right: 0, width: 230, background: 'rgba(18,18,18,0.97)', border: '1px solid #2a2a2a', borderRadius: 8, padding: 8, boxShadow: '0 12px 36px rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 10 };
const menuHead: React.CSSProperties = { fontSize: 11, color: '#666', padding: '4px 10px 6px', fontWeight: 700, letterSpacing: '0.06em' };

function SubMenuItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '9px 10px', border: 0, background: active ? 'rgba(255,255,255,0.07)' : 'transparent', color: '#fff', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 5, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      <span style={{ width: 16, color: '#E50914', flexShrink: 0 }}>{active ? '✓' : ''}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </button>
  );
}

function fmt(s: number): string {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return (h > 0 ? `${h}:${String(m).padStart(2, '0')}` : String(m)) + ':' + String(ss).padStart(2, '0');
}

