import { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';

// Roku Media Player channel — accepts url/title/contentType via ECP launch params.
const ROKU_MEDIA_PLAYER_ID = '2285';

export type RokuState = 'unconfigured' | 'idle' | 'sending' | 'sent';

export function useRoku() {
  const rokuIp = useStore((s) => s.settings.rokuIp);
  const [rokuState, setRokuState] = useState<RokuState>(rokuIp ? 'idle' : 'unconfigured');

  const sendToRoku = useCallback(async (url: string, title: string) => {
    if (!rokuIp) return;
    setRokuState('sending');
    const contentType = /\.m3u8(\?|$)/i.test(url) ? 'application/x-mpegURL' : 'video/mp4';
    const params = new URLSearchParams({ url, title, contentType });
    try {
      await fetch(`http://${rokuIp}:8060/launch/${ROKU_MEDIA_PLAYER_ID}?${params}`, {
        method: 'POST',
        mode: 'no-cors',
      });
      setRokuState('sent');
    } catch {
      setRokuState('idle');
      return;
    }
    setTimeout(() => setRokuState('idle'), 2000);
  }, [rokuIp]);

  // Keep 'unconfigured' in sync when IP is cleared/set from Settings.
  const configured = Boolean(rokuIp);

  return { rokuState, sendToRoku, configured };
}
