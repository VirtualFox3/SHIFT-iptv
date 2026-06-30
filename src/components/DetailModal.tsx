import React, { useState, useEffect } from 'react';
import type { Channel, Title } from '../types';
import { useStore } from '../store/useStore';
import { xtreamGetVodInfo, xtreamGetSeriesInfo, type VodInfo, type SeriesInfo, type Episode } from '../api/xtream';
import { traktFetchRating } from '../api/trakt';
import { useTmdbBackdrop } from '../api/tmdb';
import * as Icons from './Icons';

interface DetailModalProps {
  item: Channel | Title;
  onClose: () => void;
  onPlay: (item: Channel | Title, next?: Title) => void;
}

function isTitle(item: Channel | Title): item is Title {
  return 'title' in item;
}

function isMovie(t: Title) {
  const s = (t.seasons || '').toLowerCase();
  return s === 'movie' || s === 'film' || s.includes('part') || s.includes('limited');
}

// ── Ratings badges (inspired by UHF / IPTVX) ──────────────────────────────
function RatingBadge({ label, value, color, bg, border }: { label: string; value: string; color: string; bg: string; border: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: bg, border: `1px solid ${border}`, borderRadius: 7, padding: '5px 11px', flexShrink: 0 }}>
      <span style={{ fontWeight: 800, fontSize: 12, color, letterSpacing: '0.03em' }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{value}</span>
    </div>
  );
}



export default function DetailModal({ item, onClose, onPlay }: DetailModalProps) {
  const myList = useStore((s) => s.myList);
  const toggleMyList = useStore((s) => s.toggleMyList);
  const settings = useStore((s) => s.settings);
  const provider = useStore((s) => s.provider);
  const inList = isTitle(item) && myList.includes(item.id);
  const accentColor = settings.accentColor;

  const [vodInfo, setVodInfo] = useState<VodInfo | null>(null);
  const [seriesInfo, setSeriesInfo] = useState<SeriesInfo | null>(null);
  const [activeSeason, setActiveSeason] = useState(0);
  const [loadingEps, setLoadingEps] = useState(false);

  // Live-fetched ratings
  const [traktScore, setTraktScore] = useState<number | null>(null);
  const [loadingRatings, setLoadingRatings] = useState(false);

  const xtAuth = provider?.type === 'xtream' && provider.serverUrl && provider.username
    ? { serverUrl: provider.serverUrl, username: provider.username, password: provider.password || '' } : null;

  // Fetch Xtream metadata
  useEffect(() => {
    setVodInfo(null); setSeriesInfo(null); setActiveSeason(0);
    setTraktScore(null);
    if (!isTitle(item) || !xtAuth) return;
    const mv = item.id.match(/^xt_vod_(.+)$/);
    const sr = item.id.match(/^xt_series_(.+)$/);
    if (mv) {
      xtreamGetVodInfo(xtAuth, mv[1]).then((info) => { if (info) setVodInfo(info); }).catch(() => {});
    } else if (sr) {
      setLoadingEps(true);
      xtreamGetSeriesInfo(xtAuth, sr[1])
        .then((info) => { if (info) { setSeriesInfo(info); setActiveSeason(info.seasons[0]?.season ?? 0); } })
        .catch(() => {})
        .finally(() => setLoadingEps(false));
    }
  }, [item, provider]);

  // Fetch Trakt rating (keyless — public client ID)
  useEffect(() => {
    if (!isTitle(item)) return;
    const t = item as Title;
    const title = t.title.replace(/·.*$/, '').replace(/^(EN|US|UK|4K)[\s\-|:]+/i, '').trim() || t.title;
    const type = isMovie(t) ? 'movie' : 'show';
    setLoadingRatings(true);
    traktFetchRating(type, title, t.year)
      .catch(() => null)
      .then((trakt) => { if (trakt != null) setTraktScore(trakt); })
      .finally(() => setLoadingRatings(false));
  }, [item]);

  const cast = vodInfo?.cast || seriesInfo?.cast;
  const director = vodInfo?.director || seriesInfo?.director;
  const providerHero = isTitle(item) ? (vodInfo?.backdrop || vodInfo?.cover || seriesInfo?.backdrop || seriesInfo?.cover || (item as Title).backdropUrl) : undefined;
  const tmdbHero = useTmdbBackdrop(
    isTitle(item) ? item.title : '',
    isTitle(item) ? item.year : undefined,
    isTitle(item) && isMovie(item as Title) ? 'movie' : 'tv',
    settings.tmdbApiKey,
    !!providerHero,
  );
  const heroImg = isTitle(item) ? (providerHero || tmdbHero || item.logoUrl) : undefined;
  const synopsis = isTitle(item) ? (vodInfo?.plot || seriesInfo?.plot || item.synopsis) : (item as Channel).desc;
  const seasonObj = seriesInfo?.seasons.find((s) => s.season === activeSeason) || seriesInfo?.seasons[0];

  // Compose display ratings: prefer fetched scores, fall back to stored values
  const displayImdb = isTitle(item) ? (item as Title).imdbRating : undefined;
  const displayTrakt = traktScore ?? (isTitle(item) ? (item as Title).trakt : undefined);

  function playEpisode(ep: Episode, idx: number) {
    if (!isTitle(item)) return;
    const current: Title = {
      ...item,
      id: item.id + '_s' + ep.season + 'e' + ep.episode,
      title: `${item.title} · S${ep.season} E${ep.episode}`,
      streamUrl: ep.playUrl,
      logoUrl: ep.still || item.logoUrl,
    } as Title;
    const nextEp = seasonObj?.episodes[idx + 1];
    const next: Title | undefined = nextEp ? {
      ...item,
      id: item.id + '_s' + nextEp.season + 'e' + nextEp.episode,
      title: `${item.title} · S${nextEp.season} E${nextEp.episode}`,
      streamUrl: nextEp.playUrl,
      logoUrl: nextEp.still || item.logoUrl,
    } as Title : undefined;
    onPlay(current, next);
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="nfx-scroll"
        style={{ width: '100%', maxWidth: 900, maxHeight: '92vh', overflowY: 'auto', background: '#181818', borderRadius: 12, boxShadow: '0 32px 80px rgba(0,0,0,0.85)' }}
      >
        {/* Hero */}
        <div style={{ position: 'relative', height: 380, background: `linear-gradient(135deg, ${(item as any).grad?.[0] || '#111'} 0%, ${(item as any).grad?.[1] || '#333'} 100%)`, overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
          {heroImg && (
            <img src={heroImg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, #181818 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0.65) 0%, transparent 60%)' }} />

          <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: '50%', background: 'rgba(24,24,24,0.85)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', zIndex: 2, backdropFilter: 'blur(4px)' }}>
            <Icons.Close size={16} />
          </button>

          {'num' in item && (
            <div style={{ position: 'absolute', top: 18, left: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 18 }}>{(item as Channel).logo}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>{(item as Channel).name}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>CH {(item as Channel).num}</div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: accentColor, color: '#fff', fontWeight: 800, fontSize: 11, padding: '3px 8px', borderRadius: 3 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />LIVE
              </span>
            </div>
          )}

          <div style={{ position: 'absolute', left: 32, bottom: 32 }}>
            <h2 style={{ fontWeight: 900, fontSize: 'clamp(24px,3vw,46px)', lineHeight: 1.05, letterSpacing: '-0.02em', margin: '0 0 14px', textShadow: '0 3px 16px rgba(0,0,0,0.6)', color: '#fff', maxWidth: '55%' }}>
              {isTitle(item) ? item.title : item.now}
            </h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => onPlay(item)} style={{ background: '#fff', border: 0, borderRadius: 6, padding: '10px 22px', color: '#000', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                <Icons.Play size={18} color="#000" />{isTitle(item) ? 'Play' : 'Watch Live'}
              </button>
              {isTitle(item) && (
                <button onClick={() => toggleMyList(item.id)} style={{ background: 'rgba(30,30,30,0.75)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 6, padding: '10px 20px', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit', backdropFilter: 'blur(8px)' }}>
                  {inList ? <Icons.Check size={18} /> : <Icons.Plus size={18} />}
                  {inList ? 'In My List' : 'My List'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info panel */}
        <div style={{ padding: '24px 32px 32px' }}>
          {/* Metadata row */}
          {isTitle(item) && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
              {item.match != null && <span style={{ color: '#46D369', fontWeight: 700, fontSize: 15 }}>{item.match}% Match</span>}
              <span style={{ fontSize: 14, color: '#ccc' }}>{item.year}</span>
              <span style={{ fontSize: 12, border: '1px solid rgba(255,255,255,0.3)', padding: '1px 7px', borderRadius: 3, color: '#aaa' }}>{item.rating}</span>
              <span style={{ fontSize: 14, color: '#ccc' }}>{item.seasons}</span>
            </div>
          )}

          {/* ── Ratings row (UHF/IPTVX-style badges) ── */}
          {isTitle(item) && (displayImdb || displayTrakt != null) && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
              {displayImdb && (
                <RatingBadge
                  label="IMDb"
                  value={displayImdb}
                  color="#F5C518"
                  bg="rgba(245,197,24,0.1)"
                  border="rgba(245,197,24,0.28)"
                />
              )}
              {displayTrakt != null && (
                <RatingBadge
                  label="Trakt"
                  value={`${displayTrakt}%`}
                  color="#ED5F36"
                  bg="rgba(237,95,54,0.1)"
                  border="rgba(237,95,54,0.28)"
                />
              )}
              {loadingRatings && !displayTrakt && (
                <span style={{ fontSize: 12, color: '#555', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #333', borderTopColor: '#777', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  Fetching ratings…
                </span>
              )}
            </div>
          )}

          {'num' in item && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#ddd' }}>{(item as Channel).cat}</span>
              <span style={{ fontSize: 12, border: '1px solid rgba(255,255,255,0.4)', padding: '1px 6px', borderRadius: 2, color: '#ccc' }}>{(item as Channel).rating}</span>
              <span style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4 }}><Icons.Volume size={13} />{(item as Channel).viewers} watching</span>
            </div>
          )}

          <p style={{ fontSize: 15, lineHeight: 1.6, color: '#ccc', margin: '0 0 16px', maxWidth: 640 }}>
            {synopsis || 'No description available.'}
          </p>

          {/* Cast / director */}
          {isTitle(item) && (cast || director) && (
            <div style={{ fontSize: 13.5, lineHeight: 1.7, marginBottom: 16, color: '#aaa' }}>
              {cast && <div><span style={{ color: '#666' }}>Cast: </span><span style={{ color: '#ccc' }}>{cast}</span></div>}
              {director && <div><span style={{ color: '#666' }}>Director: </span><span style={{ color: '#ccc' }}>{director}</span></div>}
            </div>
          )}

          {/* Genres */}
          {isTitle(item) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {item.genres.map((g) => (
                <span key={g} style={{ fontSize: 12, background: 'rgba(255,255,255,0.07)', padding: '4px 12px', borderRadius: 999, color: '#bbb', border: '1px solid rgba(255,255,255,0.08)' }}>{g}</span>
              ))}
            </div>
          )}

          {/* Live channel "On Now" */}
          {'now' in item && 'next' in item && (
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '14px 18px', marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#666', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>On Now</div>
              <div style={{ fontSize: 14, color: '#fff', fontWeight: 600, marginBottom: 4 }}>{(item as Channel).now}</div>
              <div style={{ fontSize: 12, color: '#8a8a8a' }}>Up next: {(item as Channel).next}</div>
              <div style={{ marginTop: 10, height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 2 }}>
                <div style={{ width: `${(item as Channel).prog}%`, height: '100%', background: accentColor, borderRadius: 2 }} />
              </div>
            </div>
          )}
        </div>

        {/* Episodes & Seasons */}
        {isTitle(item) && (loadingEps || seriesInfo) && (
          <div style={{ padding: '0 32px 40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderTop: '1px solid #242424', paddingTop: 24 }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
                Episodes{seasonObj ? ` · ${seasonObj.episodes.length}` : ''}
              </h3>
              {seriesInfo && seriesInfo.seasons.length > 1 && (
                <select value={activeSeason} onChange={(e) => setActiveSeason(Number(e.target.value))}
                  style={{ appearance: 'none', WebkitAppearance: 'none', background: '#252525', border: '1px solid #383838', color: '#fff', borderRadius: 7, padding: '9px 18px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}>
                  {seriesInfo.seasons.map((s) => <option key={s.season} value={s.season} style={{ background: '#202020' }}>Season {s.season} ({s.episodes.length})</option>)}
                </select>
              )}
            </div>

            {loadingEps && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#666', fontSize: 14, padding: '8px 0' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #333', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                Loading episodes…
              </div>
            )}
            {!loadingEps && seriesInfo && !seasonObj?.episodes.length && (
              <p style={{ color: '#666', fontSize: 14 }}>No episodes listed for this series.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {seasonObj?.episodes.map((ep, idx) => (
                <button key={ep.id} onClick={() => playEpisode(ep, idx)} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '14px 8px', background: 'transparent', border: 0, borderTop: '1px solid #1e1e1e', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%', transition: 'background 120ms', borderRadius: 4 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1f1f1f')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#555', width: 28, flexShrink: 0, textAlign: 'center', paddingTop: 6 }}>{ep.episode}</span>
                  <div style={{ position: 'relative', width: 200, height: 112, borderRadius: 8, background: provider?.bg || '#0f0f0f', flexShrink: 0, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                    {ep.still
                      ? <img src={ep.still} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      : null}
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0)', transition: 'background 150ms' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.5)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', display: 'grid', placeItems: 'center', border: '1.5px solid rgba(255,255,255,0.7)' }}>
                        <Icons.Play size={16} />
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.title}</span>
                      {ep.duration && <span style={{ fontSize: 12, color: '#555', flexShrink: 0 }}>{ep.duration}</span>}
                    </div>
                    {ep.plot
                      ? <div style={{ fontSize: 13, color: '#888', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ep.plot}</div>
                      : <div style={{ fontSize: 12, color: '#444' }}>Episode {ep.episode}</div>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
