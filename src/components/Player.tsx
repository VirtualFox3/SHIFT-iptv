import React, { useRef, useEffect, useState, useCallback } from 'react';
import Hls from 'hls.js';
import type { Channel, Title } from '../types';
import { useStore } from '../store/useStore';
import { type SubCue } from '../api/opensubtitles';
import { findSubtitles, loadSubtitleCues, cleanSubtitleQuery, extractEpisode, type SubResult } from '../api/subtitles';
import { xtreamGetVodInfo } from '../api/xtream';
import { deproxify, streamSrc, proxify } from '../api/proxy';
import { traktScrobbleStart, traktScrobbleStop } from '../api/trakt';
import { useCast } from '../hooks/useCast';
import * as Icons from './Icons';

interface PlayerProps {
  item: Channel | Title;
  onClose: () => void;
  channels?: Channel[];
  nextEpisode?: Title;
  onNext?: () => void;
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

export default function Player({ item, onClose, channels = [], nextEpisode, onNext }: PlayerProps) {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const setProgress = useStore((s) => s.setProgress);
  const continueWatching = useStore((s) => s.continueWatching);
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

  // Desktop app (Electron + mpv): hand playback to the native engine, which plays
  // EVERYTHING (HEVC/MKV/AV1) and connects DIRECTLY to the provider (home IP, one
  // clean connection) — no browser codec limits, no proxy, no 1-connection clash.
  const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;
  const isDesktop = !!electronAPI?.playStream;

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
  const [scrubPct, setScrubPct] = useState(0);          // 0–1 visual drag position
  const [hoverPct, setHoverPct] = useState<number | null>(null);  // hover preview
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
  const [loadingSubId, setLoadingSubId] = useState<string | null>(null);
  const [subLoadError, setSubLoadError] = useState<string | null>(null);
  const [nativeTracks, setNativeTracks] = useState<TextTrack[]>([]);

  // Audio tracks (HLS multi-audio)
  const [audioTracks, setAudioTracks] = useState<{ id: number; name: string; lang: string }[]>([]);
  const [activeAudio, setActiveAudio] = useState(0);

  const [streamError, setStreamError] = useState(false);
  const [errorKind, setErrorKind] = useState<'format' | 'busy'>('format');
  const [retryNonce, setRetryNonce] = useState(0);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [nextDismissed, setNextDismissed] = useState(false);

  const { castState, requestCast, castMedia } = useCast();
  const wasCastingRef = useRef(false);

  // In the desktop app, mpv handles playback — pass the ORIGINAL provider URL
  // (deproxified) and return to the library. mpv connects directly and plays it.
  useEffect(() => {
    if (!isDesktop || !streamUrl) return;
    const title = live ? (current as Channel).name : (item as Title).title;
    electronAPI.playStream({ url: deproxify(streamUrl), title });
    const t = setTimeout(onClose, 600);
    return () => clearTimeout(t);
  }, [isDesktop, streamUrl, chIdx]);

  // Stream setup. For direct VOD files we try the provider URL DIRECTLY first
  // (native byte-range seeking = fast); if that fails (UA block / mixed content)
  // we fall back to the proxy (slower seek, but plays). HLS always uses the proxy
  // (hls.js fetch needs CORS).
  useEffect(() => {
    if (isDesktop) return;
    const video = videoRef.current;
    if (!video || !streamUrl) return;
    setStreamError(false);
    setBuffering(true);
    setAudioTracks([]);
    setActiveAudio(0);

    const isHls = /\.m3u8(\?|$)/i.test(streamUrl);
    let usedProxy = false;
    let hlsFellBack = false;

    const playDirectFile = (src: string) => { video.src = src; video.play().catch(() => {}); };

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: live });
      hlsRef.current = hls;
      hls.loadSource(proxify(streamUrl));
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        setAudioTracks(hls.audioTracks.map((t, i) => ({ id: i, name: t.name || t.lang || `Track ${i + 1}`, lang: t.lang || '' })));
        setActiveAudio(hls.audioTrack);
      });
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_e, data) => { setActiveAudio(data.id); });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) { try { hls.startLoad(); return; } catch {} }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !hlsFellBack) { try { hls.recoverMediaError(); return; } catch {} }
        if (!hlsFellBack) { hlsFellBack = true; try { hls.destroy(); } catch {} hlsRef.current = null; playDirectFile(proxify(streamUrl)); }
      });
    } else {
      // 1st attempt: direct (fast seeking when the provider allows it)
      playDirectFile(streamSrc(streamUrl));
    }

    // On a genuine media error with no playback: first retry via the proxy,
    // only then show the "can't play" screen.
    const onErr = () => {
      if (!video.error || video.currentTime > 0) return;
      if (!isHls && !usedProxy) {
        usedProxy = true;
        const proxied = proxify(streamUrl);
        if (proxied !== video.src) { playDirectFile(proxied); return; }
      }
      // Classify the failure: is the provider rejecting us (busy — only 1
      // connection allowed, e.g. it's open on the phone) or is it a codec the
      // browser genuinely can't decode (MKV/HEVC)? A quick range probe tells us.
      (async () => {
        let kind: 'format' | 'busy' = 'format';
        try {
          const r = await fetch(proxify(streamUrl), { headers: { Range: 'bytes=0-1' } });
          if (r.status === 458 || r.status === 403 || r.status === 429 || r.status >= 500) kind = 'busy';
          try { await r.body?.cancel(); } catch {}
        } catch { kind = 'busy'; }
        setErrorKind(kind);
        setStreamError(true);
      })();
    };
    video.addEventListener('error', onErr);
    return () => {
      video.removeEventListener('error', onErr);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [streamUrl, live, chIdx, retryNonce]);

  // Reset next-episode card whenever item changes
  useEffect(() => { setNextDismissed(false); }, [item.id]);

  // Auto-advance to next episode when video ends (if user hasn't dismissed the card)
  useEffect(() => {
    if (live || !nextEpisode || !onNext || nextDismissed) return;
    if (duration > 0 && currentTime >= duration - 1) {
      onNext();
    }
  }, [currentTime, duration]);

  // Resume VOD from saved position (runs once per item load, skipped for live).
  useEffect(() => {
    if (live) return;
    const pct = continueWatching[item.id];
    if (!pct || pct >= 95) return;  // nothing saved, or effectively finished
    const video = videoRef.current;
    if (!video) return;
    const seek = () => {
      const target = (pct / 100) * video.duration;
      if (target > 0 && isFinite(target)) video.currentTime = target;
    };
    video.addEventListener('loadedmetadata', seek, { once: true });
    return () => video.removeEventListener('loadedmetadata', seek);
  }, [item.id, streamUrl]);

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
    const onSeeking = () => setBuffering(true);     // instant feedback on scrub
    const onSeeked = () => { if (video.readyState >= 3) setBuffering(false); };
    const onCanPlay = () => setBuffering(false);
    const onPlay2 = () => { setPlaying(true); setBuffering(false); setStreamError(false); };
    const onPause = () => setPlaying(false);
    const onPipEnter = () => setPip(true);
    const onPipLeave = () => setPip(false);

    video.addEventListener('timeupdate', onTime);
    video.addEventListener('durationchange', onDur);
    video.addEventListener('waiting', onWait);
    video.addEventListener('seeking', onSeeking);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('playing', onPlay2);
    video.addEventListener('pause', onPause);
    video.addEventListener('enterpictureinpicture', onPipEnter);
    video.addEventListener('leavepictureinpicture', onPipLeave);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('durationchange', onDur);
      video.removeEventListener('waiting', onWait);
      video.removeEventListener('seeking', onSeeking);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('playing', onPlay2);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('enterpictureinpicture', onPipEnter);
      video.removeEventListener('leavepictureinpicture', onPipLeave);
    };
  }, []);

  // Progress bar drag — YouTube-style: while dragging we only move the bar
  // visually (no seeking, so no re-buffer on every pixel); the actual seek
  // happens ONCE on release.
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => setScrubPct(pctFromEvent(e));
    const up = (e: PointerEvent) => {
      const frac = pctFromEvent(e);
      const v = videoRef.current;
      if (v && v.duration) v.currentTime = frac * v.duration;
      setDragging(false);
    };
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

  // Detect native subtitle tracks embedded in the video (HLS WebVTT, MP4 TTML, etc.)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => {
      const tracks = Array.from(video.textTracks).filter((t) => t.kind === 'subtitles' || t.kind === 'captions');
      setNativeTracks(tracks);
    };
    video.addEventListener('loadedmetadata', update);
    update();
    return () => video.removeEventListener('loadedmetadata', update);
  }, [streamUrl]);

  function selectNativeTrack(track: TextTrack | null) {
    const video = videoRef.current;
    if (!video) return;
    Array.from(video.textTracks).forEach((t) => { t.mode = 'disabled'; });
    if (track) track.mode = 'showing';
    setActiveSub(track ? `native_${track.label}_${track.language}` : null);
    setSubCues([]); setCurrentCue('');
    setShowQuality(false);
  }

  // Load subtitle search when settings panel opens — Wyzie (keyless) + OpenSubtitles fallback
  useEffect(() => {
    if (!showQuality || live) return;
    setLoadingSubs(true);
    setSubLoadError(null);
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
  }, [showQuality]);

  async function loadSubtitle(sub: SubResult) {
    setLoadingSubId(sub.id);
    setSubLoadError(null);
    try {
      const cues = await loadSubtitleCues(sub, settings.openSubtitlesToken);
      setSubCues(cues);
      setActiveSub(sub.id);
      setShowQuality(false);
    } catch (e) {
      setSubLoadError('Failed to load — try another');
    } finally {
      setLoadingSubId(null);
    }
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

  // Fraction (0–1) of the bar at the cursor's x position.
  function pctFromEvent(e: PointerEvent | React.PointerEvent): number {
    if (!barRef.current) return 0;
    const r = barRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  }

  function zap(dir: number) {
    setChIdx((i) => (i + dir + channels.length) % channels.length);
    setBuffering(true);
    poke();
  }

  function switchAudio(id: number) {
    if (hlsRef.current) hlsRef.current.audioTrack = id;
    setActiveAudio(id);
  }

  function downloadStream() {
    const url = deproxify(streamUrl);
    const isHls = /\.m3u8(\?|$)/i.test(url);
    if (isHls) {
      try { navigator.clipboard.writeText(url); } catch {}
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      return;
    }
    const title = (item as Title).title?.replace(/[/\\?%*:|"<>]/g, '-') || 'video';
    const ext = url.match(/\.(mp4|mkv|ts|avi|mov)(\?|$)/i)?.[1] || 'mp4';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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

  // Auto-load media on Chromecast when session connects (or stream changes while connected).
  useEffect(() => {
    if (castState === 'connected') {
      wasCastingRef.current = true;
      const url = deproxify(streamUrl);
      const title = live ? (current as Channel).name : (item as Title).title;
      const imageUrl = (current as any).logoUrl || (item as any).coverUrl || undefined;
      castMedia(url, title, imageUrl);
      // Pause local video — audio would double otherwise.
      videoRef.current?.pause();
      setPlaying(false);
    } else if (wasCastingRef.current) {
      wasCastingRef.current = false;
      videoRef.current?.play().catch(() => {});
      setPlaying(true);
    }
  }, [castState, streamUrl]);

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
  const chromeVisible = (uiVisible || showQuality) && !uiHidden;

  // Desktop: mpv plays in its own window — show a brief hand-off screen.
  if (isDesktop) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200, display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div className="spin" style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#E50914', margin: '0 auto 18px' }} />
          <div style={{ fontSize: 17, fontWeight: 700 }}>Opening in player…</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>Playing in mpv — close it to return here.</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      onMouseMove={() => { if (!uiHidden) poke(); }}
      onClick={() => { if (uiHidden) { setUiHidden(false); return; } setShowQuality(false); setShowQuality(false); poke(); }}
      style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200, cursor: chromeVisible ? 'default' : 'none', overflow: 'hidden' }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        style={videoStyle}
        muted={muted}
        autoPlay
        playsInline
        preload="auto"
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
            <div style={{ fontSize: 19, fontWeight: 700, color: '#fff', marginBottom: 10 }}>
              {errorKind === 'busy' ? 'Stream is busy' : "Can't play this format in the browser"}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.55, marginBottom: 22 }}>
              {errorKind === 'busy'
                ? <>Your provider allows only <strong style={{ color: '#ddd' }}>one connection at a time</strong>. Make sure it's <strong style={{ color: '#ddd' }}>closed on your phone and any other device/app</strong>, then hit Retry.</>
                : <>This file is an <strong style={{ color: '#ddd' }}>MKV / HEVC</strong> video — no web browser (incl. {IS_IOS ? 'iPhone/iPad Safari' : 'Chrome/Safari'}) can play that container. Open it in a free player like <strong style={{ color: '#ddd' }}>{IS_IOS ? 'VLC or Infuse' : 'VLC'}</strong> to watch it.</>}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => { setStreamError(false); setBuffering(true); setRetryNonce((n) => n + 1); }}
                style={{ background: errorKind === 'busy' ? '#1DB954' : '#2a2a2a', color: '#fff', border: errorKind === 'busy' ? 0 : '1px solid #3a3a3a', borderRadius: 6, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
                ↻ Retry
              </button>
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
              {errorKind === 'busy'
                ? <>This is why it works sometimes and not others — only one device can watch at a time on your plan.</>
                : IS_IOS
                ? <>Don't have it? Get <strong style={{ color: '#888' }}>VLC</strong> or <strong style={{ color: '#888' }}>Infuse</strong> free from the App Store — the link is copied, just paste it in.</>
                : <>Tip: in VLC use <strong style={{ color: '#888' }}>Media → Open Network Stream</strong> and paste the copied link.</>}
            </div>
          </div>
        </div>
      )}

      {/* Subtitle display — slides up when controls are visible */}
      {(activeSub || settings.subEnabled) && currentCue && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: chromeVisible ? 110 : 32, textAlign: 'center', pointerEvents: 'none', padding: '0 64px', transition: 'bottom 250ms ease', zIndex: 15 }}>
          <span style={{ background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: subSize, padding: '6px 16px', borderRadius: 5, lineHeight: 1.55, display: 'inline-block', whiteSpace: 'pre-line', textShadow: '0 1px 4px rgba(0,0,0,0.9)', letterSpacing: '0.01em' }}>
            {currentCue.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')}
          </span>
        </div>
      )}

      {/* Up Next card (last 60s of VOD episode) — inspired by Netflix/UHF */}
      {!live && nextEpisode && !nextDismissed && duration > 0 && (duration - currentTime) < 60 && (duration - currentTime) > 0 && (
        <div onClick={(e) => e.stopPropagation()} style={{
          position: 'absolute', bottom: chromeVisible ? 110 : 32, right: 24,
          background: 'rgba(16,16,16,0.96)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10, padding: 16, width: 300,
          boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
          backdropFilter: 'blur(16px)',
          transition: 'bottom 250ms ease',
          zIndex: 20,
          animation: 'slideInRight 300ms ease',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            Up Next · {Math.ceil(duration - currentTime)}s
          </div>
          {nextEpisode.logoUrl && (
            <img src={nextEpisode.logoUrl} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, marginBottom: 10, display: 'block' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          )}
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 12, lineHeight: 1.35 }}>{nextEpisode.title}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={(e) => { e.stopPropagation(); onNext?.(); }} style={{ flex: 1, background: '#fff', color: '#000', border: 0, borderRadius: 6, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icons.Play size={13} color="#000" /> Play Now
            </button>
            <button onClick={(e) => { e.stopPropagation(); setNextDismissed(true); }} style={{ background: 'rgba(255,255,255,0.08)', color: '#aaa', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '9px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              ✕
            </button>
          </div>
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
        {castState === 'connected' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: settings.accentColor || '#E50914', fontWeight: 700, letterSpacing: '0.06em' }}>
            <Icons.Cast size={14} /> CASTING
          </span>
        )}
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
            {live ? fmt(((current as Channel).prog / 100) * 7200) : fmt(dragging ? scrubPct * duration : currentTime)}
          </span>
          {(() => { const barPct = live ? pct : (dragging ? scrubPct * 100 : pct); return (
          <div
            ref={barRef}
            onPointerDown={(e) => { if (!live) { e.preventDefault(); setScrubPct(pctFromEvent(e)); setDragging(true); } }}
            onPointerMove={(e) => { if (!live && !dragging) setHoverPct(pctFromEvent(e)); }}
            onPointerLeave={() => setHoverPct(null)}
            style={{ position: 'relative', flex: 1, height: dragging ? 7 : 5, background: 'rgba(255,255,255,0.25)', borderRadius: 4, cursor: live ? 'default' : 'pointer', userSelect: 'none', transition: 'height 120ms', touchAction: 'none' }}
          >
            {/* Buffered */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${bufferedPct}%`, background: 'rgba(255,255,255,0.2)', borderRadius: 4 }} />
            {/* Hover preview fill */}
            {!live && hoverPct != null && !dragging && (
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${hoverPct * 100}%`, background: 'rgba(255,255,255,0.35)', borderRadius: 4, pointerEvents: 'none' }} />
            )}
            {/* Progress */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${barPct}%`, background: 'var(--accent,#E50914)', borderRadius: 4, transition: dragging ? 'none' : 'width 250ms linear' }} />
            {/* Thumb */}
            {!live && (
              <div style={{ position: 'absolute', left: `${barPct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: dragging ? 18 : 14, height: dragging ? 18 : 14, borderRadius: '50%', background: 'var(--accent,#E50914)', boxShadow: '0 0 0 4px rgba(229,9,20,0.28)', transition: dragging ? 'none' : 'left 250ms linear, width 120ms, height 120ms', pointerEvents: 'none' }} />
            )}
            {/* Time bubble (drag or hover) */}
            {!live && duration > 0 && (dragging || hoverPct != null) && (
              <div style={{ position: 'absolute', bottom: 18, left: `${(dragging ? scrubPct : (hoverPct || 0)) * 100}%`, transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 5, pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                {fmt((dragging ? scrubPct : (hoverPct || 0)) * duration)}
              </div>
            )}
          </div> ); })()}
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
            {/* Settings — quality, aspect, audio, subtitles */}
            <div style={{ position: 'relative' }}>
              <button onClick={(e) => { e.stopPropagation(); setShowQuality((s) => !s); }} style={{ ...ctrlBtn, color: activeSub ? settings.accentColor || '#E50914' : 'inherit' }} title="Settings">
                <Icons.Settings size={21} />
              </button>
              {showQuality && (
                <div onClick={(e) => e.stopPropagation()} style={{ ...menuPanel, width: 270, maxHeight: 520, overflowY: 'auto' }}>
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
                  {audioTracks.length > 1 && (
                    <>
                      <div style={{ ...menuHead, marginTop: 6, borderTop: '1px solid #2a2a2a', paddingTop: 10 }}>AUDIO TRACK</div>
                      {audioTracks.map((t) => (
                        <SubMenuItem key={t.id} label={t.name || t.lang || `Track ${t.id + 1}`} active={activeAudio === t.id} onClick={() => { switchAudio(t.id); }} />
                      ))}
                    </>
                  )}
                  {!live && (() => {
                    const hasResults = !loadingSubs && (nativeTracks.length > 0 || subtitles.length > 0);
                    return (
                      <>
                        <div style={{ ...menuHead, marginTop: 6, borderTop: '1px solid #2a2a2a', paddingTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                          SUBTITLES
                          {loadingSubs && <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid #333', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />}
                        </div>
                        {/* Size picker */}
                        <div style={{ display: 'flex', gap: 4, padding: '4px 14px 8px' }}>
                          {(['Small', 'Medium', 'Large'] as const).map((s) => (
                            <button key={s} onClick={() => updateSettings({ subSize: s })} style={{ flex: 1, fontFamily: 'inherit', fontSize: 11, fontWeight: 600, padding: '5px 0', border: 0, borderRadius: 4, cursor: 'pointer', background: settings.subSize === s ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)', color: settings.subSize === s ? '#fff' : '#777' }}>{s}</button>
                          ))}
                        </div>
                        {subLoadError && <div style={{ padding: '4px 14px 6px', fontSize: 12, color: '#e05252' }}>{subLoadError}</div>}
                        {!loadingSubs && !hasResults && <div style={{ padding: '6px 14px', fontSize: 12, color: '#555' }}>No subtitles found.</div>}
                        {activeSub && <SubMenuItem label="Off" active={false} onClick={() => { setActiveSub(null); setSubCues([]); setCurrentCue(''); if (nativeTracks.length) selectNativeTrack(null); }} />}
                        {nativeTracks.map((t) => {
                          const id = `native_${t.label}_${t.language}`;
                          return <SubMenuItem key={id} label={t.label || t.language || 'Embedded'} active={activeSub === id} onClick={() => selectNativeTrack(t)} />;
                        })}
                        {subtitles.map((s) => (
                          <SubMenuItem key={s.id} label={s.label} active={activeSub === s.id} onClick={() => loadSubtitle(s)} />
                        ))}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Download (VOD only) */}
            {!live && (
              <button onClick={(e) => { e.stopPropagation(); downloadStream(); }} title={copiedUrl ? 'URL copied!' : 'Download'} style={{ ...ctrlBtn, opacity: copiedUrl ? 1 : 0.85, color: copiedUrl ? '#46D369' : 'inherit' }}>
                <Icons.Download size={20} />
              </button>
            )}

            {/* Chromecast */}
            {castState !== 'unavailable' && (
              <button onClick={(e) => { e.stopPropagation(); requestCast(); }} title={castState === 'connected' ? 'Stop casting' : 'Cast to TV'} style={{ ...ctrlBtn, color: castState === 'connected' ? settings.accentColor || '#E50914' : 'inherit' }}>
                <Icons.Cast size={21} />
              </button>
            )}

            {/* Hide UI */}
            <button onClick={() => { setUiHidden(true); setShowQuality(false); setShowQuality(false); }} title="Hide controls (H)" style={ctrlBtn}>
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

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes slideInRight{from{transform:translateX(20px);opacity:0}to{transform:none;opacity:1}}`}</style>
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
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '9px 10px', border: 0,
        background: active ? 'rgba(229,9,20,0.12)' : hov ? 'rgba(255,255,255,0.06)' : 'transparent',
        color: '#fff', fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 5, textAlign: 'left' }}>
      <span style={{ width: 14, color: 'var(--accent,#E50914)', flexShrink: 0 }}>{active ? '✓' : ''}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

// Subtitle file row — icon + filename, matching UHF design
function SubFileItem({ label, active, loading, onClick }: { label: string; active: boolean; loading: boolean; onClick: () => void }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', width: '100%', alignItems: 'flex-start', gap: 10, padding: '9px 14px', border: 0,
        background: active ? 'rgba(255,255,255,0.08)' : hov ? 'rgba(255,255,255,0.05)' : 'transparent',
        color: active ? '#fff' : '#d4d4d4', fontSize: 13, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit',
        borderRadius: 0, textAlign: 'left', lineHeight: 1.35 }}>
      {loading ? (
        <div style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid #333', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite', flexShrink: 0, marginTop: 1 }} />
      ) : (
        <svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor" style={{ opacity: 0.5, flexShrink: 0, marginTop: 1 }}>
          <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v6a1 1 0 01-1 1H7l-3 3V10H3a1 1 0 01-1-1V3z"/>
          <path d="M15 7h1a1 1 0 011 1v5a1 1 0 01-1 1h-1v2l-2.5-2H9a1 1 0 01-1-1v-1h7V7z" opacity="0.6"/>
        </svg>
      )}
      <span style={{ flex: 1, wordBreak: 'break-word' }}>{label}</span>
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

