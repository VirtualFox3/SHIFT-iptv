// Xtream Codes API client
// Fetches live channels, VOD movies, and series from an Xtream provider.

import type { Channel, Title } from '../types';
import { proxify } from './proxy';

interface XtreamAuth { serverUrl: string; username: string; password: string; }

// Some providers use runs of "#"/"="/"*"/"-" as decorative separators in
// channel names — e.g. "###### RELAX 4K ######". Strip those, keep real text.
export function cleanChannelName(raw: string): string {
  return raw
    .replace(/[#=*~]{2,}/g, ' ')
    .replace(/(^|\s)-{2,}(\s|$)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim() || raw.trim();
}

// `extra` MUST be included before proxifying — otherwise on the deployed site
// it lands outside the encoded ?url= param and the server ignores it.
function api(auth: XtreamAuth, action: string, extra = '') {
  const base = auth.serverUrl.replace(/\/$/, '');
  return proxify(`${base}/player_api.php?username=${encodeURIComponent(auth.username)}&password=${encodeURIComponent(auth.password)}&action=${action}${extra}`);
}

/** Verify credentials and return server info */
export async function xtreamVerify(serverUrl: string, username: string, password: string) {
  const base = serverUrl.replace(/\/$/, '');
  const url = proxify(`${base}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  const data = await res.json();
  if (!data.user_info) throw new Error('Invalid credentials');
  return data;
}

/** Fetch all live channels */
export async function xtreamGetLive(auth: XtreamAuth): Promise<Channel[]> {
  try {
    const res = await fetch(api(auth, 'get_live_streams'));
    if (!res.ok) return [];
    const data: any[] = await res.json();
    const base = auth.serverUrl.replace(/\/$/, '');

    // Load EVERY channel (no cap).
    return data.map((ch, i) => {
      const name = cleanChannelName(ch.name || 'Channel ' + i);
      return {
      id: 'xt_live_' + (ch.stream_id || i),
      num: ch.num || i + 1,
      name,
      logo: name.slice(0, 2).toUpperCase(),
      cat: ch.category_name || 'General',
      grad: gradForCat(ch.category_name || ''),
      now: 'Live',
      next: '',
      prog: 0,
      rating: 'TV-G',
      viewers: '—',
      desc: name,
      // .m3u8 is the HLS-playlist form — playable by HLS.js in the browser.
      streamUrl: `${base}/live/${auth.username}/${auth.password}/${ch.stream_id}.m3u8`,
      logoUrl: ch.stream_icon || '',
      epgId: ch.epg_channel_id || '',
      };
    });
  } catch {
    return [];
  }
}

/** Fetch all VOD movies and return as Titles */
export async function xtreamGetVOD(auth: XtreamAuth): Promise<Title[]> {
  try {
    const res = await fetch(api(auth, 'get_vod_streams'));
    if (!res.ok) return [];
    const data: any[] = await res.json();
    const base = auth.serverUrl.replace(/\/$/, '');

    return data.map((m, i) => ({
      id: 'xt_vod_' + (m.stream_id || i),
      title: m.name || 'Movie ' + i,
      year: parseInt(m.year) || new Date().getFullYear(),
      rating: 'HD',
      imdbRating: m.rating ? String(m.rating) : (m.rating_5based ? (parseFloat(m.rating_5based) * 2).toFixed(1) : ''),
      seasons: 'Movie',
      // No fake critic scores — real ratings come from imdbRating only.
      genres: [m.category_name || 'Movies'],
      grad: gradForCat(m.category_name || ''),
      isShift: false,
      synopsis: m.plot || m.description || '',
      streamUrl: `${base}/movie/${auth.username}/${auth.password}/${m.stream_id}.${m.container_extension || 'mkv'}`,
      logoUrl: m.stream_icon || m.cover || '',
      backdropUrl: m.backdrop_path || m.cover_big || m.backdrop || '',
    }));
  } catch {
    return [];
  }
}

/** Fetch series list and return as Titles */
export async function xtreamGetSeries(auth: XtreamAuth): Promise<Title[]> {
  try {
    const res = await fetch(api(auth, 'get_series'));
    if (!res.ok) return [];
    const data: any[] = await res.json();

    return data.map((s, i) => ({
      id: 'xt_series_' + (s.series_id || i),
      title: s.name || 'Series ' + i,
      year: parseInt(s.year) || new Date().getFullYear(),
      rating: 'HD',
      imdbRating: s.rating ? String(s.rating) : (s.rating_5based ? (parseFloat(s.rating_5based) * 2).toFixed(1) : ''),
      seasons: 'Series',
      genres: [s.genre || s.category_name || 'Series'],
      grad: gradForCat(s.genre || s.category_name || ''),
      isShift: false,
      synopsis: s.plot || '',
      logoUrl: s.cover || s.stream_icon || '',
      backdropUrl: s.backdrop_path || s.cover_big || s.backdrop || '',
    }));
  } catch {
    return [];
  }
}

export interface VodInfo {
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  releaseDate?: string;
  duration?: string;
  rating?: string;
  tmdbId?: string;
  imdbId?: string;
  cover?: string;
  backdrop?: string;
}

/** Fetch rich VOD metadata (cast, director, plot, tmdb id) for one movie by stream id. */
export async function xtreamGetVodInfo(auth: XtreamAuth, streamId: string | number): Promise<VodInfo | null> {
  try {
    const res = await fetch(api(auth, 'get_vod_info', `&vod_id=${streamId}`));
    if (!res.ok) return null;
    const data = await res.json();
    const i = data.info || {};
    return {
      plot: i.plot || i.description,
      cast: i.cast || i.actors,
      director: i.director,
      genre: i.genre,
      releaseDate: i.releasedate || i.release_date,
      duration: i.duration,
      rating: i.rating,
      tmdbId: i.tmdb_id || i.tmdb,
      imdbId: i.imdb_id || i.imdb,
      cover: i.movie_image || i.cover_big || i.cover,
      backdrop: Array.isArray(i.backdrop_path) ? i.backdrop_path[0] : i.backdrop_path,
    };
  } catch {
    return null;
  }
}

export interface Episode {
  id: string;          // stream id
  title: string;
  season: number;
  episode: number;
  ext: string;
  plot?: string;
  duration?: string;
  still?: string;      // episode thumbnail
  playUrl: string;
}
export interface SeriesInfo {
  cast?: string;
  director?: string;
  plot?: string;
  genre?: string;
  cover?: string;
  backdrop?: string;
  seasons: { season: number; episodes: Episode[] }[];
}

/** Fetch series detail (cast/plot + seasons → episodes with play URLs). */
export async function xtreamGetSeriesInfo(auth: XtreamAuth, seriesId: string | number): Promise<SeriesInfo | null> {
  try {
    const res = await fetch(api(auth, 'get_series_info', `&series_id=${seriesId}`));
    if (!res.ok) return null;
    const data = await res.json();
    const info = data.info || {};
    const base = auth.serverUrl.replace(/\/$/, '');
    // `episodes` can be an object keyed by season, or (rarely) an array.
    const epsBySeason = data.episodes || {};
    const seasons: SeriesInfo['seasons'] = [];
    const seasonKeys = Array.isArray(epsBySeason)
      ? epsBySeason.map((_: any, i: number) => String(i)).filter((k) => epsBySeason[Number(k)])
      : Object.keys(epsBySeason);
    seasonKeys.sort((a, b) => Number(a) - Number(b)).forEach((sNum) => {
      const list = epsBySeason[sNum] || epsBySeason[Number(sNum)] || [];
      const eps: Episode[] = (Array.isArray(list) ? list : []).map((e: any) => {
        const ext = e.container_extension || e.containerExtension || 'mp4';
        const epNum = Number(e.episode_num ?? e.episodeNum ?? e.num) || 0;
        const inf = e.info || {};
        const epPlot =
          inf.plot || inf.overview || inf.description || inf.episode_description ||
          inf.synopsis || inf.storyline || inf.plot_overview || inf.summary ||
          e.plot || e.overview || e.description || e.synopsis || '';
        return {
          id: String(e.id ?? e.stream_id ?? ''),
          title: e.title || inf.name || `Episode ${epNum}`,
          season: Number(e.season ?? sNum) || Number(sNum),
          episode: epNum,
          ext,
          plot: epPlot,
          duration: inf.duration || (inf.duration_secs ? `${Math.round(inf.duration_secs / 60)} min` : undefined),
          still: inf.movie_image || inf.cover_big || inf.still_path || inf.still,
          playUrl: `${base}/series/${auth.username}/${auth.password}/${e.id ?? e.stream_id}.${ext}`,
        };
      }).filter((e: Episode) => e.id);
      if (eps.length) seasons.push({ season: Number(sNum), episodes: eps });
    });
    const imdbId = info.imdb_id || info.imdb || '';
    const enrichedSeasons = imdbId ? await enrichEpisodesFromCinemeta(imdbId, seasons) : seasons;
    return {
      cast: info.cast || info.actors,
      director: info.director,
      plot: info.plot,
      genre: info.genre,
      cover: info.cover,
      backdrop: Array.isArray(info.backdrop_path) ? info.backdrop_path[0] : info.backdrop_path,
      seasons: enrichedSeasons,
    };
  } catch {
    return null;
  }
}

/** Fetch episode overviews + thumbnails from Cinemeta (free, no key needed). */
async function enrichEpisodesFromCinemeta(imdbId: string, seasons: SeriesInfo['seasons']): Promise<SeriesInfo['seasons']> {
  try {
    const res = await fetch(`https://v3-cinemeta.strem.io/meta/series/${imdbId}.json`);
    if (!res.ok) return seasons;
    const data = await res.json();
    const videos: any[] = data.meta?.videos || [];
    const lookup = new Map<string, { overview: string; thumbnail: string }>();
    for (const v of videos) {
      if (v.season && v.episode) {
        lookup.set(`${v.season}_${v.episode}`, {
          overview: v.overview || '',
          thumbnail: v.thumbnail || '',
        });
      }
    }
    if (!lookup.size) return seasons;
    return seasons.map((s) => ({
      ...s,
      episodes: s.episodes.map((ep) => {
        const meta = lookup.get(`${ep.season}_${ep.episode}`);
        return {
          ...ep,
          plot: ep.plot || meta?.overview || '',
          still: ep.still || meta?.thumbnail || '',
        };
      }),
    }));
  } catch {
    return seasons;
  }
}

export interface EPGListing {
  title: string;
  description: string;
  start: number; // unix timestamp
  end: number;   // unix timestamp
}

/** Fetch short EPG for a single live stream (titles/descriptions are base64-encoded in the API). */
export async function xtreamGetShortEPG(
  auth: XtreamAuth,
  streamId: string | number,
  limit = 8,
): Promise<EPGListing[]> {
  try {
    const res = await fetch(api(auth, 'get_short_epg', `&stream_id=${streamId}&limit=${limit}`));
    if (!res.ok) return [];
    const data = await res.json();
    const listings: any[] = data.epg_listings || [];
    return listings.map((e) => ({
      title: safeAtob(e.title || ''),
      description: safeAtob(e.description || ''),
      start: Number(e.start_timestamp),
      end: Number(e.stop_timestamp),
    }));
  } catch {
    return [];
  }
}

// atob() decodes base64 to a byte-per-char binary string — fine for ASCII, but
// EPG titles are UTF-8, so multi-byte characters (accents, non-Latin scripts)
// get mangled into mojibake ("Pasión" → "PasiÃ³n") unless re-decoded as UTF-8.
function safeAtob(s: string): string {
  try {
    const binary = atob(s);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return s;
  }
}

function gradForCat(cat: string): [string, string] {
  const c = cat.toLowerCase();
  if (c.includes('sport')) return ['#06301d', '#0b6248'];
  if (c.includes('news')) return ['#0b1f3a', '#1f4e88'];
  if (c.includes('movie') || c.includes('film') || c.includes('cinema')) return ['#1a1140', '#4d2c8b'];
  if (c.includes('music')) return ['#3d0d3a', '#c2369d'];
  if (c.includes('kid') || c.includes('child') || c.includes('cartoon')) return ['#0b3a4a', '#2bb3c9'];
  if (c.includes('comedy')) return ['#3a2a06', '#caa01f'];
  if (c.includes('doc')) return ['#06321f', '#198a4f'];
  if (c.includes('drama')) return ['#2a0810', '#7c1530'];
  if (c.includes('action') || c.includes('thriller')) return ['#311006', '#8a3410'];
  if (c.includes('sci') || c.includes('fantasy')) return ['#1c2c5b', '#4d2c8b'];
  if (c.includes('horror')) return ['#1a0808', '#4a1010'];
  if (c.includes('romance')) return ['#3a0624', '#8a1050'];
  return ['#1a1a1a', '#2e2e2e'];
}
