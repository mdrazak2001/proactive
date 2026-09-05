import type { BrokerConfig } from '../config.js';
import { upstreamJson } from '../upstream.js';
import {
  configurationError,
  firstIsoDate,
  recordsFrom,
  safeHttpBaseUrl,
} from './shared.js';
import type { Connector, ConnectorQueryResult, ConnectorReceipt } from './types.js';

const CONTAINER_TAG = /^[A-Za-z0-9_:-]{1,100}$/;

export function createSupermemoryConnector(config: BrokerConfig): Connector {
  const provider = 'Supermemory';
  const credentialBoundary =
    'container-scoped credential expected; broker-enforced read endpoints';
  const scope = ['documents:list', 'search:read', 'configured container only'];

  function configuration() {
    const configured = Boolean(
      config.supermemory.apiKey && config.supermemory.containerTag,
    );
    const queryLength = config.supermemory.sampleQuery.length;
    const valid = Boolean(
      configured &&
        CONTAINER_TAG.test(config.supermemory.containerTag ?? '') &&
        queryLength >= 1 &&
        queryLength <= 500 &&
        safeHttpBaseUrl(config.supermemory.baseUrl),
    );
    return { configured, valid };
  }

  function settings() {
    const state = configuration();
    if (!state.configured || !state.valid) configurationError(provider);
    return {
      apiKey: config.supermemory.apiKey as string,
      containerTag: config.supermemory.containerTag as string,
      baseUrl: safeHttpBaseUrl(config.supermemory.baseUrl) as string,
      sampleQuery: config.supermemory.sampleQuery,
    };
  }

  function headers(apiKey: string): Record<string, string> {
    return {
      authorization: `Bearer ${apiKey}`,
      accept: 'application/json',
      'content-type': 'application/json',
    };
  }

  async function verify(): Promise<ConnectorReceipt> {
    const current = settings();
    const raw = await upstreamJson(
      `${current.baseUrl}/v3/documents/list`,
      {
        method: 'POST',
        headers: headers(current.apiKey),
        body: JSON.stringify({
          containerTags: [current.containerTag],
          limit: 1,
          page: 1,
          includeContent: false,
          sort: 'createdAt',
          order: 'desc',
        }),
      },
      { provider, config },
    );
    const documents = recordsFrom(raw, ['memories', 'documents', 'items']);
    return {
      provider: 'supermemory',
      status: 'verified',
      credentialBoundary,
      scope,
      sample: { kind: 'container-access', count: documents.length },
      checkedAt: new Date().toISOString(),
    };
  }

  async function query(): Promise<ConnectorQueryResult> {
    const current = settings();
    const raw = await upstreamJson(
      `${current.baseUrl}/v4/search`,
      {
        method: 'POST',
        headers: headers(current.apiKey),
        body: JSON.stringify({
          q: current.sampleQuery,
          containerTag: current.containerTag,
          limit: 5,
          searchMode: 'hybrid',
          rerank: false,
          aggregate: false,
          rewriteQuery: false,
        }),
      },
      { provider, config },
    );
    const results = recordsFrom(raw, ['results', 'items', 'data']).slice(0, 5);
    const latestAt = firstIsoDate(results, ['updatedAt', 'updated_at', 'createdAt']);
    return {
      receipt: {
        provider: 'supermemory',
        status: 'ok',
        credentialBoundary,
        scope,
        sample: {
          kind: 'container-search',
          count: results.length,
          ...(latestAt ? { latestAt } : {}),
        },
        checkedAt: new Date().toISOString(),
      },
    };
  }

  return {
    id: 'supermemory',
    name: provider,
    credentialBoundary,
    scope,
    configuration,
    verify,
    query,
  };
}
