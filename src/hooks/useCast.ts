import { useEffect, useState, useCallback, useRef } from 'react';

export type CastState = 'unavailable' | 'idle' | 'connecting' | 'connected';

export function useCast() {
  const [castState, setCastState] = useState<CastState>('unavailable');
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    const init = () => {
      const cast = (window as any).cast;
      const chrome = (window as any).chrome;
      if (!cast || !chrome?.cast) return;

      const context = cast.framework.CastContext.getInstance();
      context.setOptions({
        receiverApplicationId: 'CC1AD845',
        autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
      });

      const update = () => {
        const state = context.getCastState();
        switch (state) {
          case cast.framework.CastState.NO_DEVICES_AVAILABLE: setCastState('unavailable'); break;
          case cast.framework.CastState.NOT_CONNECTED: setCastState('idle'); break;
          case cast.framework.CastState.CONNECTING: setCastState('connecting'); break;
          case cast.framework.CastState.CONNECTED: setCastState('connected'); break;
        }
        sessionRef.current = context.getCurrentSession();
      };

      context.addEventListener(cast.framework.CastContextEventType.CAST_STATE_CHANGED, update);
      update();
    };

    (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) init();
    };

    // If the API is already loaded (e.g. hot reload), init immediately.
    if ((window as any).cast?.framework) init();
  }, []);

  const requestCast = useCallback(() => {
    const cast = (window as any).cast;
    if (!cast) return;
    const context = cast.framework.CastContext.getInstance();
    if (castState === 'connected') {
      context.endCurrentSession(true);
    } else {
      context.requestSession().catch(() => {});
    }
  }, [castState]);

  const castMedia = useCallback((url: string, title: string, imageUrl?: string) => {
    const chrome = (window as any).chrome;
    const cast = (window as any).cast;
    const session = sessionRef.current;
    if (!session || !chrome?.cast || !cast) return;

    const mediaInfo = new chrome.cast.media.MediaInfo(url, 'video/mp4');
    mediaInfo.metadata = new chrome.cast.media.MovieMediaMetadata();
    mediaInfo.metadata.title = title;
    if (imageUrl) {
      mediaInfo.metadata.images = [new chrome.cast.Image(imageUrl)];
    }

    const request = new chrome.cast.media.LoadRequest(mediaInfo);
    session.loadMedia(request).catch(() => {});
  }, []);

  return { castState, requestCast, castMedia };
}
