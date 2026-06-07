import React, { useState, useEffect } from 'react';
import type { Channel, Title } from '../types';
import { useStore } from '../store/useStore';
import { xtreamGetVodInfo, xtreamGetSeriesInfo, type VodInfo, type SeriesInfo, type Episode } from '../api/xtream';
import * as Icons from './Icons';

interface DetailModalProps {
  item: Channel | Title;
  onClose: () => void;
  onPlay: (item: Channel | Title) => void;
}

function isTitle(item: Channel | Title): item is Title {
  return 'title' in item;
}

export default function DetailModal({ item, onClose, onPlay }: DetailModalProps) {
  const myList = useStore((s) => s.myList);
  const toggleMyList = useStore((s) => s.toggleMyList);
  const settings = useStore((s) => s.settings);
  const provider = useStore((s) => s.provider);
  const inList = isTitle(item) && myList.includes(item.id);
  const accentColor = settings.accentColor;

  // Lazy-fetch rich metadata for Xtream movies (vod_info) and series (series_info).
  const [vodInfo, setVodInfo] = useState<VodInfo | null>(null);
  const [seriesInfo, setSeriesInfo] = useState<SeriesInfo | null>(null);
  const [activeSeason, setActiveSeason] = useState(0);
  const [loadingEps, setLoadingEps] = useState(false);
  const xtAuth = provider?.type === 'xtream' && provider.serverUrl && provider.username
    ? { serverUrl: provider.serverUrl, username: provider.username, password: provider.password || '' } : null;

  useEffect(() => {
    setVodInfo(null); setSeriesInfo(null); setActiveSeason(0);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, provider]);

  const cast = vodInfo?.cast || seriesInfo?.cast;
  const director = vodInfo?.director || seriesInfo?.director;
  const heroImg = isTitle(item) ? (vodInfo?.backdrop || vodInfo?.cover || seriesInfo?.backdrop || seriesInfo?.cover || item.logoUrl) : undefined;
  const synopsis = isTitle(item) ? (vodInfo?.plot || seriesInfo?.plot || item.synopsis) : (item as Channel).desc;

  function playEpisode(ep: Episode) {
    if (!isTitle(item)) return;
    onPlay({ ...item, id: item.id + '_s' + ep.season + 'e' + ep.episode, title: `${item.title} · S${ep.season} E${ep.episode}`, streamUrl: ep.playUrl } as Title);
  }
  const seasonObj = seriesInfo?.seasons.find((s) => s.season === activeSeason) || seriesInfo?.seasons[0];

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="nfx-scroll"
        style={{ width: '100%', maxWidth: 860, maxHeight: '92vh', overflowY: 'auto', background: '#181818', borderRadius: 10, boxShadow: '0 25px 60px rgba(0,0,0,0.8)' }}
      >
        {/* Hero */}
        <div style={{ position: 'relative', height: 360, background: `linear-gradient(135deg, ${(item as any).grad?.[0] || '#111'} 0%, ${(item as any).grad?.[1] || '#333'} 100%)`, overflow: 'hidden' }}>
          {heroImg && (
            <img src={heroImg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 30%, #181818 100%)' }} />
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '55%', background: 'linear-gradient(90deg, rgba(0,0,0,0.5) 0%, transparent 100%)' }} />

          <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: '50%', background: '#181818', border: 0, color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', zIndex: 2 }}>
            <Icons.Close size={18} />
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

          <div style={{ position: 'absolute', left: 32, bottom: 36 }}>
            <h2 style={{ fontWeight: 900, fontSize: isTitle(item) ? 'clamp(28px,3vw,48px)' : 28, lineHeight: 1.05, letterSpacing: '-0.02em', margin: '0 0 10px', textShadow: '0 3px 12px rgba(0,0,0,0.5)', color: '#fff' }}>
              {isTitle(item) ? item.title : item.now}
            </h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => onPlay(item)} style={{ background: '#fff', border: 0, borderRadius: 4, padding: '9px 20px', color: '#000', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}>
                <Icons.Play size={18} color="#000" />{isTitle(item) ? 'Play' : 'Watch Live'}
              </button>
              {isTitle(item) && (
                <button onClick={() => toggleMyList(item.id)} style={{ background: 'rgba(109,109,110,0.6)', border: '2px solid rgba(255,255,255,0.4)', borderRadius: 4, padding: '9px 20px', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}>
                  {inList ? <Icons.Check size={18} /> : <Icons.Plus size={18} />}
                  {inList ? 'In My List' : 'My List'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info panel */}
        <div style={{ padding: '24px 32px 32px', display: 'flex', gap: 32 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {isTitle(item) && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
                {item.match != null && <span style={{ color: '#46D369', fontWeight: 700, fontSize: 15 }}>{item.match}% Match</span>}
                {item.imdbRating && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 14 }}><Icons.Star size={15} filled />{item.imdbRating}</span>}
                <span style={{ fontSize: 13, color: '#ddd' }}>{item.year}</span>
                <span style={{ fontSize: 12, border: '1px solid rgba(255,255,255,0.4)', padding: '1px 6px', borderRadius: 2, color: '#ccc' }}>{item.rating}</span>
                <span style={{ fontSize: 13, color: '#ddd' }}>{item.seasons}</span>
              </div>
            )}
            {'num' in item && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#ddd' }}>{(item as Channel).cat}</span>
                <span style={{ fontSize: 12, border: '1px solid rgba(255,255,255,0.4)', padding: '1px 6px', borderRadius: 2, color: '#ccc' }}>{(item as Channel).rating}</span>
                <span style={{ fontSize: 13, color: '#ddd', display: 'flex', alignItems: 'center', gap: 4 }}><Icons.Volume size={13} />{(item as Channel).viewers} watching</span>
              </div>
            )}
            <p style={{ fontSize: 15, lineHeight: 1.55, color: '#ddd', margin: '0 0 16px' }}>
              {synopsis || 'No description available.'}
            </p>
            {/* Cast / director (Xtream movies + series) */}
            {isTitle(item) && (cast || director) && (
              <div style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 16 }}>
                {cast && <div><span style={{ color: '#777' }}>Cast: </span><span style={{ color: '#ddd' }}>{cast}</span></div>}
                {director && <div><span style={{ color: '#777' }}>Director: </span><span style={{ color: '#ddd' }}>{director}</span></div>}
              </div>
            )}
            {isTitle(item) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {item.genres.map((g) => (
                  <span key={g} style={{ fontSize: 12, background: 'rgba(255,255,255,0.08)', padding: '4px 10px', borderRadius: 999, color: '#ccc' }}>{g}</span>
                ))}
              </div>
            )}
            {'now' in item && 'next' in item && (
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: '12px 16px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#666', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>On Now</div>
                <div style={{ fontSize: 14, color: '#fff', fontWeight: 600, marginBottom: 4 }}>{(item as Channel).now}</div>
                <div style={{ fontSize: 12, color: '#8a8a8a' }}>Up next: {(item as Channel).next}</div>
                <div style={{ marginTop: 10, height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 2 }}>
                  <div style={{ width: `${(item as Channel).prog}%`, height: '100%', background: accentColor, borderRadius: 2 }} />
                </div>
              </div>
            )}
          </div>

          {isTitle(item) && (item.imdbRating || item.trakt != null || item.rt != null) && (
            <div style={{ width: 200, flexShrink: 0, fontSize: 13 }}>
              {item.imdbRating && (
                <div style={{ marginBottom: 12 }}><span style={{ color: '#666' }}>IMDb: </span><span style={{ color: '#ddd', fontWeight: 600 }}>{item.imdbRating}</span></div>
              )}
              {item.trakt != null && (
                <div style={{ marginBottom: 12 }}><span style={{ color: '#666' }}>Trakt: </span><span style={{ color: '#ddd', fontWeight: 600 }}>{item.trakt}%</span></div>
              )}
              {item.rt != null && (
                <div style={{ marginBottom: 12 }}><span style={{ color: '#666' }}>RT: </span><span style={{ color: '#ddd', fontWeight: 600 }}>{item.rt}%</span></div>
              )}
              {item.watchers && (
                <div style={{ marginBottom: 12 }}><span style={{ color: '#666' }}>Watchers: </span><span style={{ color: '#ddd', fontWeight: 600 }}>{item.watchers}</span></div>
              )}
            </div>
          )}
        </div>

        {/* Episodes & Seasons (Xtream series) — full width */}
        {isTitle(item) && (loadingEps || seriesInfo) && (
          <div style={{ padding: '0 32px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderTop: '1px solid #2a2a2a', paddingTop: 24 }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
                Episodes{seasonObj ? ` · ${seasonObj.episodes.length}` : ''}
              </h3>
              {seriesInfo && seriesInfo.seasons.length > 1 && (
                <select value={activeSeason} onChange={(e) => setActiveSeason(Number(e.target.value))}
                  style={{ appearance: 'none', WebkitAppearance: 'none', background: '#2a2a2a', border: '1px solid #383838', color: '#fff', borderRadius: 6, padding: '9px 16px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', outline: 'none' }}>
                  {seriesInfo.seasons.map((s) => <option key={s.season} value={s.season} style={{ background: '#202020' }}>Season {s.season} ({s.episodes.length})</option>)}
                </select>
              )}
            </div>

            {loadingEps && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#8a8a8a', fontSize: 14, padding: '8px 0' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #333', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                Loading episodes…
              </div>
            )}
            {!loadingEps && seriesInfo && !seasonObj?.episodes.length && (
              <p style={{ color: '#8a8a8a', fontSize: 14 }}>No episodes listed for this series.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {seasonObj?.episodes.map((ep) => (
                <button key={ep.id} onClick={() => playEpisode(ep)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 8px', background: 'transparent', border: 0, borderTop: '1px solid #242424', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%', transition: 'background 120ms' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1f1f1f')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#888', width: 30, flexShrink: 0, textAlign: 'center' }}>{ep.episode}</span>
                  <div style={{ position: 'relative', width: 130, height: 73, borderRadius: 6, background: '#0a0a0a', flexShrink: 0, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                    {ep.still
                      ? <img src={ep.still} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      : <Icons.Play size={20} color="#555" />}
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.25)', opacity: 0, transition: 'opacity 120ms' }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}>
                      <Icons.Play size={24} />
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ep.title}</span>
                      {ep.duration && <span style={{ fontSize: 12.5, color: '#888', flexShrink: 0 }}>{ep.duration}</span>}
                    </div>
                    {ep.plot && <div style={{ fontSize: 13, color: '#8a8a8a', marginTop: 5, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ep.plot}</div>}
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
