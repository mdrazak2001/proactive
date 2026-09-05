import { AsyncLocalStorage } from 'node:async_hooks';

export interface ConnectorCallContext {
  bearerToken?: string;
}

export const connectorCallContext = new AsyncLocalStorage<ConnectorCallContext>();

export function currentBearerToken(): string | undefined {
  return connectorCallContext.getStore()?.bearerToken;
}
