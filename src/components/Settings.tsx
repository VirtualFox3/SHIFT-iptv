import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import type { Settings as SettingsType } from '../types';
import { osLogin, osLogout, setOsApiKey } from '../api/opensubtitles';
import { traktGetDeviceCode, traktPollToken, traktGetProfile } from '../api/trakt';
import * as Icons from './Icons';

function OpenSubtitlesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="5" fill="#1B73C4"/>
      <text x="16" y="21" textAnchor="middle" fill="white" fontSize="13" fontWeight="800" fontFamily="Inter,sans-serif">OS</text>
    </svg>
  );
}
function TraktIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="5" fill="#E54B2E"/>
      <text x="16" y="21" textAnchor="middle" fill="white" fontSize="14" fontWeight="900" fontFamily="Inter,sans-serif">T</text>
    </svg>
  );
}

const NAV = [
  ['account', 'Account'],
  ['playback', 'Playback'],
  ['quality', 'Streaming Quality'],
  ['subtitles', 'Subtitles & Audio'],
  ['integrations', 'Integrations'],
  ['tweaks', 'Tweaks'],
  ['parental', 'Parental Controls'],
] as const;

interface SettingsProps { onBack: () => void; }

export default function Settings({ onBack }: SettingsProps) {
  const [pane, setPane] = useState<string>('account');
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const clearHistory = useStore((s) => s.clearHistory);
  const provider = useStore((s) => s.provider);

  const set = (k: keyof SettingsType, v: any) => updateSettings({ [k]: v });

  return (
    <div style={{ minHeight: '100vh', padding: '80px 48px', background: 'var(--bg-page)', color: 'var(--fg-1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: 0, color: 'var(--fg-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, padding: 0 }}>
          <Icons.ChevronLeft size={18} /> Back
        </button>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, color: 'var(--fg-1)' }}>Settings</h1>
      </div>

      <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start', maxWidth: 1060 }}>
        {/* Sidebar nav */}
        <nav style={{ position: 'sticky', top: 80, width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(([k, label]) => (
            <button key={k} onClick={() => setPane(k)} style={{
              textAlign: 'left', padding: '11px 14px', borderRadius: 6, border: 0, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, fontWeight: pane === k ? 700 : 500,
              background: pane === k ? 'var(--bg-input)' : 'transparent',
              color: pane === k ? 'var(--fg-1)' : 'var(--fg-3)', transition: 'background 140ms',
            }}
              onMouseEnter={(e) => { if (pane !== k) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { if (pane !== k) e.currentTarget.style.background = 'transparent'; }}>
              {label}
            </button>
          ))}
        </nav>

        {/* Pane content */}
        <div style={{ flex: 1, minWidth: 0, maxWidth: 660 }}>
          {pane === 'account' && <AccountPane provider={provider} />}
          {pane === 'playback' && <PlaybackPane settings={settings} set={set} />}
          {pane === 'quality' && <QualityPane settings={settings} set={set} />}
          {pane === 'subtitles' && <SubtitlesPane settings={settings} set={set} />}
          {pane === 'integrations' && <IntegrationsPane settings={settings} updateSettings={updateSettings} />}
          {pane === 'tweaks' && <TweaksPane settings={settings} set={set} clearHistory={clearHistory} />}
          {pane === 'parental' && <ParentalPane settings={settings} set={set} />}
        </div>
      </div>
    </div>
  );
}

/* ─── Layout helpers ─── */
function Card({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-4)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>{title}</h2>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

function Row({ icon, title, desc, control, last }: { icon?: React.ReactNode; title: string; desc?: string; control: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderTop: last ? 0 : '1px solid var(--border)' }}>
      {icon && <span style={{ color: 'var(--fg-3)', flexShrink: 0, width: 20, display: 'grid', placeItems: 'center' }}>{icon}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--fg-1)' }}>{title}</div>
        {desc && <div style={{ fontSize: 12.5, color: 'var(--fg-3)', marginTop: 3, lineHeight: 1.4 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} style={{ width: 46, height: 26, borderRadius: 999, border: 0, cursor: 'pointer', padding: 0, flexShrink: 0, background: on ? 'var(--accent,#E50914)' : 'var(--bg-input)', position: 'relative', transition: 'background 180ms' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 180ms', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
    </button>
  );
}

function Seg({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--bg-input)', borderRadius: 6, padding: 3, gap: 2 }}>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} style={{ padding: '6px 12px', borderRadius: 4, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, background: value === o ? 'var(--fg-1)' : 'transparent', color: value === o ? 'var(--bg-page)' : 'var(--fg-3)', transition: 'all 140ms' }}>{o}</button>
      ))}
    </div>
  );
}

// Native <select> — renders above any overflow:hidden ancestor (the custom
// popover version was being clipped by the Card).
function Picker({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
          padding: '8px 34px 8px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
          background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--fg-1)', fontSize: 13.5, fontWeight: 600,
          minWidth: 150, outline: 'none',
        }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <span style={{ position: 'absolute', right: 12, pointerEvents: 'none', display: 'inline-flex', color: 'var(--fg-3)' }}>
        <Icons.ChevronDown size={14} />
      </span>
    </div>
  );
}

const PROFILE_GRADS = [
  'linear-gradient(135deg,#6e1015,#E50914)',
  'linear-gradient(135deg,#11324f,#14B8A6)',
  'linear-gradient(135deg,#2a1659,#6E3FF3)',
  'linear-gradient(135deg,#0a3b2a,#46D369)',
  'linear-gradient(135deg,#3a1206,#F5A623)',
  'linear-gradient(135deg,#1a1a4e,#2E51A2)',
  'linear-gradient(135deg,#3d0d3a,#c2369d)',
  'linear-gradient(135deg,#0b1f3a,#1f4e88)',
];

/* ─── Panes ─── */
function AccountPane({ provider }: { provider: any }) {
  const setProviderStore = useStore((s) => s.setProvider);
  const saveProvider = useStore((s) => s.saveProvider);
  const fileRef = React.useRef<HTMLInputElement>(null);
  if (!provider) return <p style={{ color: 'var(--ink-5)' }}>Not connected.</p>;

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const updated = { ...provider, profileImage: dataUrl };
      saveProvider(updated);
      setProviderStore(updated);
    };
    reader.readAsDataURL(file);
  }

  function changeGradient(grad: string) {
    const updated = { ...provider, bg: grad };
    saveProvider(updated);
    setProviderStore(updated);
  }

  return (
    <>
    <Card title="Profile">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 20px 12px' }}>
        {/* Avatar — click to upload a custom picture */}
        <div onClick={() => fileRef.current?.click()} title="Change profile picture"
          style={{ position: 'relative', width: 64, height: 64, borderRadius: 12, background: provider.bg, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 26, flexShrink: 0, cursor: 'pointer', overflow: 'hidden' }}>
          {provider.profileImage
            ? <img src={provider.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : provider.letter}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', opacity: 0, transition: 'opacity 150ms' }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}>
            <Icons.Camera size={22} />
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickImage} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{provider.name}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-5)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#46D369', boxShadow: '0 0 6px #46D369' }} />
            Connected · {provider.tag}
          </div>
          <button onClick={() => fileRef.current?.click()} style={{ marginTop: 8, background: 'transparent', border: 0, color: 'var(--accent,#E50914)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            Change photo
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <button onClick={() => setProviderStore(null)} style={{ padding: '10px 18px', borderRadius: 4, border: '1px solid #444', background: 'transparent', color: 'var(--ink-1)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <Icons.Grid size={14} />Manage providers
          </button>
          <button onClick={() => setProviderStore(null)} style={{ padding: '10px 18px', borderRadius: 4, border: '1px solid #444', background: 'transparent', color: 'var(--ink-1)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <Icons.LogOut size={14} />Switch / disconnect
          </button>
        </div>
      </div>
      {/* Profile color picker */}
      {!provider.profileImage && (
        <div style={{ padding: '0 20px 18px' }}>
          <div style={{ fontSize: 11, color: 'var(--fg-4)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Profile Color</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PROFILE_GRADS.map((g) => (
              <button key={g} onClick={() => changeGradient(g)}
                style={{ width: 32, height: 32, borderRadius: 8, background: g, border: provider.bg === g ? '2.5px solid #fff' : '2px solid transparent', cursor: 'pointer', outline: 'none', transition: 'transform 120ms, border 100ms', transform: provider.bg === g ? 'scale(1.18)' : 'scale(1)' }} />
            ))}
          </div>
        </div>
      )}
    </Card>
    <ConnectionDetails provider={provider} />
    </>
  );
}

// Connection details — the user's actual IPTV credentials (with reveal).
function ConnectionDetails({ provider }: { provider: any }) {
  const [reveal, setReveal] = useState(false);
  const rows: [string, string][] = [];
  if (provider.type === 'xtream') {
    rows.push(['Type', 'Xtream Codes']);
    if (provider.serverUrl) rows.push(['Server URL', provider.serverUrl]);
    if (provider.username) rows.push(['Username', provider.username]);
    if (provider.password) rows.push(['Password', reveal ? provider.password : '•'.repeat(Math.min(provider.password.length, 12))]);
  } else if (provider.type === 'm3u') {
    rows.push(['Type', 'M3U Playlist']);
    if (provider.m3uUrl) rows.push(['Playlist URL', reveal ? provider.m3uUrl : maskUrl(provider.m3uUrl)]);
  } else {
    rows.push(['Type', 'Demo catalogue']);
  }
  rows.push(['Channels', String(provider.channels ?? '—')]);

  function copyAll() {
    const txt = rows.map(([k, v]) => `${k}: ${k === 'Password' ? provider.password : k === 'Playlist URL' ? provider.m3uUrl : v}`).join('\n');
    navigator.clipboard.writeText(txt).catch(() => {});
  }

  return (
    <Card title="Connection details">
      <div style={{ padding: '8px 0' }}>
        {rows.map(([k, v], i) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderTop: i ? '1px solid var(--hair-1)' : 0 }}>
            <span style={{ fontSize: 13.5, color: 'var(--ink-5)', width: 110, flexShrink: 0 }}>{k}</span>
            <span style={{ fontSize: 13.5, color: 'var(--ink-2)', flex: 1, minWidth: 0, fontFamily: (k === 'Server URL' || k === 'Password' || k === 'Playlist URL') ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{v}</span>
          </div>
        ))}
        {provider.type !== 'demo' && (
          <div style={{ display: 'flex', gap: 8, padding: '14px 20px 6px' }}>
            <button onClick={() => setReveal((r) => !r)} style={outlineBtn}>
              {reveal ? <Icons.EyeOff size={14} /> : <Icons.Eye size={14} />}{reveal ? 'Hide' : 'Reveal'}
            </button>
            <button onClick={copyAll} style={outlineBtn}><Icons.Copy size={14} />Copy details</button>
          </div>
        )}
      </div>
    </Card>
  );
}
function maskUrl(u: string): string {
  return u.length > 24 ? u.slice(0, 18) + '••••••' + u.slice(-4) : '••••••••';
}

function PlaybackPane({ settings, set }: { settings: SettingsType; set: any }) {
  return (
    <Card title="Playback">
      <Row icon={<Icons.Play size={17} />} title="Autoplay next episode" desc="Play the next episode automatically." control={<Toggle on={settings.autoplayNext} onChange={(v) => set('autoplayNext', v)} />} />
      <Row icon={<Icons.Tv size={17} />} title="Autoplay previews" desc="Play previews while browsing." control={<Toggle on={settings.autoplayPreviews} onChange={(v) => set('autoplayPreviews', v)} />} />
      <Row icon={<Icons.ChevronRight size={17} />} title="Skip intros automatically" desc="Jump past recaps and title sequences." control={<Toggle on={settings.skipIntros} onChange={(v) => set('skipIntros', v)} />} last />
    </Card>
  );
}

function QualityPane({ settings, set }: { settings: SettingsType; set: any }) {
  return (
    <>
      <Card title="Streaming Quality">
        <Row icon={<Icons.Grid size={17} />} title="Video quality" desc="Higher uses more data." control={<Seg value={settings.quality} options={['Auto', 'Low', 'Standard', 'High']} onChange={(v) => set('quality', v)} />} />
        <Row icon={<Icons.Download size={17} />} title="Data saver" desc="Reduce data on mobile networks." control={<Toggle on={settings.dataSaver} onChange={(v) => set('dataSaver', v)} />} last />
      </Card>
    </>
  );
}

function SubtitlesPane({ settings, set }: { settings: SettingsType; set: any }) {
  const langs = ['English', 'Español', 'Français', 'Deutsch', 'Italian', 'Off'];
  return (
    <Card title="Subtitles & Audio">
      <Row icon={<Icons.Subtitles size={17} />} title="Enable subtitles" desc="Show subtitles when available." control={<Toggle on={settings.subEnabled} onChange={(v) => set('subEnabled', v)} />} />
      <Row icon={<Icons.Globe size={17} />} title="Subtitle language" control={<Picker value={settings.subLang} options={langs} onChange={(v) => set('subLang', v)} />} />
      <Row icon={<Icons.Volume size={17} />} title="Audio language" control={<Picker value={settings.audioLang} options={['English', 'Español', 'Français', 'Deutsch']} onChange={(v) => set('audioLang', v)} />} />
      <Row icon={<Icons.Pencil size={17} />} title="Subtitle size" control={<Seg value={settings.subSize} options={['Small', 'Medium', 'Large']} onChange={(v) => set('subSize', v as any)} />} last />
    </Card>
  );
}

function IntegrationsPane({ settings, updateSettings }: { settings: SettingsType; updateSettings: any }) {
  return (
    <>
      <OpenSubtitlesSection settings={settings} updateSettings={updateSettings} />
      <TraktSection settings={settings} updateSettings={updateSettings} />
      <TmdbSection settings={settings} updateSettings={updateSettings} />
    </>
  );
}

function TmdbIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="5" fill="#01B4E4"/>
      <text x="16" y="21" textAnchor="middle" fill="white" fontSize="11" fontWeight="900" fontFamily="Inter,sans-serif">TMDB</text>
    </svg>
  );
}

// TMDB — supplies proper horizontal (16:9) backdrop art for the home billboard
// when the provider's own catalogue only has a vertical poster (like UHF).
function TmdbSection({ settings, updateSettings }: { settings: SettingsType; updateSettings: any }) {
  const [key, setKey] = useState(settings.tmdbApiKey || '');
  const [showForm, setShowForm] = useState(false);
  const saved = !!settings.tmdbApiKey;

  function save() {
    updateSettings({ tmdbApiKey: key.trim() || undefined });
    setShowForm(false);
  }
  function clear() {
    updateSettings({ tmdbApiKey: undefined });
    setKey('');
  }

  return (
    <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TmdbIcon />The Movie Database</span>}>
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: saved ? '#46D369' : '#8a8a8a', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: saved ? '#46D369' : '#555' }} />
          {saved ? 'Connected' : 'Not connected'}
        </div>
        <p style={{ fontSize: 13, color: '#8a8a8a', margin: '0 0 14px', lineHeight: 1.5 }}>
          Fetches proper widescreen hero art for movies & series whenever your provider doesn't supply one — free API key from{' '}
          <button onClick={() => window.open('https://www.themoviedb.org/settings/api', '_blank', 'noopener')} style={{ background: 'transparent', border: 0, color: 'var(--accent,#E50914)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: 0, textDecoration: 'underline' }}>themoviedb.org → API</button>.
        </p>

        {saved && !showForm ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowForm(true)} style={outlineBtn}>Change key</button>
            <button onClick={clear} style={outlineBtn}>Remove</button>
          </div>
        ) : showForm || !saved ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 340 }}>
            <input style={inp} placeholder="TMDB API key (v3 auth)" value={key} onChange={(e) => setKey(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={save} style={primaryBtn}>Save</button>
              {showForm && <button onClick={() => { setShowForm(false); setKey(settings.tmdbApiKey || ''); }} style={outlineBtn}>Cancel</button>}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

// OpenSubtitles — UHF-style: sign in with your OpenSubtitles account + a free
// API key (register a consumer at opensubtitles.com → API). Subtitles also work
// keyless via Wyzie/strem, so this is optional for higher quota & better matches.
function OpenSubtitlesSection({ settings, updateSettings }: { settings: SettingsType; updateSettings: any }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [apiKey, setApiKey] = useState(settings.openSubtitlesApiKey || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  async function login() {
    if (!user || !pass) { setError('Enter your OpenSubtitles username and password.'); return; }
    if (!apiKey.trim()) { setError('Enter your OpenSubtitles API key (free — register a consumer at opensubtitles.com).'); return; }
    setLoading(true); setError('');
    try {
      setOsApiKey(apiKey.trim());
      const token = await osLogin(user, pass);
      updateSettings({ openSubtitlesToken: token, openSubtitlesUsername: user, openSubtitlesApiKey: apiKey.trim() });
      setShowForm(false); setUser(''); setPass('');
    } catch (e: any) {
      setError(e.message || 'Login failed — check your account and API key.');
    } finally { setLoading(false); }
  }

  async function logout() {
    if (settings.openSubtitlesToken) await osLogout(settings.openSubtitlesToken);
    updateSettings({ openSubtitlesToken: undefined, openSubtitlesUsername: undefined });
  }

  return (
    <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><OpenSubtitlesIcon />OpenSubtitles</span>}>
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#46D369', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#46D369', boxShadow: '0 0 6px #46D369' }} />
          {settings.openSubtitlesToken ? `Signed in as ${settings.openSubtitlesUsername}` : 'Subtitles active (keyless)'}
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-5)', margin: '0 0 14px', lineHeight: 1.5 }}>
          Subtitles work automatically with no setup. To use your full <strong style={{ color: 'var(--ink-4)' }}>opensubtitles.com</strong> account (like UHF), sign in below — enter your account plus a free API key from{' '}
          <button onClick={() => window.open('https://www.opensubtitles.com/en/consumers', '_blank', 'noopener')} style={{ background: 'transparent', border: 0, color: 'var(--accent,#E50914)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: 0, textDecoration: 'underline' }}>opensubtitles.com → API</button>.
        </p>

        {settings.openSubtitlesToken ? (
          <button onClick={logout} style={outlineBtn}>Sign out</button>
        ) : showForm ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 340 }}>
            <input style={inp} placeholder="OpenSubtitles username" value={user} onChange={(e) => setUser(e.target.value)} />
            <input style={inp} placeholder="Password" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
            <input style={inp} placeholder="API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            {error && <p style={{ color: '#E50914', fontSize: 13, margin: 0 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={login} disabled={loading} style={primaryBtn}>{loading ? 'Signing in…' : 'Sign in'}</button>
              <button onClick={() => { setShowForm(false); setError(''); }} style={outlineBtn}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowForm(true)} style={outlineBtn}>Sign in to OpenSubtitles</button>
        )}
      </div>
    </Card>
  );
}

function TraktSection({ settings, updateSettings }: { settings: SettingsType; updateSettings: any }) {
  const [step, setStep] = useState<'idle' | 'polling' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [code, setCode] = useState<{ user_code: string; verification_url: string; device_code: string; interval: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  async function startLogin() {
    try {
      const data = await traktGetDeviceCode();
      setCode(data);
      setStep('polling');
      // Open the Trakt activation page in a new tab and pre-copy the code.
      try { navigator.clipboard.writeText(data.user_code); } catch {}
      window.open(data.verification_url || 'https://trakt.tv/activate', '_blank', 'noopener');
      pollRef.current = setInterval(async () => {
        try {
          const tokens = await traktPollToken(data.device_code, settings.traktClientSecret);
          if (tokens) {
            clearInterval(pollRef.current!);
            const profile = await traktGetProfile(tokens.access_token);
            updateSettings({ traktAccessToken: tokens.access_token, traktRefreshToken: tokens.refresh_token, traktUsername: profile.username });
            setStep('idle'); setCode(null);
          }
        } catch (e: any) {
          clearInterval(pollRef.current!);
          setErrorMsg(e?.message || 'Authentication failed.');
          setStep('error');
        }
      }, (data.interval + 1) * 1000);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Authentication failed.');
      setStep('error');
    }
  }

  function logout() {
    if (pollRef.current) clearInterval(pollRef.current);
    updateSettings({ traktAccessToken: undefined, traktRefreshToken: undefined, traktUsername: undefined });
    setStep('idle'); setCode(null);
  }

  function copyCode() {
    if (code) { navigator.clipboard.writeText(code.user_code); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }

  React.useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  return (
    <Card title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TraktIcon />Trakt</span>}>
      {settings.traktAccessToken ? (
        <div style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#E54B2E', display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#E54B2E', boxShadow: '0 0 6px #E54B2E' }} />
              Connected as @{settings.traktUsername}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-5)', marginTop: 4 }}>Watch history synced · ratings enabled</div>
          </div>
          <button onClick={logout} style={outlineBtn}>Disconnect</button>
        </div>
      ) : step === 'polling' && code ? (
        <div style={{ padding: 20 }}>
          <p style={{ fontSize: 13.5, color: 'var(--ink-4)', margin: '0 0 16px' }}>
            1. Go to <strong style={{ color: 'var(--ink-1)' }}>{code.verification_url}</strong><br />
            2. Enter the code below:
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 900, letterSpacing: '0.25em', color: 'var(--ink-1)', background: 'var(--surface-3)', padding: '12px 24px', borderRadius: 8 }}>{code.user_code}</div>
            <button onClick={copyCode} style={outlineBtn}>{copied ? '✓ Copied' : <><Icons.Copy size={14} /> Copy</>}</button>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-5)', marginTop: 12 }}>The Trakt activation page opened in a new tab and the code is copied. Waiting for authorization…</p>
        </div>
      ) : (
        <div style={{ padding: 20 }}>
          <p style={{ fontSize: 13.5, color: 'var(--ink-5)', margin: '0 0 16px' }}>Connect Trakt to sync your watch history and get personalized ratings.</p>
          {step === 'error' && <p style={{ color: '#E50914', fontSize: 13, marginBottom: 12 }}>{errorMsg || 'Authentication failed.'} Try again.</p>}
          <input
            type="password"
            placeholder="Trakt Client Secret (from trakt.tv/oauth/applications)"
            defaultValue={settings.traktClientSecret || ''}
            onChange={(e) => updateSettings({ traktClientSecret: e.target.value.trim() || undefined })}
            style={{ width: '100%', maxWidth: 420, boxSizing: 'border-box', padding: '10px 12px', marginBottom: 12, borderRadius: 6, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--ink-1)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
          />
          <p style={{ fontSize: 11.5, color: 'var(--ink-5)', margin: '0 0 14px', lineHeight: 1.45 }}>
            Paste your Trakt app's Client Secret here (kept only in this browser) — needed once to authorize. It's the secret paired with the app's Client ID.
          </p>
          <button onClick={startLogin} style={primaryBtn}>Connect Trakt</button>
        </div>
      )}
    </Card>
  );
}

function TweaksPane({ settings, set, clearHistory }: { settings: SettingsType; set: any; clearHistory: () => void }) {
  const accentOptions = ['#E50914', '#6E3FF3', '#14B8A6', '#F5C518', '#46D369', '#2E51A2'];
  const [cleared, setCleared] = React.useState(false);

  function handleClear() {
    clearHistory();
    setCleared(true);
    setTimeout(() => setCleared(false), 2200);
  }

  return (
    <>
      <Card title="Billboard Style">
        <Row title="Layout" control={<Picker value={settings.bbStyle} options={['Spotlight', 'Centered', 'Cinema Wall']} onChange={(v) => set('bbStyle', v)} />} last />
      </Card>
      <Card title="Appearance">
        <Row title="Theme" desc="Switch between dark and light mode." control={
          <Seg value={settings.theme || 'dark'} options={['dark', 'light']} onChange={(v) => set('theme', v)} />
        } />
        <Row title="Accent color" control={
          <div style={{ display: 'flex', gap: 8 }}>
            {accentOptions.map((c) => (
              <button key={c} onClick={() => set('accentColor', c)} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: settings.accentColor === c ? '3px solid var(--ink-1)' : '2px solid transparent', cursor: 'pointer', outline: 'none' }} />
            ))}
          </div>
        } />
        <Row title="Card radius" control={<Seg value={String(settings.cardRadius)} options={['0', '4', '8', '12']} onChange={(v) => set('cardRadius', Number(v))} />} last />
      </Card>
      <Card title="Watch History">
        <Row title="Clear watch history" desc="Remove all progress from Continue Watching." control={
          <button onClick={handleClear} style={{ ...outlineBtn, color: cleared ? '#46D369' : '#fff', borderColor: cleared ? '#46D369' : '#444' }}>
            {cleared ? '✓ Cleared' : 'Clear history'}
          </button>
        } last />
      </Card>
    </>
  );
}

function ParentalPane({ settings, set }: { settings: SettingsType; set: any }) {
  return (
    <Card title="Parental Controls">
      <Row icon={<Icons.Info size={17} />} title="Maturity rating" desc="Only show titles at or below this rating." control={<Seg value={settings.maturity} options={['Kids', 'TV-PG', 'TV-14', 'All']} onChange={(v) => set('maturity', v)} />} last />
    </Card>
  );
}

const inp: React.CSSProperties = { background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '11px 14px', color: 'var(--fg-1)', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%' };
const primaryBtn: React.CSSProperties = { background: 'var(--accent,#E50914)', border: 0, borderRadius: 6, padding: '12px 20px', color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' };
const outlineBtn: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 4, padding: '9px 16px', background: 'transparent', color: 'var(--fg-1)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' };
