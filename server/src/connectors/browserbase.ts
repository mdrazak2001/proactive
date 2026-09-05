import type { BrokerConfig } from '../config.js';
import { upstreamJson } from '../upstream.js';
import {
  configurationError,
  isRecord,
  recordsFrom,
  safeHttpBaseUrl,
} from './shared.js';
import type { Connector, ConnectorQueryResult, ConnectorReceipt } from './types.js';

const PROJECT_ID = /^[A-Za-z0-9_-]{6,64}$/;

function safeLiveViewUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return undefined;
    if (
      url.hostname !== 'www.browserbase.com' &&
      !url.hostname.endsWith('.browserbase.com')
    ) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export function createBrowserbaseConnector(config: BrokerConfig): Connector {
  const provider = 'Browserbase';
  const credentialBoundary = 'server-side project key; live view URL only leaves the broker';
  const scope = ['sessions.create', 'sessions.debug', 'configured project only'];

  function configuration() {
    const configured = Boolean(config.browserbase.apiKey && config.browserbase.projectId);
    const valid = Boolean(
      configured &&
        PROJECT_ID.test(config.browserbase.projectId ?? '') &&
        safeHttpBaseUrl(config.browserbase.baseUrl),
    );
    return { configured, valid };
  }

  function settings() {
    const state = configuration();
    if (!state.configured || !state.valid) configurationError(provider);
    return {
      apiKey: config.browserbase.apiKey as string,
      projectId: config.browserbase.projectId as string,
      baseUrl: safeHttpBaseUrl(config.browserbase.baseUrl) as string,
    };
  }

  function headers(apiKey: string): Record<string, string> {
    return {
      'X-BB-API-Key': apiKey,
      accept: 'application/json',
    };
  }

  async function verify(): Promise<ConnectorReceipt> {
    const current = settings();
    const raw = await upstreamJson(
      `${current.baseUrl}/v1/sessions`,
      {
        method: 'GET',
        headers: headers(current.apiKey),
      },
      { provider, config },
    );
    const sessions = recordsFrom(raw, ['sessions', 'data', 'items']);
    return {
      provider: 'browserbase',
      status: 'verified',
      credentialBoundary,
      scope,
      sample: { kind: 'project-session-access', count: sessions.length },
      checkedAt: new Date().toISOString(),
    };
  }

  async function query(): Promise<ConnectorQueryResult> {
    const current = settings();
    const created = await upstreamJson(
      `${current.baseUrl}/v1/sessions`,
      {
        method: 'POST',
        headers: {
          ...headers(current.apiKey),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          projectId: current.projectId,
          keepAlive: true,
          timeout: 300,
          browserSettings: {
            viewport: { width: 1280, height: 800 },
          },
        }),
      },
      { provider, config, acceptedStatuses: [200, 201] },
    );
    if (!isRecord(created) || typeof created.id !== 'string' || !created.id) {
      configurationError(provider);
    }
    const sessionId = created.id as string;
    const debug = await upstreamJson(
      `${current.baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/debug`,
      {
        method: 'GET',
        headers: headers(current.apiKey),
      },
      { provider, config },
    );
    const liveViewUrl = isRecord(debug)
      ? safeLiveViewUrl(debug.debuggerFullscreenUrl) ?? safeLiveViewUrl(debug.debuggerUrl)
      : undefined;

    return {
      receipt: {
        provider: 'browserbase',
        status: 'ok',
        credentialBoundary,
        scope,
        sample: {
          kind: 'live-view-session',
          count: liveViewUrl ? 1 : 0,
          sessionId,
          ...(liveViewUrl ? { liveViewUrl } : {}),
        },
        checkedAt: new Date().toISOString(),
      },
    };
  }

  return {
    id: 'browserbase',
    name: provider,
    credentialBoundary,
    scope,
    configuration,
    verify,
    query,
  };
}
