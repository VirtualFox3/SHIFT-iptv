import React, { useState, useEffect, useRef } from 'react';
import type { Provider } from '../types';
import { ShiftLogo } from './Icons';
import * as Icons from './Icons';

interface HeaderProps {
  provider: Provider;
  tab: string;
  onNav: (tab: string) => void;
  onSignOut: () => void;
  onSettings: () => void;
  categories: string[];
  activeCategory: string | null;
  onCategory: (c: string) => void;
  searchOpen: boolean;
  query: string;
  onQuery: (q: string) => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
}

const NAV = [
  ['home', 'Home'],
  ['live', 'Live TV'],
  ['movies', 'Movies'],
  ['series', 'Series'],
  ['mylist', 'My List'],
] as const;

export default function Header({
  provider, tab, onNav, onSignOut, onSettings,
  categories, activeCategory, onCategory,
  searchOpen, query, onQuery, onOpenSearch, onCloseSearch,
}: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = document.getElementById('app-scroll') || window;
    const onScroll = () => {
      const y = el === window ? window.scrollY : (el as HTMLElement).scrollTop;
      setScrolled(y > 40);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const close = () => { setCatOpen(false); setMenuOpen(false); };
    if (catOpen || menuOpen) {
      window.addEventListener('click', close);
      return () => window.removeEventListener('click', close);
    }
  }, [catOpen, menuOpen]);

  return (
    <div className="nfx-header" style={{
      position: 'sticky', top: 0, height: 68, display: 'flex', alignItems: 'center',
      padding: '0 48px', gap: 24, zIndex: 50,
      transition: 'background-color 300ms',
      background: scrolled ? 'var(--bg-page)' : 'transparent',
      backgroundImage: scrolled ? 'none' : 'linear-gradient(180deg, rgba(0,0,0,0.82) 10%, rgba(0,0,0,0) 100%)',
    }}>
      {/* Logo */}
      <button onClick={() => onNav('home')} style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 0, marginRight: 4, flexShrink: 0 }}>
        <ShiftLogo size={22} />
      </button>

      {/* Primary nav */}
      <nav style={{ display: 'flex', gap: 20, fontSize: 14, flexShrink: 0 }}>
        {NAV.map(([k, label]) => (
          <button key={k} onClick={() => { onNav(k); }} style={{
            background: 'transparent', border: 0, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
            color: tab === k && !activeCategory ? 'var(--ink-1)' : 'var(--ink-2)',
            fontWeight: tab === k && !activeCategory ? 700 : 400,
            opacity: tab === k && !activeCategory ? 1 : 0.85,
            display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
          }}>
            {k === 'live' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent,#E50914)', boxShadow: '0 0 5px var(--accent,#E50914)' }} />}
            {label}
          </button>
        ))}

        {/* Categories dropdown */}
        {categories.length > 0 && (
          <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setCatOpen((o) => !o); setMenuOpen(false); }} style={{
              background: 'transparent', border: 0, color: activeCategory ? 'var(--ink-1)' : 'var(--ink-2)', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, fontWeight: activeCategory ? 700 : 400, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', padding: 0,
            }}>
              {activeCategory || 'Categories'}
              <span style={{ display: 'inline-flex', transform: catOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
                <Icons.CaretDown size={13} />
              </span>
            </button>
            {catOpen && (
              <div className="nfx-scroll nfx-dropdown" style={{ position: 'absolute', top: 32, left: -16, background: 'rgba(15,15,15,0.97)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '10px 0', minWidth: 420, maxHeight: 380, overflowY: 'auto', boxShadow: '0 12px 30px rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', zIndex: 60 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2px 0' }}>
                  {categories.map((c) => (
                    <button key={c} onClick={() => { setCatOpen(false); onCategory(c); }} style={{
                      background: 'transparent', border: 0, color: activeCategory === c ? 'var(--ink-1)' : 'var(--ink-3)', fontSize: 13.5, padding: '7px 18px',
                      fontWeight: activeCategory === c ? 700 : 400, whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-1)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = activeCategory === c ? 'var(--ink-1)' : 'var(--ink-3)')}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Right side */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 18, alignItems: 'center', color: 'var(--ink-1)' }}>
        <InstallButton />
        {/* TV Guide */}
        <button onClick={() => onNav('live')} title="TV Guide" style={iconBtn}><Icons.Grid size={19} /></button>

        {/* Search — expanding Netflix-style */}
        <div style={{ display: 'flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
          <div style={{
            display: 'flex', alignItems: 'center', overflow: 'hidden',
            width: searchOpen ? 240 : 28, height: 36,
            background: searchOpen ? 'rgba(0,0,0,0.78)' : 'transparent',
            border: searchOpen ? '1px solid rgba(255,255,255,0.85)' : '1px solid transparent',
            borderRadius: 4, transition: 'width 240ms cubic-bezier(0.2,0.7,0.2,1), background 200ms',
          }}>
            <button onClick={() => searchOpen ? inputRef.current?.focus() : onOpenSearch()} style={{ ...iconBtn, flexShrink: 0, padding: searchOpen ? '0 8px 0 10px' : 0, width: searchOpen ? 'auto' : 28 }}>
              <Icons.Search size={19} />
            </button>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') onCloseSearch(); }}
              placeholder="Titles, channels, genres"
              tabIndex={searchOpen ? 0 : -1}
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', color: 'var(--ink-1)', fontSize: 14, fontFamily: 'inherit', opacity: searchOpen ? 1 : 0, pointerEvents: searchOpen ? 'auto' : 'none' }}
            />
            {searchOpen && (
              <button onClick={onCloseSearch} style={{ ...iconBtn, flexShrink: 0, padding: '0 8px', opacity: 0.7 }}>
                <Icons.Close size={15} />
              </button>
            )}
          </div>
        </div>

        <button style={iconBtn}><Icons.Bell size={20} /></button>

        {/* Account menu */}
        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => { setMenuOpen((o) => !o); setCatOpen(false); }}>
            <div style={{ width: 32, height: 32, borderRadius: 4, background: provider.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, overflow: 'hidden' }}>
              {provider.profileImage
                ? <img src={provider.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : provider.letter}
            </div>
            <span style={{ display: 'inline-flex', transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}><Icons.CaretDown size={13} /></span>
          </div>
          {menuOpen && (
            <div className="nfx-dropdown" style={{ position: 'absolute', top: 42, right: 0, background: 'rgba(15,15,15,0.97)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '8px 0', minWidth: 220, boxShadow: '0 12px 30px rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', zIndex: 60 }}>
              <div style={{ padding: '6px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 6 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{provider.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-5)', marginTop: 2 }}>{provider.tag}</div>
              </div>
              {([['Settings', onSettings], ['Switch provider', onSignOut]] as [string, () => void][]).map(([label, fn]) => (
                <button key={label} onClick={() => { setMenuOpen(false); fn(); }} style={{ display: 'block', width: '100%', background: 'transparent', border: 0, color: 'var(--ink-3)', fontSize: 13.5, padding: '9px 16px', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-3)')}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = { background: 'transparent', border: 0, color: 'var(--ink-1)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, opacity: 0.92 };

// "Install app" — appears when Chrome fires beforeinstallprompt (and hides once installed).
function InstallButton() {
  const [deferred, setDeferred] = useState<any>(null);
  useEffect(() => {
    const onPrompt = (e: any) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  if (!deferred) return null;
  return (
    <button
      onClick={async () => { deferred.prompt(); try { await deferred.userChoice; } catch {} setDeferred(null); }}
      title="Install SHIFT as an app"
      style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--accent,#E50914)', border: 0, color: 'var(--ink-1)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, padding: '7px 13px', borderRadius: 6, whiteSpace: 'nowrap' }}
    >
      <Icons.Download size={16} /> Install app
    </button>
  );
}
