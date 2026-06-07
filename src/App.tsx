import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from './store/useStore';
import Auth from './components/Auth';
import Header from './components/Header';
import Billboard from './components/Billboard';
import Rail from './components/Rail';
import Player from './components/Player';
import DetailModal from './components/DetailModal';
import LiveGuide from './components/LiveGuide';
import Settings from './components/Settings';
import TweaksPanel from './components/TweaksPanel';
import Poster, { ChannelCard } from './components/Poster';
import { DEMO_RAILS } from './data';
import { setOsApiKey } from './api/opensubtitles';
import type { Channel, Title, Rail as RailType } from './types';

// Split titles into movies vs series by their `seasons` label.
function isMovie(t: Title): boolean {
  const s = (t.seasons || '').toLowerCase();
  return s === 'movie' || s === 'film' || s.includes('part') || s.includes('limited');
}

// Language detection from category/title prefixes (IPTV providers tag these).
const NON_EN_RE = /(^|[\s|_\-\[(])(IN|HINDI|DESI|TAMIL|TELUGU|PUNJABI|MALAYALAM|KANNADA|MARATHI|BANGLA|BENGALI|URDU|PAK|PAKISTANI|ARABIC|AR|TURK(ISH)?|TR|FR|FRENCH|ES|SPANISH|LATINO|DE|GERMAN|IT|ITALIAN|PT|PORTUG\w*|RUSSIAN|RU|FILIPINO|TAGALOG|VIET\w*|THAI|INDO\w*|ID|NL|DUTCH|POLISH|PL|RO|ROMANIAN|GR|GREEK|FA|PERSIAN|AFGHAN|KURD\w*|NORDIC|SWEDISH|NORWEG\w*|DANISH|FINNISH|CZECH|HUNGAR\w*|ALBANIAN|EX-YU|EXYU|BalkAN)([\s|_\-\])]|$)/i;
const EN_RE = /(^|[\s|_\-\[(])(EN|ENG|ENGLISH|US|USA|UK|GB|AU|CA|IE|NZ)([\s|_\-\])]|$)/i;

function isEnglishTitle(t: Title): boolean {
  const s = `${t.title} ${(t.genres || []).join(' ')}`;
  if (EN_RE.test(s)) return true;       // explicitly tagged English
  if (NON_EN_RE.test(s)) return false;  // tagged another language
  return true;                          // untagged → assume English
}

// Strip leading language/quality tags from a category for cleaner rail titles.
function cleanGenre(g: string): string {
  return g.replace(/^(4K[\s\-|]*)?(EN|ENG|ENGLISH|US|USA|UK|IN|VIP|HD|FHD|UHD)[\s\-|]+/i, '').trim() || g;
}

// Xtream genres are often long nested paths like
// "Action & Adventure / Animación / Comedia / Sci-Fi & Fantasy".
// Break them into clean, individual English-ish genre tokens for the menu.
const GENRE_ALIASES: Record<string, string> = {
  'animación': 'Animation', 'animatie': 'Animation', 'comedia': 'Comedy', 'komedie': 'Comedy',
  'comédie': 'Comedy', 'misterio': 'Mystery', 'familie': 'Family', 'familia': 'Family',
  'science-fiction & fantastique': 'Sci-Fi & Fantasy', 'sci-fi & fantasy': 'Sci-Fi & Fantasy',
  'action & adventure': 'Action & Adventure', 'action': 'Action', 'drama': 'Drama',
  'kids': 'Kids', 'family': 'Family',
};
function splitGenreTokens(g: string): string[] {
  return g.split(/[\/|]/).map((p) => {
    const t = p.trim();
    const alias = GENRE_ALIASES[t.toLowerCase()];
    return alias || t;
  }).filter((t) => t && t.length > 1 && t.length < 26 && !/^\d|UA\s?\d|TV-|game show/i.test(t));
}

// Group a title list into genre rails for an organized tab layout.
function buildGenreRails(list: Title[], suffix: string): RailType[] {
  const rails: RailType[] = [];
  // Big "All" rail first so users see lots of titles immediately.
  if (list.length) rails.push({ id: suffix + '-all', title: `All ${suffix}`, kind: 'title', ids: list.slice(0, 60).map((t) => t.id) });
  // Then genre rails (sorted by size, up to 24 rails, 40 each).
  const counts = new Map<string, number>();
  list.forEach((t) => t.genres.forEach((g) => counts.set(g, (counts.get(g) || 0) + 1)));
  [...counts.keys()].sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0)).slice(0, 24).forEach((g) => {
    const ids = list.filter((t) => t.genres.includes(g)).slice(0, 40).map((t) => t.id);
    if (ids.length) rails.push({ id: `${suffix}-${g}`, title: cleanGenre(g), kind: 'title', ids });
  });
  return rails;
}

export default function App() {
  const provider = useStore((s) => s.provider);
  const channels = useStore((s) => s.channels);
  const titles = useStore((s) => s.titles);
  const setProvider = useStore((s) => s.setProvider);
  const settings = useStore((s) => s.settings);
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const activeCategory = useStore((s) => s.activeCategory);
  const setActiveCategory = useStore((s) => s.setActiveCategory);
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const searchOpen = useStore((s) => s.searchOpen);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const myList = useStore((s) => s.myList);

  const [playing, setPlaying] = useState<Channel | Title | null>(null);
  const [detail, setDetail] = useState<Channel | Title | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const titlesById = useMemo(() => Object.fromEntries(titles.map((t) => [t.id, t])), [titles]);
  const channelsById = useMemo(() => Object.fromEntries(channels.map((c) => [c.id, c])), [channels]);

  // Clean, de-duplicated, frequency-ranked genre tokens (top 30) — no giant paths.
  const categories = useMemo(() => {
    const count = new Map<string, number>();
    const src = provider?.type === 'demo' ? titles : titles.filter(isEnglishTitle);
    src.forEach((t) => t.genres.forEach((g) => splitGenreTokens(g).forEach((tok) => count.set(tok, (count.get(tok) || 0) + 1))));
    channels.forEach((c) => { if (c.cat) splitGenreTokens(cleanGenre(c.cat)).forEach((tok) => count.set(tok, (count.get(tok) || 0) + 1)); });
    return [...count.keys()].sort((a, b) => (count.get(b) || 0) - (count.get(a) || 0)).slice(0, 30).sort();
  }, [provider, titles, channels]);

  const reconnectProvider = useStore((s) => s.reconnectProvider);
  const reconnecting = useStore((s) => s.reconnecting);

  // Keep the OpenSubtitles API key in sync with settings.
  useEffect(() => { setOsApiKey(settings.openSubtitlesApiKey); }, [settings.openSubtitlesApiKey]);

  // On load: if a provider was persisted but its content is empty, re-fetch it.
  useEffect(() => {
    if (provider && channels.length === 0 && titles.length === 0 && !reconnecting) {
      if (provider.type === 'demo') setProvider(provider);
      else reconnectProvider(provider);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider?.id]);

  // English-first title pool (falls back to all if too few English are detected).
  const enTitles = useMemo<Title[]>(() => {
    const en = titles.filter(isEnglishTitle);
    return en.length >= 12 ? en : titles;
  }, [titles]);

  // Home billboard — rotates through top ENGLISH movies AND series with artwork.
  // Popular flagship titles (Dexter, Supernatural, etc.) are pinned to the front.
  const heroPool = useMemo<Title[]>(() => {
    const FEATURED = /\b(dexter|supernatural|breaking bad|the boys|game of thrones|stranger things|the last of us)\b/i;
    const withArt = enTitles.filter((t) => t.logoUrl);
    const pool = withArt.length >= 5 ? withArt : enTitles;
    const score = (t: Title) => (FEATURED.test(t.title) ? 100 : 0) + (t.logoUrl ? 10 : 0) + (t.match || 0) / 100;
    return [...pool].sort((a, b) => score(b) - score(a)).slice(0, 12);
  }, [enTitles]);

  const [heroIdx, setHeroIdx] = useState(0);
  useEffect(() => {
    if (heroPool.length < 2) return;
    const iv = setInterval(() => setHeroIdx((i) => (i + 1) % heroPool.length), 8000);
    return () => clearInterval(iv);
  }, [heroPool.length]);
  const homeHero = heroPool[heroIdx % Math.max(1, heroPool.length)] || null;

  // Home rails — VOD only (no live channels). Live TV lives in its own tab.
  const rails = useMemo<RailType[]>(() => {
    // Demo catalogue → curated rails, but strip out the live-channel rails.
    if (provider?.type === 'demo') return DEMO_RAILS.filter((r) => r.kind === 'title');

    const out: RailType[] = [];
    const movies = enTitles.filter(isMovie);
    const series = enTitles.filter((t) => !isMovie(t));

    // Top rails up front (more items per rail)
    if (movies.length) out.push({ id: 'movies-all', title: 'Movies', kind: 'title', ids: movies.slice(0, 40).map((m) => m.id) });
    if (series.length) out.push({ id: 'series-all', title: 'Series & Shows', kind: 'title', ids: series.slice(0, 40).map((s) => s.id) });

    // Movie rails by genre (sorted by size, up to 20), cleaned genre labels
    const mCount = new Map<string, number>();
    movies.forEach((m) => m.genres.forEach((g) => mCount.set(g, (mCount.get(g) || 0) + 1)));
    [...mCount.keys()].sort((a, b) => (mCount.get(b) || 0) - (mCount.get(a) || 0)).slice(0, 20).forEach((g) => {
      const ids = movies.filter((m) => m.genres.includes(g)).slice(0, 40).map((m) => m.id);
      if (ids.length) out.push({ id: 'movg-' + g, title: cleanGenre(g), kind: 'title', ids });
    });
    // Series rails by genre (up to 14)
    const sCount = new Map<string, number>();
    series.forEach((s) => s.genres.forEach((g) => sCount.set(g, (sCount.get(g) || 0) + 1)));
    [...sCount.keys()].sort((a, b) => (sCount.get(b) || 0) - (sCount.get(a) || 0)).slice(0, 14).forEach((g) => {
      const ids = series.filter((s) => s.genres.includes(g)).slice(0, 40).map((s) => s.id);
      if (ids.length) out.push({ id: 'serg-' + g, title: cleanGenre(g) + ' Series', kind: 'title', ids });
    });
    return out;
  }, [provider, channels, enTitles]);

  // Search results (channels first, then titles)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      // "Top Searches" — interleaved
      const a = titles.slice(0, 9);
      const b = channels.slice(0, 9);
      const out: Array<(Title | Channel) & { _type: 'title' | 'channel' }> = [];
      const n = Math.max(a.length, b.length);
      for (let i = 0; i < n; i++) {
        if (a[i]) out.push({ ...a[i], _type: 'title' });
        if (b[i]) out.push({ ...b[i], _type: 'channel' });
      }
      return out;
    }
    const chs = channels.filter((c) =>
      c.name.toLowerCase().includes(q) || (c.cat || '').toLowerCase().includes(q) || (c.now || '').toLowerCase().includes(q) || ('ch ' + c.num).includes(q)
    ).map((c) => ({ ...c, _type: 'channel' as const }));
    const tis = titles.filter((t) =>
      t.title.toLowerCase().includes(q) || t.genres.join(' ').toLowerCase().includes(q)
    ).map((t) => ({ ...t, _type: 'title' as const }));
    return [...chs, ...tis];
  }, [searchQuery, channels, titles]);

  const myListTitles = useMemo(() => myList.map((id) => titlesById[id]).filter(Boolean) as Title[], [myList, titlesById]);
  const categoryItems = useMemo(() => {
    if (!activeCategory) return { titles: [] as Title[], channels: [] as Channel[] };
    const cat = activeCategory.toLowerCase();
    const match = (s: string) => s.toLowerCase().includes(cat);
    return {
      titles: titles.filter((t) => t.genres.some(match)),
      channels: channels.filter((c) => c.cat && match(c.cat)),
    };
  }, [activeCategory, titles, channels]);

  if (!provider) return <Auth />;
  if (showSettings) return <Settings onBack={() => setShowSettings(false)} />;

  // Real provider still fetching its catalogue
  if (reconnecting && channels.length === 0 && titles.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#141414' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid #2a2a2a', borderTopColor: settings.accentColor, animation: 'spin 0.7s linear infinite', margin: '0 auto 20px' }} />
          <div style={{ fontSize: 16, color: '#b3b3b3' }}>Loading your channels & titles…</div>
        </div>
      </div>
    );
  }

  const accent = settings.accentColor;

  return (
    <>
      {/* Keep accent synced to CSS var — global.css handles everything else */}
      <style>{`:root { --accent: ${accent}; --shift-accent: ${accent}; --shift-accent-hover: color-mix(in srgb, ${accent} 85%, #fff); }`}</style>

      {/* Player overlay */}
      {playing && (
        <Player item={playing} channels={channels} onClose={() => setPlaying(null)} />
      )}

      {/* Detail modal */}
      {detail && !playing && (
        <DetailModal item={detail} onClose={() => setDetail(null)} onPlay={(item) => { setDetail(null); setPlaying(item); }} />
      )}

      {/* Main app */}
      <div id="app-scroll" style={{ height: '100vh', overflowY: 'auto', background: '#141414', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <Header
          provider={provider}
          tab={tab}
          onNav={(t) => { setTab(t); setActiveCategory(null); setSearchOpen(false); setSearchQuery(''); }}
          onSignOut={() => setProvider(null)}
          onSettings={() => setShowSettings(true)}
          categories={categories}
          activeCategory={activeCategory}
          onCategory={(c) => { setActiveCategory(c); setSearchOpen(false); setSearchQuery(''); }}
          searchOpen={searchOpen}
          query={searchQuery}
          onQuery={setSearchQuery}
          onOpenSearch={() => { setSearchOpen(true); setActiveCategory(null); }}
          onCloseSearch={() => { setSearchOpen(false); setSearchQuery(''); }}
        />

        {/* SEARCH */}
        {searchOpen && (
          <div style={{ minHeight: '100vh', padding: '24px 48px 80px', background: '#141414' }}>
            {searchQuery.trim() && searchResults.length === 0 ? (
              <div style={{ paddingTop: 24, maxWidth: 640 }}>
                <p style={{ fontSize: 18, color: '#fff', margin: '0 0 8px' }}>
                  Your search for "{searchQuery}" did not have any matches.
                </p>
                <p style={{ color: '#b3b3b3', fontSize: 15, margin: 0 }}>
                  Try a different title, channel name or genre — like "drama", "sports" or "news".
                </p>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: 17, fontWeight: 500, color: '#e5e5e5', margin: '0 0 18px' }}>
                  {searchQuery.trim()
                    ? <React.Fragment>Results for "<span style={{ color: '#fff', fontWeight: 700 }}>{searchQuery}</span>"</React.Fragment>
                    : 'Top Searches'}
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {searchResults.slice(0, 60).map((it, i) =>
                    it._type === 'channel'
                      ? <ChannelCard key={it.id + i} channel={it as Channel} onPlay={(c) => setPlaying(c)} onOpen={(c) => setDetail(c)} />
                      : <Poster key={it.id + i} title={it as Title} idx={i} onPlay={setPlaying} onOpen={setDetail} />
                  )}
                </div>
                {searchResults.length > 60 && (
                  <p style={{ color: '#666', fontSize: 13, marginTop: 16 }}>Showing 60 of {searchResults.length} — refine your search to narrow it down.</p>
                )}
              </>
            )}
          </div>
        )}

        {/* CATEGORY browse */}
        {!searchOpen && activeCategory && (
          <div style={{ padding: '24px 48px', minHeight: '100vh' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 28 }}>
              <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>{activeCategory}</h1>
              <span style={{ fontSize: 14, color: '#8a8a8a' }}>{categoryItems.titles.length + categoryItems.channels.length} results</span>
            </div>
            {categoryItems.channels.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: '#8a8a8a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Live Channels</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {categoryItems.channels.slice(0, 60).map((c) => <ChannelCard key={c.id} channel={c} onPlay={setPlaying} onOpen={setDetail} />)}
                </div>
              </div>
            )}
            {categoryItems.titles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {categoryItems.titles.slice(0, 60).map((t, i) => <Poster key={t.id} title={t} idx={i} onPlay={setPlaying} onOpen={setDetail} />)}
              </div>
            )}
          </div>
        )}

        {/* LIVE TV GUIDE */}
        {!searchOpen && !activeCategory && tab === 'live' && (
          <LiveGuide channels={channels} onPlay={setPlaying} accentColor={accent} />
        )}

        {/* MY LIST */}
        {!searchOpen && !activeCategory && tab === 'mylist' && (
          <div style={{ padding: '24px 48px', minHeight: '100vh' }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 24 }}>My List</h1>
            {myListTitles.length === 0
              ? <p style={{ color: '#8a8a8a', fontSize: 16 }}>Add titles to your list using the + button on any card.</p>
              : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {myListTitles.map((t, i) => <Poster key={t.id} title={t} idx={i} onPlay={setPlaying} onOpen={setDetail} />)}
                </div>
            }
          </div>
        )}

        {/* MOVIES / SERIES — billboard + rails / full grid (English-first) */}
        {!searchOpen && !activeCategory && (tab === 'movies' || tab === 'series') && (
          <TitleTab
            kind={tab as 'movies' | 'series'}
            list={enTitles.filter((t) => tab === 'movies' ? isMovie(t) : !isMovie(t))}
            allList={titles.filter((t) => tab === 'movies' ? isMovie(t) : !isMovie(t))}
            channels={channels} titles={titles} titlesById={titlesById} channelsById={channelsById}
            settings={settings} accent={accent} onPlay={setPlaying} onOpen={setDetail}
          />
        )}

        {/* HOME — VOD only (no Live TV); billboard features a movie/series */}
        {!searchOpen && !activeCategory && tab === 'home' && (
          <>
            {homeHero && (
              <Billboard channel={null as any} bbStyle={settings.bbStyle} channels={channels} titles={titles}
                vodHero={homeHero} heroKind={isMovie(homeHero) ? 'Film' : 'Series'}
                onPlay={setPlaying} onOpen={setDetail} accentColor={accent} />
            )}
            <div style={{ paddingTop: homeHero ? 130 : 24 }}>
              {rails.length === 0 && (
                <p style={{ color: '#8a8a8a', fontSize: 16, padding: '0 48px' }}>
                  No movies or series in this provider yet. Check the <strong>Live TV</strong> tab for channels.
                </p>
              )}
              {rails.map((rail, i) => (
                <LazyRail key={rail.id} index={i}><Rail rail={rail} titlesById={titlesById} channelsById={channelsById} onPlay={setPlaying} onOpen={setDetail} /></LazyRail>
              ))}
            </div>
          </>
        )}

        <div style={{ height: 60 }} />
      </div>

      <TweaksPanel />
    </>
  );
}

// Lazy-mounts its children when scrolled near the viewport. Keeps Home/Movies
// responsive even with dozens of rails (hundreds of cards) on big Xtream lines.
// The first `eager` rails mount immediately; the rest mount on scroll, with a
// staggered fallback timer so nothing ever stays blank if IntersectionObserver
// doesn't fire.
function LazyRail({ children, index = 0 }: { children: React.ReactNode; index?: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(index < 5);
  useEffect(() => {
    if (show) return;
    const el = ref.current;
    const root = document.getElementById('app-scroll');
    let io: IntersectionObserver | null = null;
    if (el && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { setShow(true); io?.disconnect(); }
      }, { root, rootMargin: '800px 0px' });
      io.observe(el);
    }
    // Fallback: reveal after a staggered delay even if IO never fires.
    const t = setTimeout(() => setShow(true), 400 + index * 120);
    return () => { io?.disconnect(); clearTimeout(t); };
  }, [show, index]);
  return <div ref={ref} style={{ minHeight: show ? undefined : 240 }}>{show ? children : null}</div>;
}

// Movies / Series tab: billboard + a "Rails" browse view and an "All" paginated
// grid so the user can page through the ENTIRE catalogue (not just capped rails).
function TitleTab({ kind, list, allList, channels, titles, titlesById, channelsById, settings, accent, onPlay, onOpen }: {
  kind: 'movies' | 'series';
  list: Title[];          // English-first
  allList: Title[];       // everything of this kind
  channels: Channel[];
  titles: Title[];
  titlesById: Record<string, Title>;
  channelsById: Record<string, Channel>;
  settings: any;
  accent: string;
  onPlay: (t: Title | Channel) => void;
  onOpen: (t: Title | Channel) => void;
}) {
  const [view, setView] = useState<'rails' | 'all'>('rails');
  const [shown, setShown] = useState(60);
  const hero = useMemo(() => [...list].sort((a, b) => ((b.logoUrl ? 1 : 0) - (a.logoUrl ? 1 : 0)) || (b.match || 0) - (a.match || 0))[0], [list]);
  const genreRails = useMemo(() => buildGenreRails(list, kind === 'movies' ? 'Movies' : 'Series'), [list, kind]);
  const label = kind === 'movies' ? 'Movies' : 'Series';

  const Toggle = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px 12px', flexWrap: 'wrap', gap: 12 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>{label} <span style={{ fontSize: 16, color: '#666', fontWeight: 600 }}>({allList.length.toLocaleString()})</span></h1>
      <div style={{ display: 'flex', gap: 4, background: '#1a1a1a', padding: 4, borderRadius: 8 }}>
        {(['rails', 'all'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} style={{ padding: '7px 16px', border: 0, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, background: view === v ? accent : 'transparent', color: view === v ? '#fff' : '#b3b3b3' }}>
            {v === 'rails' ? 'Browse' : `All ${label}`}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {hero && (
        <Billboard channel={null as any} bbStyle={settings.bbStyle} channels={channels} titles={titles}
          vodHero={hero} heroKind={kind === 'movies' ? 'Film' : 'Series'} onPlay={onPlay} onOpen={onOpen} accentColor={accent} />
      )}
      <div style={{ paddingTop: hero ? 130 : 24 }}>
        {Toggle}
        {allList.length === 0 && <p style={{ color: '#8a8a8a', fontSize: 16, padding: '0 48px' }}>No {label.toLowerCase()} in this provider's catalogue.</p>}

        {view === 'rails' && genreRails.map((rail, i) => (
          <LazyRail key={rail.id} index={i}><Rail rail={rail} titlesById={titlesById} channelsById={channelsById} onPlay={onPlay} onOpen={onOpen} /></LazyRail>
        ))}

        {view === 'all' && (
          <div style={{ padding: '0 48px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {allList.slice(0, shown).map((t, i) => <Poster key={t.id} title={t} idx={i} onPlay={onPlay} onOpen={onOpen} />)}
            </div>
            {shown < allList.length && (
              <div style={{ textAlign: 'center', padding: '28px 0 8px' }}>
                <button onClick={() => setShown((s) => s + 60)} style={{ background: '#1f1f1f', border: '1px solid #383838', color: '#fff', borderRadius: 6, padding: '11px 26px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Load more ({(allList.length - shown).toLocaleString()} left)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

