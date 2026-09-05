import type { BrokerConfig } from '../config.js';
import { createBrowserbaseConnector } from './browserbase.js';
import { createLangSmithConnector } from './langsmith.js';
import { createSpacetimeConnector } from './spacetime.js';
import { createSupabaseConnector } from './supabase.js';
import { createSupermemoryConnector } from './supermemory.js';
import type { Connector, ProviderId } from './types.js';

export function createConnectors(config: BrokerConfig): Map<ProviderId, Connector> {
  const connectors = [
    createSupabaseConnector(config),
    createLangSmithConnector(config),
    createSupermemoryConnector(config),
    createSpacetimeConnector(config),
    createBrowserbaseConnector(config),
  ];
  return new Map(connectors.map((connector) => [connector.id, connector]));
}

export * from './types.js';
