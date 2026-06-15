export interface Provider {
  id: string;
  name: string;
  type: 'xtream' | 'm3u';
  serverUrl?: string;
  username?: string;
  password?: string;
  m3uUrl?: string;
}

export interface Channel {
  id: string;
  num: number;
  name: string;
  cat: string;
  now: string;
  streamUrl: string;
  logoUrl?: string;
}

export interface Title {
  id: string;
  title: string;
  year: number;
  seasons: string;
  genres: string[];
  synopsis: string;
  streamUrl: string;
  logoUrl?: string;
  imdbRating?: string;
}

export interface Settings {
  accentColor: string;
}
