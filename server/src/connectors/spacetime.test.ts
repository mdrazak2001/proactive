import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { connectorCallContext } from './call-context.js';
import { createSpacetimeConnector } from './spacetime.js';
import { jsonResponse, testConfig } from './test-config.js';

const originalFetch = globalThis.fetch;
const calls: Array<{ url: string; init?: RequestInit }> = [];

afterEach(() => {
  globalThis.fetch = originalFetch;
  calls.length = 0;
});

test('spacetimedb reuses the existing Maincloud database and table defaults', () => {
  const connector = createSpacetimeConnector(
    testConfig({
      VITE_SPACETIMEDB_HOST: 'https://maincloud.spacetimedb.com',
      VITE_SPACETIMEDB_DB_NAME: 'proactive',
    }),
  );
  assert.deepEqual(connector.configuration(), { configured: true, valid: true });
});

test('spacetimedb forwards the caller SpacetimeAuth bearer token', async () => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return jsonResponse(200, [{ rows: [[1]] }]);
  }) as typeof fetch;

  const connector = createSpacetimeConnector(
    testConfig({
      SPACETIME_SOURCE_HOST: 'https://maincloud.spacetimedb.com',
      SPACETIME_SOURCE_DATABASE: 'proactive',
      SPACETIME_SOURCE_TABLE: 'incident_room',
    }),
  );

  const receipt = await connectorCallContext.run(
    { bearerToken: 'eyJhbGciOiJIUzI1NiJ9.e30.signature' },
    () => connector.verify(),
  );

  assert.equal(receipt.provider, 'spacetimedb');
  assert.equal(receipt.sample.kind, 'configured-table-access');
  assert.equal(
    (calls[0]?.init?.headers as Record<string, string>).authorization,
    'Bearer eyJhbGciOiJIUzI1NiJ9.e30.signature',
  );
  assert.match(calls[0]?.url ?? '', /\/v1\/database\/proactive\/sql$/);
});
