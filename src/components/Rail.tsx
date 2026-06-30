import React, { useRef } from 'react';
import type { Rail as RailType, Channel, Title } from '../types';
import Poster, { ChannelCard } from './Poster';
import * as Icons from './Icons';

interface RailProps {
  rail: RailType;
  titlesById: Record<string, Title>;
  channelsById: Record<string, Channel>;
  onPlay: (item: Title | Channel) => void;
  onOpen: (item: Title | Channel) => void;
}

export default function Rail({ rail, titlesById, channelsById, onPlay, onOpen }: RailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isChannel = rail.kind === 'channel';
  const items = rail.ids
    .map((id) => (isChannel ? channelsById[id] : titlesById[id]))
    .filter(Boolean) as (Channel | Title)[];

  function scrollBy(dir: number) {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * scrollRef.current.clientWidth * 0.85, behavior: 'smooth' });
    }
  }

  return (
    <div style={{ position: 'relative', padding: '0 48px', marginBottom: 32, zIndex: rail.topRow ? 1 : 'auto' }}
      onMouseEnter={(e) => {
        const arrows = e.currentTarget.querySelectorAll('.rail-arrow');
        arrows.forEach((a) => ((a as HTMLElement).style.opacity = '1'));
      }}
      onMouseLeave={(e) => {
        const arrows = e.currentTarget.querySelectorAll('.rail-arrow');
        arrows.forEach((a) => ((a as HTMLElement).style.opacity = '0'));
      }}
    >
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-2)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {isChannel && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: '#E50914' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E50914', boxShadow: '0 0 5px #E50914' }} />
            LIVE
          </span>
        )}
        {rail.title}
        <span style={{ fontSize: 13, color: 'var(--ink-5)', fontWeight: 500 }}>({items.length})</span>
      </h2>
      <div style={{ position: 'relative' }}>
        <button className="rail-arrow" onClick={() => scrollBy(-1)} style={arrow('left')}>
          <Icons.ChevronLeft size={26} />
        </button>
        <div
          ref={scrollRef}
          className="nfx-scroll"
          style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollBehavior: 'smooth', paddingBottom: rail.topRow ? 48 : 4, paddingTop: 4 }}
        >
          {items.map((it, i) =>
            isChannel
              ? <ChannelCard key={it.id + '-' + i} channel={it as Channel} onPlay={onPlay as any} onOpen={onOpen as any} />
              : <Poster key={it.id + '-' + i} title={it as Title} idx={i} isTopRow={rail.topRow} progress={rail.progress?.[it.id]} onPlay={onPlay} onOpen={onOpen} />
          )}
          <div style={{ width: 1, flexShrink: 0 }} />
        </div>
        <button className="rail-arrow" onClick={() => scrollBy(1)} style={arrow('right')}>
          <Icons.ChevronRight size={26} />
        </button>
      </div>
    </div>
  );
}

function arrow(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', [side]: 0, top: 0, bottom: 0, width: 48,
    background: 'rgba(20,20,20,0.65)', border: 0, color: 'var(--ink-1)', cursor: 'pointer',
    display: 'grid', placeItems: 'center', zIndex: 6,
    opacity: 0, transition: 'opacity 150ms',
  };
}
