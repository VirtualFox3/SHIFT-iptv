import React from 'react';
import * as Icons from './Icons';
import type { Title } from '../types';

export function RtBadge({ score, size = 13 }: { score: number; size?: number }) {
  const fresh = score >= 60;
  return (
    <span title={fresh ? 'Rotten Tomatoes — Fresh' : 'Rotten Tomatoes — Rotten'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: size, fontWeight: 700, color: 'var(--ink-1)' }}>
      {fresh ? <Icons.Tomato size={size + 3} /> : <Icons.Splat size={size + 3} />}
      {`${score}%`}
    </span>
  );
}

export function TraktBadge({ score, watchers, size = 13 }: { score: number; watchers?: string; size?: number }) {
  return (
    <span title={`Trakt community rating${watchers ? ` · ${watchers} watching` : ''}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: size, fontWeight: 600, color: 'var(--ink-3)' }}>
      <span style={{ color: '#ED1C24', display: 'inline-flex' }}><Icons.Trakt size={size + 2} /></span>
      <span style={{ color: 'var(--ink-1)', fontWeight: 700 }}>{score}%</span>
      {watchers && <span style={{ color: '#909090', fontWeight: 500 }}>· {watchers}</span>}
    </span>
  );
}

export function SeasonsBadge({ label, size = 13 }: { label: string; size?: number }) {
  if (!label) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: size, color: 'var(--ink-3)', fontWeight: 600 }}>
      <span style={{ color: '#909090', display: 'inline-flex' }}><Icons.Stack size={size + 1} /></span>
      {label}
    </span>
  );
}

export function RatingsRow({ item, size = 13, gap = 14 }: { item: Partial<Title>; size?: number; gap?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap, flexWrap: 'wrap' }}>
      {item.imdbRating && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: size, fontWeight: 700, color: 'var(--ink-1)' }}>
          <Icons.Star size={size + 3} filled />{item.imdbRating}
        </span>
      )}
      {item.rt != null && <RtBadge score={item.rt} size={size} />}
      {item.trakt != null && <TraktBadge score={item.trakt} watchers={item.watchers} size={size} />}
    </div>
  );
}
