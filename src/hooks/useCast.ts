import { useState, useEffect, useCallback, useRef } from 'react';

export type CastState = 'unavailable' | 'idle' | 'connecting' | 'connected';

function getCtx(): any {
  return (window as any).cast?.framework?.CastContext?.getInstance?.();
}

export function useCast() {
  const [castState, setCastState] = useState<CastState>('unavailable');
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    const win = window as any;

    function init() {
      const ctx = getCtx();
      if (!ctx) return;
      ctx.setOptions({
        receiverApplicationId: 'CC1AD845',
        autoJoinPolicy: win.chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED,
      });

      const update = () => {
        const cs = ctx.getCastState?.();
        const S = win.cast?.framework?.CastState;
        if (!S) return;
        if (cs === S.NO_DEVICES_AVAILABLE) setCastState('unavailable');
        else if (cs === S.NOT_CONNECTED) setCastState('idle');
        else if (cs === S.CONNECTING) setCastState('connecting');
        else setCastState('connected');
        sessionRef.current = ctx.getCurrentSession?.() ?? null;
      };

      const evtType = win.cast?.framework?.CastContextEventType?.CAST_STATE_CHANGED;
      if (evtType) ctx.addEventListener(evtType, update);
      update();
    }

    if (win.cast?.framework) {
      init();
    } else {
      win.__onGCastApiAvailable = (available: boolean) => {
        if (available) init();
      };
    }
  }, []);

  const requestCast = useCallback(async () => {
    const ctx = getCtx();
    if (!ctx) return;
    if (castState === 'connected') {
      ctx.endCurrentSession(true);
    } else {
      try { await ctx.requestSession(); } catch {}
    }
  }, [castState]);

  const castMedia = useCallback((url: string, title: string, imageUrl?: string) => {
    const win = window as any;
    const session = sessionRef.current;
    if (!session || !win.chrome?.cast) return;

    const contentType = /\.m3u8(\?|$)/i.test(url) ? 'application/x-mpegURL' : 'video/mp4';
    const mediaInfo = new win.chrome.cast.media.MediaInfo(url, contentType);
    const meta = new win.chrome.cast.media.GenericMediaMetadata();
    meta.title = title;
    if (imageUrl) meta.images = [{ url: imageUrl }];
    mediaInfo.metadata = meta;

    const req = new win.chrome.cast.media.LoadRequest(mediaInfo);
    session.loadMedia(req).catch(() => {});
  }, []);

  return { castState, requestCast, castMedia };
}
