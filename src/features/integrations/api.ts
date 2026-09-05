export const liveProviderIds = ['supabase', 'langsmith', 'supermemory', 'spacetimedb'] as const;

export type LiveProviderId = (typeof liveProviderIds)[number];
export type ConnectionState =
  | 'not_configured'
  | 'configured'
  | 'verifying'
  | 'querying'
  | 'verified'
  | 'error'
  | 'offline';

export interface ConnectorReceipt {
  provider: LiveProviderId;
  status: ConnectionState;
  credentialBoundary?: string;
  scope: string[];
  checkedAt?: string;
  message?: string;
  sample?: unknown;
}

export interface ConnectorStatus extends ConnectorReceipt {
  configured: boolean;
}

export interface StatusSnapshot {
  providers: Partial<Record<LiveProviderId, ConnectorStatus>>;
  brokerMessage?: string;
}

export class BrokerRequestError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 0, code = '') {
    super(message);
    this.name = 'BrokerRequestError';
    this.status = status;
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isLiveProviderId = (value: string): value is LiveProviderId =>
  liveProviderIds.includes(value as LiveProviderId);

const asString = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

const readProviderId = (value: Record<string, unknown>, fallback?: string) => {
  const raw = asString(value.provider) ?? asString(value.id) ?? fallback;
  return raw && isLiveProviderId(raw) ? raw : undefined;
};

const normalizeState = (value: unknown, configured?: boolean): ConnectionState => {
  const state = asString(value)?.toLowerCase().replace(/[\s-]+/g, '_');
  if (state === 'verified' || state === 'ok' || state === 'ready' || state === 'connected' || state === 'live') return 'verified';
  if (state === 'configured' || state === 'pending_verification') return 'configured';
  if (state === 'verifying') return 'verifying';
  if (state === 'querying' || state === 'fetching') return 'querying';
  if (state === 'error' || state === 'failed' || state === 'invalid') return 'error';
  if (state === 'offline' || state === 'unreachable') return 'offline';
  if (state === 'not_configured' || state === 'unconfigured' || state === 'missing') return 'not_configured';
  return configured ? 'configured' : 'not_configured';
};

const normalizeScope = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  const single = asString(value);
  return single ? [single] : [];
};

const unwrapReceipt = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) return {};
  if (isRecord(value.receipt)) return { ...value, ...value.receipt };
  return value;
};

function normalizeConnector(value: unknown, fallbackProvider?: string): ConnectorStatus | undefined {
  const raw = unwrapReceipt(value);
  const provider = readProviderId(raw, fallbackProvider);
  if (!provider) return undefined;

  const configured = typeof raw.configured === 'boolean'
    ? raw.configured
    : normalizeState(raw.status ?? raw.state) !== 'not_configured';

  return {
    provider,
    configured,
    status: normalizeState(raw.status ?? raw.state, configured),
    credentialBoundary: asString(raw.credentialBoundary) ?? asString(raw.credential_boundary),
    scope: normalizeScope(raw.scope ?? raw.scopes),
    checkedAt: asString(raw.checkedAt) ?? asString(raw.checked_at),
    message: asString(raw.message) ?? asString(raw.detail),
    sample: raw.sample ?? raw.data ?? raw.items ?? raw.result,
  };
}

function messageFromPayload(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) return value;
  if (!isRecord(value)) return fallback;
  const nestedError = isRecord(value.error) ? value.error.message : value.error;
  return asString(value.message) ?? asString(nestedError) ?? asString(value.detail) ?? fallback;
}

function codeFromPayload(value: unknown) {
  if (!isRecord(value)) return '';
  if (typeof value.code === 'string') return value.code;
  return isRecord(value.error) && typeof value.error.code === 'string'
    ? value.error.code
    : '';
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function brokerFetch(path: string, init?: RequestInit, idToken?: string) {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new BrokerRequestError('Connector broker is offline. Start the local broker and try again.');
  }

  const payload = await readJson(response);
  if (!response.ok) {
    throw new BrokerRequestError(
      messageFromPayload(payload, `Broker request failed (${response.status}).`),
      response.status,
      codeFromPayload(payload),
    );
  }
  return payload;
}

export async function getConnectorStatuses(signal?: AbortSignal, idToken?: string): Promise<StatusSnapshot> {
  const payload = await brokerFetch('/api/integrations/status', { signal }, idToken);
  const root = isRecord(payload) ? payload : {};
  const source = root.providers ?? root.integrations ?? root;
  const providers: StatusSnapshot['providers'] = {};

  if (Array.isArray(source)) {
    source.forEach(item => {
      const status = normalizeConnector(item);
      if (status) providers[status.provider] = status;
    });
  } else if (isRecord(source)) {
    Object.entries(source).forEach(([providerId, item]) => {
      const status = normalizeConnector(item, providerId);
      if (status) providers[status.provider] = status;
    });
  }

  return {
    providers,
    brokerMessage: asString(root.message) ?? asString(root.brokerMessage),
  };
}

function normalizeReceipt(payload: unknown, provider: LiveProviderId, fallbackState: ConnectionState): ConnectorReceipt {
  const normalized = normalizeConnector(payload, provider);
  if (!normalized) {
    return { provider, status: fallbackState, scope: [], sample: payload };
  }
  return { ...normalized, status: normalized.status === 'configured' ? fallbackState : normalized.status };
}

export async function verifyConnector(provider: LiveProviderId, idToken?: string): Promise<ConnectorReceipt> {
  const payload = await brokerFetch(`/api/integrations/${provider}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }, idToken);
  return normalizeReceipt(payload, provider, 'verified');
}

export async function queryConnector(provider: LiveProviderId, idToken?: string): Promise<ConnectorReceipt> {
  const payload = await brokerFetch(`/api/integrations/${provider}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }, idToken);
  return normalizeReceipt(payload, provider, 'verified');
}

export function formatSafeSample(value: unknown) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value.length > 240 ? `${value.slice(0, 240)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `${value.length} sanitized record${value.length === 1 ? '' : 's'} returned.`;
  if (!isRecord(value)) return 'A sanitized sample was returned.';

  const labels: Record<string, string> = {
    kind: 'Kind',
    count: 'Count',
    latestAt: 'Latest',
    latest_at: 'Latest',
    project: 'Project',
    service: 'Service',
    table: 'Table',
    summary: 'Summary',
  };
  const safeFacts = Object.entries(labels).flatMap(([key, label]) => {
    const item = value[key];
    return typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
      ? [`${label}: ${String(item).slice(0, 160)}`]
      : [];
  });
  if (safeFacts.length) return safeFacts.join(' · ');
  if (Array.isArray(value.rows)) return `${value.rows.length} sanitized record${value.rows.length === 1 ? '' : 's'} returned.`;
  if (Array.isArray(value.items)) return `${value.items.length} sanitized item${value.items.length === 1 ? '' : 's'} returned.`;
  return 'The broker returned a sanitized sample receipt.';
}
