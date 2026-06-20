export interface Provider {
  id: string;
  name: string;
  tag: string;
  letter: string;
  bg: string;
  channels: number;
  type: 'xtream' | 'm3u' | 'manifest' | 'jellyfin' | 'demo';
  serverUrl?: string;
  username?: string;
  password?: string;
  m3uUrl?: string;
  manifestUrl?: string;
  jellyfinUrl?: string;
  jellyfinApiKey?: string;
  profileImage?: string;   // data URL for a custom profile picture
}

export interface Channel {
  id: string;
  num: number;
  name: string;
  logo: string;
  cat: string;
  grad: [string, string];
  now: string;
  next: string;
  prog: number;
  rating: string;
  viewers: string;
  desc: string;
  streamUrl?: string;
  logoUrl?: string;
  epgId?: string;
}

export interface Title {
  id: string;
  title: string;
  year: number;
  rating: string;
  seasons: string;
  match?: number;     // optional — only shown when real (demo catalogue)
  rt?: number;
  trakt?: number;
  watchers?: string;
  imdbRating?: string;  // real provider/IMDb rating, e.g. "8.0"
  genres: string[];
  grad: [string, string];
  isShift?: boolean;
  top?: number;
  synopsis: string;
  streamUrl?: string;
  traktId?: number;
  imdbId?: string;
  tmdbId?: number;
  logoUrl?: string;    // poster / cover image
  backdropUrl?: string;    // wide/landscape backdrop image
}

export interface Rail {
  id: string;
  title: string;
  kind: 'title' | 'channel';
  ids: string[];
  topRow?: boolean;
  progress?: Record<string, number>;
}

export interface EpgBlock {
  t: number;
  title: string;
  dur: number;
  live?: boolean;
}

export interface Subtitle {
  id: string;
  language: string;
  languageCode: string;
  fileName: string;
  downloadCount: number;
  fileId: number;
  url?: string;
}

export interface TraktWatchStatus {
  watched: boolean;
  watchedAt?: string;
  progress?: number;
}

export interface Settings {
  // Playback
  autoplayNext: boolean;
  autoplayPreviews: boolean;
  skipIntros: boolean;
  // Quality
  quality: 'Auto' | 'Low' | 'Standard' | 'High';
  dataSaver: boolean;
  // Subtitles
  subLang: string;
  audioLang: string;
  subSize: 'Small' | 'Medium' | 'Large';
  subEnabled: boolean;
  // Parental
  maturity: string;
  pinLock?: boolean;
  // Notifications
  notifNew: boolean;
  notifReminders: boolean;
  notifRecs: boolean;
  notifEmail: boolean;
  // Tweaks
  bbStyle: 'Spotlight' | 'Cinema Wall' | 'Centered' | 'Mosaic';
  accentColor: string;
  cardRadius: number;
  // Integrations
  openSubtitlesToken?: string;
  openSubtitlesUsername?: string;
  openSubtitlesApiKey?: string;
  traktAccessToken?: string;
  traktRefreshToken?: string;
  traktUsername?: string;
  omdbApiKey?: string;
  // Appearance
  theme: 'dark' | 'light';
  // Profile
  profilePic?: string;     // data URL of uploaded profile image
  profileName?: string;
}

export type AspectRatio = 'auto' | '21:9' | '19.5:9' | '16:10' | '16:9' | '5:4' | '4:3' | '1:1';

export interface TweakValues {
  bbStyle: string;
  accentColor: string;
  cardRadius: number;
  subSize: string;
  autoHideControls: boolean;
}
