import type { BrokerConfig } from '../config.js';
import { upstreamJson } from '../upstream.js';
import {
  configurationError,
  firstIsoDate,
  quoteSchemaTable,
  recordsFrom,
  safeHttpBaseUrl,
  validSchemaTable,
} from './shared.js';
import type { Connector, ConnectorQueryResult, ConnectorReceipt } from './types.js';

const PROJECT_REF = /^[a-z0-9]{8,64}$/;

export function createSupabaseConnector(config: BrokerConfig): Connector {
  const provider = 'Supabase';
  const credentialBoundary = 'provider-enforced read-only database role';
  const scope = ['project:read', 'database:read', 'configured table only'];

  function configuration() {
    const configured = Boolean(
      config.supabase.accessToken &&
        config.supabase.projectRef &&
        config.supabase.sourceTable,
    );
    const valid = Boolean(
      configured &&
        PROJECT_REF.test(config.supabase.projectRef ?? '') &&
        validSchemaTable(config.supabase.sourceTable) &&
        safeHttpBaseUrl(config.supabase.baseUrl),
    );
    return { configured, valid };
  }

  function settings() {
    const state = configuration();
    if (!state.configured || !state.valid) configurationError(provider);
    return {
      token: config.supabase.accessToken as string,
      projectRef: config.supabase.projectRef as string,
      table: config.supabase.sourceTable,
      baseUrl: safeHttpBaseUrl(config.supabase.baseUrl) as string,
    };
  }

  function headers(token: string): Record<string, string> {
    return {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
    };
  }

  async function readConfiguredTable(
    limit: 1 | 5,
    includeTimestamp: boolean,
  ) {
    const current = settings();
    const table = quoteSchemaTable(current.table);
    const projection = includeTimestamp ? '"occurred_at"' : '1 as "reachable"';
    const ordering = includeTimestamp ? ' order by "occurred_at" desc' : '';
    const raw = await upstreamJson(
      `${current.baseUrl}/v1/projects/${encodeURIComponent(current.projectRef)}/database/query/read-only`,
      {
        method: 'POST',
        headers: {
          ...headers(current.token),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          query: `select ${projection} from ${table}${ordering} limit $1`,
          parameters: [limit],
        }),
      },
      { provider, config, acceptedStatuses: [200, 201] },
    );
    return recordsFrom(raw, ['result', 'data', 'rows']).slice(0, limit);
  }

  async function verify(): Promise<ConnectorReceipt> {
    const rows = await readConfiguredTable(1, false);
    return {
      provider: 'supabase',
      status: 'verified',
      credentialBoundary,
      scope,
      sample: { kind: 'configured-table-access', count: rows.length },
      checkedAt: new Date().toISOString(),
    };
  }

  async function query(): Promise<ConnectorQueryResult> {
    const rows = await readConfiguredTable(5, true);
    const latestAt = firstIsoDate(rows, ['occurred_at']);
    return {
      receipt: {
        provider: 'supabase',
        status: 'ok',
        credentialBoundary,
        scope,
        sample: {
          kind: 'recent-events',
          count: rows.length,
          ...(latestAt ? { latestAt } : {}),
        },
        checkedAt: new Date().toISOString(),
      },
    };
  }

  return {
    id: 'supabase',
    name: provider,
    credentialBoundary,
    scope,
    configuration,
    verify,
    query,
  };
}
