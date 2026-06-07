import type { Provider, Channel, Title, Rail, EpgBlock } from './types';

export const DEMO_PROVIDERS: Provider[] = [
  { id: 'shiftpro', name: 'ShiftTV Pro', tag: '1,420 channels', letter: 'S', bg: 'linear-gradient(135deg,#6e1015,#E50914)', channels: 1420, type: 'demo' },
  { id: 'helix', name: 'Helix Streams', tag: '980 channels', letter: 'H', bg: 'linear-gradient(135deg,#11324f,#14B8A6)', channels: 980, type: 'demo' },
  { id: 'apollo', name: 'Apollo Lines', tag: '2,100 channels', letter: 'A', bg: 'linear-gradient(135deg,#2a1659,#6E3FF3)', channels: 2100, type: 'demo' },
  { id: 'nova', name: 'Nova Playlist', tag: '640 channels', letter: 'N', bg: 'linear-gradient(135deg,#0a3b2a,#46D369)', channels: 640, type: 'demo' },
];

export const DEMO_CHANNELS: Channel[] = [
  { id: 'sps1', num: 101, name: 'SHIFT Sports 1', logo: 'S1', cat: 'Sports', grad: ['#06301d', '#0b6248'], now: 'Premier League — Arsenal v Chelsea', next: 'The Match Review', prog: 64, rating: 'TV-PG', viewers: '312K', desc: 'Live top-flight football from the Emirates. Build-up, full ninety and post-match analysis with the studio panel.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'aps', num: 102, name: 'Apex Sports', logo: 'AX', cat: 'Sports', grad: ['#3a1206', '#a8430f'], now: 'NBA — Lakers v Celtics', next: 'Courtside Tonight', prog: 38, rating: 'TV-PG', viewers: '256K', desc: 'Coast-to-coast basketball, every night of the season.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'n24', num: 201, name: 'SHIFT News 24', logo: '24', cat: 'News', grad: ['#0b1f3a', '#1f4e88'], now: 'World Tonight', next: 'Markets Live', prog: 52, rating: 'TV-G', viewers: '188K', desc: 'Rolling international news, on the hour, every hour.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'cin1', num: 301, name: 'Cinema One', logo: 'C1', cat: 'Movies', grad: ['#1a1140', '#4d2c8b'], now: 'Last Light (2024)', next: 'Undertow (2023)', prog: 21, rating: 'TV-MA', viewers: '204K', desc: 'Premieres and modern classics, uncut and commercial-free.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'pls', num: 401, name: 'Pulse Music', logo: 'PL', cat: 'Music', grad: ['#3d0d3a', '#c2369d'], now: 'Top 40 Live', next: 'After Hours Mix', prog: 77, rating: 'TV-14', viewers: '143K', desc: 'The chart, back to back. Wall-to-wall music videos.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'lol', num: 501, name: 'Laughs', logo: 'LA', cat: 'Comedy', grad: ['#3a2a06', '#caa01f'], now: 'Stand-Up Hour', next: 'Sketch Vault', prog: 45, rating: 'TV-14', viewers: '97K', desc: 'Non-stop comedy — stand-up specials, panel shows.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'ter', num: 601, name: 'Terra', logo: 'TR', cat: 'Documentary', grad: ['#06321f', '#198a4f'], now: 'Wild Kingdoms', next: 'Blue Planet Deep', prog: 60, rating: 'TV-G', viewers: '131K', desc: 'The natural world in stunning detail.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'len', num: 602, name: 'Lens', logo: 'LN', cat: 'Documentary', grad: ['#241a0a', '#6e5320'], now: 'The Heist Files', next: 'Cold Cases', prog: 33, rating: 'TV-14', viewers: '84K', desc: 'True stories, told straight. Investigations and retrospectives.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'sag', num: 701, name: 'Saga', logo: 'SG', cat: 'Drama', grad: ['#2a0810', '#7c1530'], now: 'Paper Kings — S2 E4', next: 'The Long Game', prog: 18, rating: 'TV-MA', viewers: '176K', desc: 'Prestige drama, marathoned. Box-set storytelling.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'jun', num: 801, name: 'Junior', logo: 'JR', cat: 'Kids', grad: ['#0b3a4a', '#2bb3c9'], now: 'Cartoon Block', next: 'Story Time', prog: 50, rating: 'TV-Y', viewers: '120K', desc: 'Safe, all-day block of animation for the youngest viewers.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'blt', num: 901, name: 'Bolt', logo: 'BL', cat: 'Action', grad: ['#311006', '#8a3410'], now: 'Goldcoast (2023)', next: 'Cinder & Smoke', prog: 8, rating: 'TV-MA', viewers: '158K', desc: 'High-octane action all night.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'fro', num: 902, name: 'Frontier', logo: 'FR', cat: 'Reality', grad: ['#0a2436', '#1f5a78'], now: 'Build It Wild', next: 'Survive the Coast', prog: 71, rating: 'TV-PG', viewers: '73K', desc: 'Reality from the edge of the map.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
];

export const DEMO_TITLES: Title[] = [
  { id: 'nightfall', title: 'Nightfall', year: 2025, rating: 'TV-MA', seasons: 'Season 1', match: 98, rt: 96, trakt: 89, watchers: '1.4M', genres: ['Ominous', 'Supernatural', 'Sci-Fi'], grad: ['#1c2c5b', '#4d2c8b'], isShift: true, top: 1, synopsis: 'When the sun fails to rise over a remote mountain town, a sheriff and a stranded astronomer race to decode a signal buried in the dark.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'longgame', title: 'The Long Game', year: 2024, rating: 'TV-MA', seasons: '2 Seasons', match: 91, rt: 88, trakt: 84, watchers: '820K', genres: ['Political', 'Thriller'], grad: ['#6e1015', '#2a0608'], isShift: true, top: 2, synopsis: 'A newly-appointed ambassador inherits a crisis she didn\'t create — and a marriage that may be its own diplomatic incident.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'cinder', title: 'Cinder & Smoke', year: 2025, rating: 'TV-14', seasons: 'Season 1', match: 84, rt: 79, trakt: 76, watchers: '610K', genres: ['Cyberpunk', 'Action'], grad: ['#0a3b2a', '#0b6248'], isShift: true, top: 3, synopsis: 'In a neon harbour city, a junior smith of outlawed cybernetic blades is pulled into a war between three rival syndicates.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'queens', title: "Queen's Defense", year: 2023, rating: 'TV-MA', seasons: 'Limited Series', match: 96, rt: 97, trakt: 92, watchers: '2.1M', genres: ['Drama', 'Period'], grad: ['#3a2200', '#7a4e0d'], isShift: true, top: 4, synopsis: 'Orphaned at nine, a quiet prodigy masters a game ruled by men — but brilliance on the board comes at a private cost.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'crowne', title: 'Crowne', year: 2024, rating: 'TV-MA', seasons: '5 Seasons', match: 89, rt: 91, trakt: 88, watchers: '1.7M', genres: ['History', 'Drama'], grad: ['#1a1a3a', '#2c5278'], isShift: true, top: 5, synopsis: 'Power, romance and rivalry inside a reigning dynasty, charted across the decades that reshaped a century.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'undertow', title: 'Undertow', year: 2023, rating: 'TV-MA', seasons: '2 Seasons', match: 94, rt: 90, trakt: 85, watchers: '740K', genres: ['Crime', 'Thriller'], grad: ['#26121a', '#7c1530'], isShift: true, top: 6, synopsis: 'A small-town detective with everything to lose follows a drowning that refuses to read as an accident.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'veil', title: 'Veil', year: 2024, rating: 'TV-14', seasons: 'Season 1', match: 87, rt: 82, trakt: 80, watchers: '390K', genres: ['Mystery', 'Drama'], grad: ['#1f1f1f', '#4a2d6e'], isShift: true, top: 7, synopsis: 'A grieving illusionist returns to her hometown and finds the trick that made her famous tied to a decades-old disappearance.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'goldcoast', title: 'Goldcoast', year: 2024, rating: 'TV-MA', seasons: '3 Seasons', match: 88, rt: 85, trakt: 83, watchers: '560K', genres: ['Heist', 'Drama'], grad: ['#311006', '#8a3410'], isShift: true, top: 8, synopsis: 'Eight strangers, one impossible vault, and a mastermind feeding the police exactly what they want to hear.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'paperkings', title: 'Paper Kings', year: 2022, rating: 'TV-MA', seasons: '4 Seasons', match: 92, rt: 94, trakt: 90, watchers: '1.9M', genres: ['Crime', 'Family'], grad: ['#0a1a1a', '#1d3a3a'], isShift: true, synopsis: 'An accountant relocates his family to a quiet lake town and launders a fortune to keep them all alive.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'lastlight', title: 'Last Light', year: 2024, rating: 'TV-MA', seasons: 'Limited Series', match: 85, rt: 80, trakt: 78, watchers: '430K', genres: ['Survival', 'Sci-Fi'], grad: ['#0d1a0a', '#2a3508'], isShift: true, synopsis: 'When the power grids fail for good, a botanist and her daughter walk a thousand miles toward a rumour of a working city.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'saltroad', title: 'Salt Road', year: 2023, rating: 'TV-MA', seasons: '3 Parts', match: 90, rt: 89, trakt: 86, watchers: '680K', genres: ['Heist', 'Drama'], grad: ['#1a2c5a', '#0a0a18'], isShift: true, synopsis: 'A gentleman thief stages an elaborate revenge against the family that framed his father, one impossible robbery at a time.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  { id: 'harbour', title: 'Harbour', year: 2022, rating: 'TV-MA', seasons: '4 Seasons', match: 86, rt: 83, trakt: 81, watchers: '510K', genres: ['Crime', 'Drama'], grad: ['#0a1424', '#1f3a6e'], isShift: true, synopsis: 'Two detectives on opposite sides of a dock-side feud discover the only way out is straight through each other.', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
];

export const DEMO_RAILS: Rail[] = [
  { id: 'cont', title: 'Continue Watching', kind: 'title', ids: ['nightfall', 'undertow', 'paperkings', 'crowne'], progress: { nightfall: 65, undertow: 22, paperkings: 84, crowne: 40 } },
  { id: 'live', title: 'Live Now', kind: 'channel', ids: ['sps1', 'cin1', 'n24', 'pls', 'ter', 'sag', 'aps', 'jun'] },
  { id: 'top10', title: 'Top 10 on SHIFT Today', kind: 'title', ids: ['nightfall', 'longgame', 'cinder', 'queens', 'crowne', 'undertow', 'veil', 'goldcoast', 'paperkings', 'lastlight'], topRow: true },
  { id: 'sport', title: 'Sport Happening Now', kind: 'channel', ids: ['sps1', 'aps', 'fro', 'blt'] },
  { id: 'orig', title: 'Only on SHIFT', kind: 'title', ids: ['cinder', 'goldcoast', 'veil', 'crowne', 'saltroad', 'nightfall'] },
  { id: 'drama', title: 'Critically Acclaimed Dramas', kind: 'title', ids: ['crowne', 'queens', 'harbour', 'longgame', 'paperkings', 'veil'] },
];

export const EPG_START = 18;
export const EPG_HOURS = 6;

export const SCHEDULE: Record<string, EpgBlock[]> = {
  sps1: [{ t: 17, title: 'Warm-Up Show', dur: 1 }, { t: 18, title: 'Premier League — Arsenal v Chelsea', dur: 2, live: true }, { t: 20, title: 'The Match Review', dur: 1 }, { t: 21, title: 'Football Weekly', dur: 1.5 }],
  aps: [{ t: 17.5, title: 'Pre-Game', dur: 0.5 }, { t: 18, title: 'NBA — Lakers v Celtics', dur: 2.5, live: true }, { t: 20.5, title: 'Courtside Tonight', dur: 1 }],
  n24: [{ t: 17, title: 'The Brief', dur: 1 }, { t: 18, title: 'World Tonight', dur: 1, live: true }, { t: 19, title: 'Markets Live', dur: 1 }],
  cin1: [{ t: 16.5, title: 'Salt Road (2023)', dur: 1.5 }, { t: 18, title: 'Last Light (2024)', dur: 2, live: true }, { t: 20, title: 'Undertow (2023)', dur: 2 }],
  pls: [{ t: 17, title: 'Drive Time', dur: 1 }, { t: 18, title: 'Top 40 Live', dur: 2, live: true }, { t: 20, title: 'After Hours Mix', dur: 2 }],
  lol: [{ t: 17, title: 'Sketch Vault', dur: 1 }, { t: 18, title: 'Stand-Up Hour', dur: 1, live: true }, { t: 19, title: 'Panel Night', dur: 1.5 }],
  ter: [{ t: 17, title: 'Coast', dur: 1 }, { t: 18, title: 'Wild Kingdoms', dur: 1.5, live: true }, { t: 19.5, title: 'Blue Planet Deep', dur: 1.5 }],
  len: [{ t: 17, title: 'Cold Cases', dur: 1 }, { t: 18, title: 'The Heist Files', dur: 2, live: true }, { t: 20, title: 'Cold Cases', dur: 1 }],
  sag: [{ t: 17, title: 'Paper Kings — S2 E3', dur: 1 }, { t: 18, title: 'Paper Kings — S2 E4', dur: 1, live: true }, { t: 19, title: 'The Long Game — S1 E1', dur: 1 }],
  jun: [{ t: 17, title: 'Story Time', dur: 1 }, { t: 18, title: 'Cartoon Block', dur: 1.5, live: true }, { t: 19.5, title: 'Bedtime Tales', dur: 0.5 }],
  blt: [{ t: 16, title: 'Cinder & Smoke (2025)', dur: 2 }, { t: 18, title: 'Goldcoast (2023)', dur: 2, live: true }, { t: 20, title: 'Cinder & Smoke (2025)', dur: 2 }],
  fro: [{ t: 17, title: 'Survive the Coast', dur: 1 }, { t: 18, title: 'Build It Wild', dur: 1, live: true }, { t: 19, title: 'Survive the Coast', dur: 1 }],
};
