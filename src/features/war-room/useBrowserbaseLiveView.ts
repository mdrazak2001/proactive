import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { queryConnector } from '../integrations/api';

function liveViewUrlFromSample(sample: unknown): string | undefined {
  if (!sample || typeof sample !== 'object' || Array.isArray(sample)) return undefined;
  const value = (sample as { liveViewUrl?: unknown }).liveViewUrl;
  return typeof value === 'string' && value.startsWith('https://') ? value : undefined;
}

export function useBrowserbaseLiveView(active: boolean) {
  const { idToken } = useAuth();
  const [liveViewUrl, setLiveViewUrl] = useState<string>();
  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!active) {
      startedFor.current = null;
      setLiveViewUrl(undefined);
      return;
    }
    if (!idToken || startedFor.current === idToken) return;
    startedFor.current = idToken;
    let cancelled = false;

    void queryConnector('browserbase', idToken)
      .then((receipt) => {
        if (cancelled) return;
        const url = liveViewUrlFromSample(receipt.sample);
        if (url) setLiveViewUrl(url);
      })
      .catch(() => {
        if (!cancelled) startedFor.current = null;
      });

    return () => {
      cancelled = true;
    };
  }, [active, idToken]);

  return liveViewUrl;
}
