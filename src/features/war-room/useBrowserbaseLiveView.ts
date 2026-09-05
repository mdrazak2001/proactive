import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { runComputer, type ComputerStreamEvent } from './computerApi';

export interface ComputerRunState {
  liveViewUrl?: string;
  status: 'idle' | 'starting' | 'running' | 'completed' | 'approval_required' | 'error';
  actionCount: number;
  summary?: string;
  error?: string;
}

const idleState: ComputerRunState = { status: 'idle', actionCount: 0 };
const RUN_MARKER_TTL_MS = 5 * 60 * 1_000;

function runMarker(runKey: string): string {
  return `proactive_computer_started:${runKey}`;
}

function hasStarted(runKey: string): boolean {
  try {
    const marker = runMarker(runKey);
    const startedAt = Number(localStorage.getItem(marker));
    const expired = Date.now() - startedAt > RUN_MARKER_TTL_MS;
    if (!Number.isFinite(startedAt) || startedAt <= 0 || expired) {
      localStorage.removeItem(marker);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function markStarted(runKey: string): void {
  try {
    localStorage.setItem(runMarker(runKey), String(Date.now()));
  } catch {
    // The authenticated broker still applies concurrency and rate limits.
  }
}

function clearStarted(runKey: string): void {
  try {
    localStorage.removeItem(runMarker(runKey));
  } catch {
    // A blocked storage write only removes this client-side duplicate-run hint.
  }
}

function safeLiveViewUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    const browserbase = url.hostname === 'browserbase.com'
      || url.hostname === 'www.browserbase.com'
      || url.hostname.endsWith('.browserbase.com');
    return url.protocol === 'https:' && browserbase ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function useBrowserbaseLiveView(
  active: boolean,
  goal: string,
  runKey: string,
): ComputerRunState {
  const { idToken } = useAuth();
  const [state, setState] = useState<ComputerRunState>(idleState);
  const [markerRevision, setMarkerRevision] = useState(0);
  const stateRunKey = useRef('');

  useEffect(() => {
    if (stateRunKey.current !== runKey) {
      stateRunKey.current = runKey;
      setState(idleState);
    }
    if (!active) {
      setState((current) =>
        current.status === 'starting' || current.status === 'running' ? idleState : current,
      );
      return;
    }
    if (!idToken || !runKey) return;
    if (hasStarted(runKey)) {
      const startedAt = Number(localStorage.getItem(runMarker(runKey)));
      const remaining = Math.max(0, RUN_MARKER_TTL_MS - (Date.now() - startedAt));
      const retry = window.setTimeout(
        () => setMarkerRevision((revision) => revision + 1),
        remaining + 50,
      );
      const retryWhenReleased = (event: StorageEvent) => {
        if (event.key === runMarker(runKey) && event.newValue === null) {
          setMarkerRevision((revision) => revision + 1);
        }
      };
      window.addEventListener('storage', retryWhenReleased);
      return () => {
        window.clearTimeout(retry);
        window.removeEventListener('storage', retryWhenReleased);
      };
    }

    const controller = new AbortController();
    let began = false;
    let completed = false;
    const onEvent = (event: ComputerStreamEvent) => {
      if (controller.signal.aborted) return;
      if (event.type === 'session') {
        const liveViewUrl = safeLiveViewUrl(event.liveViewUrl);
        setState((current) => ({ ...current, liveViewUrl, status: 'running' }));
      } else if (event.type === 'action') {
        setState((current) => ({
          ...current,
          status: 'running',
          actionCount: Math.max(current.actionCount, event.step),
        }));
      } else if (event.type === 'approval_required') {
        completed = true;
        setState((current) => ({
          ...current,
          status: 'approval_required',
          error: event.message,
        }));
      } else if (event.type === 'completed') {
        completed = true;
        setState((current) => ({
          ...current,
          status: 'completed',
          actionCount: event.steps,
          summary: event.summary,
        }));
      }
    };

    // The short delay prevents React StrictMode's development-only effect probe
    // from opening a duplicate paid browser session.
    const timer = window.setTimeout(() => {
      const performRun = async () => {
        if (hasStarted(runKey) || controller.signal.aborted) return;
        markStarted(runKey);
        began = true;
        setState({ status: 'starting', actionCount: 0 });
        try {
          await runComputer(goal, idToken, onEvent, controller.signal);
        } catch (reason) {
          if (controller.signal.aborted) {
            if (!completed) clearStarted(runKey);
            return;
          }
          clearStarted(runKey);
          setState((current) => ({
            ...current,
            status: 'error',
            error: reason instanceof Error ? reason.message : String(reason),
          }));
        }
      };

      if (navigator.locks) {
        void navigator.locks.request(
          `proactive-computer:${runKey}`,
          { ifAvailable: true },
          async (lock) => {
            if (lock) await performRun();
          },
        );
      } else {
        void performRun();
      }
    }, 40);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
      if (began && !completed) clearStarted(runKey);
    };
  }, [active, goal, idToken, markerRevision, runKey]);

  return state;
}
