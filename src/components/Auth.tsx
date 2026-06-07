import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { fetchM3U } from '../api/m3u';
import { xtreamVerify, xtreamGetLive, xtreamGetVOD, xtreamGetSeries } from '../api/xtream';
import type { Provider } from '../types';
import { ShiftLogo } from './Icons';
import * as Icons from './Icons';

type Mode = 'xtream' | 'playlist';

export default function Auth() {
  const setProvider = useStore((s) => s.setProvider);
  const setChannels = useStore((s) => s.setChannels);
  const setTitles = useStore((s) => s.setTitles);
  const reconnectProvider = useStore((s) => s.reconnectProvider);
  const savedProviders = useStore((s) => s.savedProviders);
  const removeSavedProvider = useStore((s) => s.removeSavedProvider);
  const saveProvider = useStore((s) => s.saveProvider);
  const reconnecting = useStore((s) => s.reconnecting);

  const [screen, setScreen] = useState<'gate' | 'login'>(savedProviders.length > 0 ? 'gate' : 'login');
  const [addMode, setAddMode] = useState(false);

  if (screen === 'gate') {
    return (
      <ProviderGate
        saved={savedProviders}
        reconnecting={reconnecting}
        onPickSaved={(p) => reconnectProvider(p)}
        onPickDemo={(p) => setProvider(p)}
        onRemove={removeSavedProvider}
        onRename={(p, name) => saveProvider({ ...p, name })}
        onAdd={() => { setAddMode(true); setScreen('login'); }}
      />
    );
  }

  return (
    <LoginScreen
      addMode={addMode}
      onBack={savedProviders.length > 0 ? () => { setAddMode(false); setScreen('gate'); } : undefined}
      onBrowseDemo={() => { setAddMode(false); setScreen('gate'); }}
      setProvider={setProvider}
      setChannels={setChannels}
      setTitles={setTitles}
    />
  );
}

/* ── Login screen ─────────────────────────────────────────────────────────── */
function LoginScreen({ addMode, onBack, onBrowseDemo, setProvider, setChannels, setTitles }: {
  addMode: boolean;
  onBack?: () => void;
  onBrowseDemo: () => void;
  setProvider: (p: Provider) => void;
  setChannels: (c: any[]) => void;
  setTitles: (t: any[]) => void;
}) {
  const [mode, setMode] = useState<Mode>('xtream');
  // Xtream
  const [host, setHost] = useState('');
  const [xuser, setXuser] = useState('');
  const [xpass, setXpass] = useState('');
  const [xtName, setXtName] = useState('');
  // Playlist
  const [url, setUrl] = useState('');
  const [plName, setPlName] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');

    if (mode === 'playlist') {
      if (!url.trim()) { setError('Enter a playlist URL.'); return; }
      setLoading(true); setLoadStep('Loading channels…');
      try {
        const channels = await fetchM3U(url.trim());
        if (!channels.length) throw new Error('No channels found in that playlist.');
        const name = plName.trim() || hostname(url) || 'M3U Playlist';
        const p: Provider = {
          id: 'm3u_' + Date.now(), name,
          tag: `${channels.length} channels`, letter: name[0].toUpperCase(),
          bg: pickGradient(2), channels: channels.length, type: 'm3u', m3uUrl: url.trim(),
        };
        setProvider(p); setChannels(channels); setTitles([]);
      } catch (e: any) {
        setError(e.message || 'Failed to load playlist.');
        setLoading(false); setLoadStep('');
      }
      return;
    }

    // Xtream
    if (!host.trim() || !xuser.trim()) { setError('Enter server URL and username.'); return; }
    setLoading(true);
    try {
      const server = host.trim().startsWith('http') ? host.trim() : 'http://' + host.trim();
      const auth = { serverUrl: server, username: xuser.trim(), password: xpass };
      setLoadStep('Connecting…');
      const info = await xtreamVerify(server, xuser.trim(), xpass);
      setLoadStep('Loading live channels…');
      const channels = await xtreamGetLive(auth);
      setLoadStep('Loading movies…');
      const vod = await xtreamGetVOD(auth);
      setLoadStep('Loading series…');
      const series = await xtreamGetSeries(auth);
      const titles = [...vod, ...series];
      const name = xtName.trim() || info.server_info?.server_name || hostname(server) || 'Xtream';
      const p: Provider = {
        id: 'xt_' + xuser.trim(), name,
        tag: `${channels.length} ch · ${titles.length} titles`,
        letter: name[0].toUpperCase(),
        bg: pickGradient(3), channels: channels.length, type: 'xtream',
        serverUrl: server, username: xuser.trim(), password: xpass,
      };
      setProvider(p); setChannels(channels); setTitles(titles);
    } catch (e: any) {
      setError(e.message || 'Connection failed. Check your details.');
      setLoading(false); setLoadStep('');
    }
  }

  const cta = mode === 'xtream' ? (addMode ? 'Connect Provider' : 'Connect')
    : (addMode ? 'Add Playlist' : 'Load Playlist');

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: '#141414', overflow: 'hidden' }}>
      {/* Brand bar */}
      <div style={{ position: 'relative', padding: '22px 48px', display: 'flex', alignItems: 'center', gap: 18 }}>
        {addMode && onBack && (
          <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.16)', color: '#fff', borderRadius: 4, padding: '8px 14px 8px 10px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.13)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}>
            <Icons.Back size={18} />Providers
          </button>
        )}
        <ShiftLogo size={34} />
      </div>

      <div style={{ position: 'relative', display: 'grid', placeItems: 'center', padding: '12px 16px 80px' }}>
        <div style={{ width: 460, maxWidth: '100%', background: '#181818', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '48px 64px 40px', color: '#fff' }}>
          <h1 style={{ fontWeight: 700, fontSize: 30, margin: '0 0 6px' }}>{addMode ? 'Add a provider' : 'Sign In'}</h1>
          <p style={{ margin: '0 0 24px', color: 'var(--fg-3,#b3b3b3)', fontSize: 14 }}>
            {addMode ? 'Connect another IPTV service to this device.' : 'Connect your IPTV service to start streaming.'}
          </p>

          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 4, background: '#1a1a1a', padding: 4, borderRadius: 6, marginBottom: 20 }}>
            {(['xtream', 'playlist'] as const).map((k) => (
              <button key={k} onClick={() => { setMode(k); setError(''); }} style={{
                flex: 1, padding: '9px 0', border: 0, borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: mode === k ? 'var(--accent,#E50914)' : 'transparent',
                color: mode === k ? '#fff' : 'var(--fg-3,#b3b3b3)', transition: 'all 160ms',
              }}>
                {k === 'xtream' ? 'Xtream Codes' : 'Playlist URL'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'xtream' ? (
              <>
                <Field label="Provider name (optional)" value={xtName} onChange={setXtName} />
                <Field label="Server URL (host:port)" value={host} onChange={setHost} />
                <Field label="Username" value={xuser} onChange={setXuser} />
                <Field label="Password" value={xpass} onChange={setXpass} type="password" />
                <div style={{ fontSize: 12.5, color: 'var(--fg-4,#808080)', lineHeight: 1.5, marginTop: -4 }}>
                  Xtream Codes login. SHIFT pulls live channels, EPG and VOD from your line.
                </div>
              </>
            ) : (
              <>
                <Field label="Playlist name (optional)" value={plName} onChange={setPlName} />
                <Field label="M3U / Xtream playlist URL" value={url} onChange={setUrl} />
                <div style={{ fontSize: 12.5, color: 'var(--fg-4,#808080)', lineHeight: 1.5, marginTop: -4 }}>
                  Paste the link from your provider. SHIFT loads channels, EPG and VOD automatically.
                </div>
              </>
            )}

            {error && <p style={{ margin: 0, fontSize: 13, color: 'var(--accent,#E50914)', fontWeight: 600 }}>{error}</p>}

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#1f1f1f', borderRadius: 4, marginTop: 6 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2.5px solid #333', borderTopColor: 'var(--accent,#E50914)', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: '#b3b3b3' }}>{loadStep}</span>
              </div>
            ) : (
              <button onClick={handleSubmit} style={{ marginTop: 6, padding: '14px 16px', background: 'var(--accent,#E50914)', color: '#fff', border: 0, borderRadius: 4, fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 150ms' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--shift-accent-hover,#f40612)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent,#E50914)')}>
                {cta}
              </button>
            )}

            {!loading && addMode && (
              <button onClick={onBrowseDemo} style={{ padding: '14px 16px', background: 'rgba(128,128,128,0.35)', color: '#fff', border: 0, borderRadius: 4, fontWeight: 500, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Provider gate ────────────────────────────────────────────────────────── */
function ProviderGate({ saved, reconnecting, onPickSaved, onPickDemo, onRemove, onRename, onAdd }: {
  saved: Provider[];
  reconnecting: boolean;
  onPickSaved: (p: Provider) => void;
  onPickDemo: (p: Provider) => void;
  onRemove: (id: string) => void;
  onRename: (p: Provider, name: string) => void;
  onAdd: () => void;
}) {
  const [manage, setManage] = useState(false);
  // Only saved real providers — no demo tiles.
  const tiles = saved;

  if (reconnecting) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#141414' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid #2a2a2a', borderTopColor: 'var(--accent,#E50914)', animation: 'spin 0.7s linear infinite', margin: '0 auto 20px' }} />
          <div style={{ fontSize: 16, color: '#b3b3b3' }}>Reconnecting to your provider…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#141414', paddingTop: 24, paddingBottom: 48 }}>
      <div style={{ textAlign: 'center', maxWidth: 1100, padding: '0 32px' }}>
        <div style={{ marginBottom: 36, display: 'flex', justifyContent: 'center' }}><ShiftLogo size={26} /></div>
        <h1 style={{ fontWeight: 400, fontSize: 52, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.01em' }}>Who's streaming?</h1>
        <p style={{ margin: '0 0 44px', color: 'var(--fg-3,#b3b3b3)', fontSize: 17 }}>Choose a provider connection.</p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
          {tiles.map((p) => (
            <ProviderTile key={p.id} provider={p} manage={manage}
              onPick={() => (p.type === 'demo' ? onPickDemo(p) : onPickSaved(p))}
              onRemove={() => onRemove(p.id)}
              onRename={() => { const name = window.prompt('Rename provider', p.name); if (name && name.trim()) onRename(p, name.trim()); }} />
          ))}
          <div onClick={onAdd} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: 180 }}>
            <div style={{ width: 170, height: 170, borderRadius: 8, border: '2px dashed #404040', display: 'grid', placeItems: 'center', color: '#737373', fontSize: 72, fontWeight: 200, transition: 'border-color 200ms, color 200ms' }}
              onMouseEnter={(e) => { (e.currentTarget as any).style.borderColor = '#737373'; (e.currentTarget as any).style.color = '#999'; }}
              onMouseLeave={(e) => { (e.currentTarget as any).style.borderColor = '#404040'; (e.currentTarget as any).style.color = '#737373'; }}>+</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-4,#808080)' }}>Add Provider</div>
          </div>
        </div>

        <button onClick={() => setManage((m) => !m)} style={{ marginTop: 52, padding: '11px 30px', background: manage ? 'var(--accent,#E50914)' : 'transparent', color: manage ? '#fff' : 'var(--fg-4,#808080)', border: `1px solid ${manage ? 'var(--accent,#E50914)' : '#737373'}`, fontSize: 15, fontWeight: 500, letterSpacing: '0.04em', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 2 }}>
          {manage ? 'Done' : 'Manage Providers'}
        </button>
      </div>
    </div>
  );
}

function ProviderTile({ provider, manage, onPick, onRemove, onRename }: { provider: Provider; manage: boolean; onPick: () => void; onRemove: () => void; onRename: () => void }) {
  const [hover, setHover] = useState(false);
  const editable = manage && provider.type !== 'demo';
  return (
    <div onClick={() => (manage ? undefined : onPick())} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ cursor: manage ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: 180 }}>
      <div style={{ position: 'relative', width: 170, height: 170, borderRadius: 8, background: provider.bg, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 64, overflow: 'hidden', boxShadow: hover && !manage ? '0 0 0 4px rgba(255,255,255,0.85), 0 12px 32px rgba(0,0,0,0.5)' : 'none', transform: hover && !manage ? 'scale(1.03)' : 'scale(1)', transition: 'box-shadow 200ms, transform 200ms' }}>
        {provider.profileImage
          ? <img src={provider.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : provider.letter}
        {provider.type !== 'demo' && !manage && (
          <span style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: '#fff', background: 'rgba(0,0,0,0.4)', padding: '3px 8px', borderRadius: 999 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#46D369', boxShadow: '0 0 6px #46D369' }} />SAVED
          </span>
        )}
        {editable && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <button onClick={(e) => { e.stopPropagation(); onRename(); }} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.12)', border: 0, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 6 }}>
              <Icons.Pencil size={15} /> Rename
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(229,9,20,0.85)', border: 0, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 6 }}>
              <Icons.LogOut size={15} /> Remove
            </button>
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 600, color: hover && !manage ? '#fff' : 'var(--fg-3,#b3b3b3)', transition: 'color 200ms' }}>{provider.name}</div>
        <div style={{ fontSize: 13, color: 'var(--fg-4,#808080)', marginTop: 2 }}>{provider.tag}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  const [focus, setFocus] = useState(false);
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && reveal ? 'text' : type;
  const raised = focus || value.length > 0;
  return (
    <div style={{ position: 'relative' }}>
      <input value={value} type={inputType} onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ width: '100%', height: 58, padding: `22px ${isPassword ? 48 : 16}px 8px 16px`, fontFamily: 'inherit', fontSize: 16, background: '#1f1f1f', color: '#fff', border: `1px solid ${focus ? 'var(--accent,#E50914)' : '#333'}`, borderRadius: 4, outline: 0, transition: 'border-color 140ms' }} />
      <span style={{ position: 'absolute', left: 16, pointerEvents: 'none', top: raised ? 9 : 18, fontSize: raised ? 11 : 16, color: 'var(--fg-4,#808080)', transition: 'top 140ms, font-size 140ms' }}>{label}</span>
      {isPassword && (
        <button type="button" onClick={() => setReveal((r) => !r)} title={reveal ? 'Hide password' : 'Show password'}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 0, color: '#999', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 4 }}>
          {reveal ? <Icons.EyeOff size={18} /> : <Icons.Eye size={18} />}
        </button>
      )}
    </div>
  );
}

function hostname(u: string): string {
  try { return new URL(u.startsWith('http') ? u : 'http://' + u).hostname; } catch { return ''; }
}

const GRADS = [
  'linear-gradient(135deg,#6e1015,#E50914)',
  'linear-gradient(135deg,#11324f,#14B8A6)',
  'linear-gradient(135deg,#2a1659,#6E3FF3)',
  'linear-gradient(135deg,#0a3b2a,#46D369)',
  'linear-gradient(135deg,#3a1206,#F5A623)',
  'linear-gradient(135deg,#1a1a4e,#2E51A2)',
];
function pickGradient(i: number): string { return GRADS[i % GRADS.length]; }
