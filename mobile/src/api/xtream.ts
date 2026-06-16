import type { Channel, Title } from '../types';

export interface XtreamAuth {
  serverUrl: string;
  username: string;
  password: string;
}

function base(auth: XtreamAuth) {
  return auth.serverUrl.replace(/\/$/, '');
}

function api(auth: XtreamAuth, action: string, seriesId?: string | number) {
  const b = base(auth);
  const extra = seriesId !== undefined ? `&series_id=${seriesId}` : '';
  return `${b}/player_api.php?username=${encodeURIComponent(auth.username)}&password=${encodeURIComponent(auth.password)}&action=${action}${extra}`;
}

export async function xtreamVerify(auth: XtreamAuth) {
  const b = base(auth);
  const url = `${b}/player_api.php?username=${encodeURIComponent(auth.username)}&password=${encodeURIComponent(auth.password)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' } });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  const data = await res.json();
  if (!data.user_info) throw new Error('Invalid credentials');
  return data;
}

async function getLive(auth: XtreamAuth): Promise<Channel[]> {
  try {
    const res = await fetch(api(auth, 'get_live_streams'), {
      headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' },
    });
    if (!res.ok) return [];
    const data: any[] = await res.json();
    const b = base(auth);
    return data.map((ch, i) => ({
      id: 'xt_live_' + (ch.stream_id || i),
      num: ch.num || i + 1,
      name: ch.name || 'Channel ' + i,
      cat: ch.category_name || 'General',
      now: 'Live',
      streamUrl: `${b}/live/${auth.username}/${auth.password}/${ch.stream_id}.m3u8`,
      logoUrl: ch.stream_icon || '',
    }));
  } catch { return []; }
}

async function getVOD(auth: XtreamAuth): Promise<Title[]> {
  try {
    const res = await fetch(api(auth, 'get_vod_streams'), {
      headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' },
    });
    if (!res.ok) return [];
    const data: any[] = await res.json();
    const b = base(auth);
    return data.map((m, i) => ({
      id: 'xt_vod_' + (m.stream_id || i),
      title: m.name || 'Movie ' + i,
      year: parseInt(m.year) || new Date().getFullYear(),
      seasons: 'Movie',
      genres: [m.category_name || 'Movies'],
      synopsis: m.plot || '',
      streamUrl: `${b}/movie/${auth.username}/${auth.password}/${m.stream_id}.${m.container_extension || 'mkv'}`,
      logoUrl: m.stream_icon || m.cover || '',
      imdbRating: m.rating ? String(m.rating) : '',
    }));
  } catch { return []; }
}

async function getSeries(auth: XtreamAuth): Promise<Title[]> {
  try {
    const res = await fetch(api(auth, 'get_series'), {
      headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' },
    });
    if (!res.ok) return [];
    const data: any[] = await res.json();
    return data.map((s, i) => ({
      id: 'xt_series_' + (s.series_id || i),
      title: s.name || 'Series ' + i,
      year: parseInt(s.year) || new Date().getFullYear(),
      seasons: 'Series',
      genres: [s.genre || s.category_name || 'Series'],
      synopsis: s.plot || '',
      streamUrl: '',
      logoUrl: s.cover || '',
      imdbRating: s.rating ? String(s.rating) : '',
    }));
  } catch { return []; }
}

export async function fetchXtream(auth: XtreamAuth) {
  await xtreamVerify(auth);
  const [channels, vod, series] = await Promise.all([
    getLive(auth), getVOD(auth), getSeries(auth),
  ]);
  return { channels, titles: [...vod, ...series] };
}

export interface Episode {
  id: string;
  title: string;
  season: number;
  episode: number;
  plot?: string;
  duration?: string;
  still?: string;
  playUrl: string;
}

export interface SeriesInfo {
  plot?: string;
  cover?: string;
  seasons: { season: number; episodes: Episode[] }[];
}

export async function xtreamGetSeriesInfo(auth: XtreamAuth, seriesId: string | number): Promise<SeriesInfo | null> {
  try {
    const res = await fetch(api(auth, 'get_series_info', seriesId), {
      headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const info = data.info || {};
    const b = base(auth);
    const epsBySeason = data.episodes || {};
    const seasons: SeriesInfo['seasons'] = [];
    Object.keys(epsBySeason).sort((a, b2) => Number(a) - Number(b2)).forEach((sNum) => {
      const list = epsBySeason[sNum] || [];
      const eps: Episode[] = (Array.isArray(list) ? list : []).map((e: any) => {
        const ext = e.container_extension || 'mp4';
        const epNum = Number(e.episode_num ?? e.num) || 0;
        const inf = e.info || {};
        return {
          id: String(e.id ?? e.stream_id ?? ''),
          title: e.title || inf.name || `Episode ${epNum}`,
          season: Number(e.season ?? sNum) || Number(sNum),
          episode: epNum,
          plot: inf.plot || inf.overview,
          duration: inf.duration || (inf.duration_secs ? `${Math.round(inf.duration_secs / 60)} min` : undefined),
          still: inf.movie_image || inf.cover_big || inf.still_path,
          playUrl: `${b}/series/${auth.username}/${auth.password}/${e.id ?? e.stream_id}.${ext}`,
        };
      }).filter((e: Episode) => e.id);
      if (eps.length) seasons.push({ season: Number(sNum), episodes: eps });
    });
    return { plot: info.plot, cover: info.cover, seasons };
  } catch {
    return null;
  }
}
