import type { BrokerConfig } from '../config.js';
import { upstreamJson } from '../upstream.js';
import {
  configurationError,
  firstIsoDate,
  recordsFrom,
  safeHttpBaseUrl,
} from './shared.js';
import type { Connector, ConnectorQueryResult, ConnectorReceipt } from './types.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createLangSmithConnector(config: BrokerConfig): Connector {
  const provider = 'LangSmith';
  const credentialBoundary = 'workspace credential; broker-enforced read endpoints';
  const scope = ['projects:read', 'runs:read', 'configured project only'];

  function configuration() {
    const configured = Boolean(
      config.langsmith.apiKey &&
        config.langsmith.workspaceId &&
        config.langsmith.projectId,
    );
    const valid = Boolean(
      configured &&
        UUID.test(config.langsmith.workspaceId ?? '') &&
        UUID.test(config.langsmith.projectId ?? '') &&
        safeHttpBaseUrl(config.langsmith.endpoint, { allowLocalHttp: true }),
    );
    return { configured, valid };
  }

  function settings() {
    const state = configuration();
    if (!state.configured || !state.valid) configurationError(provider);
    return {
      apiKey: config.langsmith.apiKey as string,
      workspaceId: config.langsmith.workspaceId as string,
      projectId: config.langsmith.projectId as string,
      endpoint: safeHttpBaseUrl(config.langsmith.endpoint, {
        allowLocalHttp: true,
      }) as string,
    };
  }

  function headers(apiKey: string, workspaceId: string): Record<string, string> {
    return {
      'x-api-key': apiKey,
      'x-tenant-id': workspaceId,
      accept: 'application/json',
    };
  }

  async function readConfiguredProject(limit: 1 | 5) {
    const current = settings();
    const now = new Date();
    const minimum = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
    const raw = await upstreamJson(
      `${current.endpoint}/api/v2/runs/query`,
      {
        method: 'POST',
        headers: {
          ...headers(current.apiKey, current.workspaceId),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          project_ids: [current.projectId],
          min_start_time: minimum.toISOString(),
          max_start_time: now.toISOString(),
          page_size: limit,
          selects: ['ID', 'START_TIME'],
        }),
      },
      { provider, config },
    );
    return recordsFrom(raw, ['runs', 'items', 'data']).slice(0, limit);
  }

  async function verify(): Promise<ConnectorReceipt> {
    const runs = await readConfiguredProject(1);
    return {
      provider: 'langsmith',
      status: 'verified',
      credentialBoundary,
      scope,
      sample: { kind: 'configured-project-access', count: runs.length },
      checkedAt: new Date().toISOString(),
    };
  }

  async function query(): Promise<ConnectorQueryResult> {
    const runs = await readConfiguredProject(5);
    const latestAt = firstIsoDate(runs, ['start_time', 'startTime']);
    return {
      receipt: {
        provider: 'langsmith',
        status: 'ok',
        credentialBoundary,
        scope,
        sample: {
          kind: 'recent-run-metadata',
          count: runs.length,
          ...(latestAt ? { latestAt } : {}),
        },
        checkedAt: new Date().toISOString(),
      },
    };
  }

  return {
    id: 'langsmith',
    name: provider,
    credentialBoundary,
    scope,
    configuration,
    verify,
    query,
  };
}
