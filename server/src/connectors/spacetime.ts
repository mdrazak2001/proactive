import type { BrokerConfig } from '../config.js';
import { upstreamJson } from '../upstream.js';
import {
  configurationError,
  isRecord,
  safeSpacetimeBaseUrl,
  validDatabaseIdentifier,
  validSimpleIdentifier,
} from './shared.js';
import type { Connector, ConnectorQueryResult, ConnectorReceipt } from './types.js';

export function createSpacetimeConnector(config: BrokerConfig): Connector {
  const provider = 'SpacetimeDB source';
  const credentialBoundary =
    'curated table access; broker-enforced SELECT-only query';
  const scope = ['sql:select', 'configured table only'];

  function configuration() {
    const configured = Boolean(
      config.spacetime.host &&
        config.spacetime.database &&
        config.spacetime.sourceTable,
    );
    const valid = Boolean(
      configured &&
        safeSpacetimeBaseUrl(config.spacetime.host) &&
        validDatabaseIdentifier(config.spacetime.database) &&
        validSimpleIdentifier(config.spacetime.sourceTable),
    );
    return { configured, valid };
  }

  function settings() {
    const state = configuration();
    if (!state.configured || !state.valid) configurationError(provider);
    return {
      host: safeSpacetimeBaseUrl(config.spacetime.host) as string,
      database: config.spacetime.database as string,
      table: config.spacetime.sourceTable as string,
      token: config.spacetime.token,
    };
  }

  function headers(token: string | undefined): Record<string, string> {
    return token ? { authorization: `Bearer ${token}` } : {};
  }

  async function readConfiguredTable(limit: 1 | 5): Promise<unknown[]> {
    const current = settings();
    const raw = await upstreamJson(
      `${current.host}/v1/database/${encodeURIComponent(current.database)}/sql`,
      {
        method: 'POST',
        headers: {
          ...headers(current.token),
          accept: 'application/json',
          'content-type': 'text/plain; charset=utf-8',
        },
        body: `SELECT 1 FROM ${current.table} LIMIT ${limit}`,
      },
      { provider, config },
    );
    const statement = Array.isArray(raw) ? raw.find(isRecord) : undefined;
    return statement && Array.isArray(statement.rows)
      ? statement.rows.slice(0, limit)
      : [];
  }

  async function verify(): Promise<ConnectorReceipt> {
    const rows = await readConfiguredTable(1);
    return {
      provider: 'spacetimedb',
      status: 'verified',
      credentialBoundary,
      scope,
      sample: { kind: 'configured-table-access', count: rows.length },
      checkedAt: new Date().toISOString(),
    };
  }

  async function query(): Promise<ConnectorQueryResult> {
    const rows = await readConfiguredTable(5);
    return {
      receipt: {
        provider: 'spacetimedb',
        status: 'ok',
        credentialBoundary,
        scope,
        sample: { kind: 'curated-table-rows', count: rows.length },
        checkedAt: new Date().toISOString(),
      },
    };
  }

  return {
    id: 'spacetimedb',
    name: 'SpacetimeDB',
    credentialBoundary,
    scope,
    configuration,
    verify,
    query,
  };
}
