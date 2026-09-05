import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createBrowserbaseConnector } from './browserbase.js';
import { testConfig, jsonResponse } from './test-config.js';

const originalFetch = globalThis.fetch;
const calls: Array<{ url: string; init?: RequestInit }> = [];

afterEach(() => {
  globalThis.fetch = originalFetch;
  calls.length = 0;
});

function mockFetch(handler: (url: string, init?: RequestInit) => Response) {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
}

test('browserbase is not configured without project credentials', () => {
  const connector = createBrowserbaseConnector(testConfig());
  assert.deepEqual(connector.configuration(), { configured: false, valid: false });
});

test('verify lists sessions with the Browserbase API key', async () => {
  mockFetch(() => jsonResponse(200, { sessions: [] }));
  const connector = createBrowserbaseConnector(
    testConfig({
      BROWSERBASE_API_KEY: 'bb_test_key',
      BROWSERBASE_PROJECT_ID: 'proj_live_view',
    }),
  );

  const receipt = await connector.verify();

  assert.equal(receipt.provider, 'browserbase');
  assert.equal(receipt.status, 'verified');
  assert.equal(receipt.sample.kind, 'project-session-access');
  assert.equal(calls.length, 1);
  assert.match(calls[0]?.url ?? '', /\/v1\/sessions$/);
  assert.equal(
    (calls[0]?.init?.headers as Record<string, string>)['X-BB-API-Key'],
    'bb_test_key',
  );
});

test('query creates a session and returns a live view url', async () => {
  mockFetch((url) => {
    if (url.endsWith('/v1/sessions')) {
      return jsonResponse(201, {
        id: 'sess_123',
        connectUrl: 'wss://connect.browserbase.com/debug/sess_123',
      });
    }
    if (url.endsWith('/v1/sessions/sess_123/debug')) {
      return jsonResponse(200, {
        debuggerFullscreenUrl: 'https://www.browserbase.com/devtools-fullscreen/sess_123',
        debuggerUrl: 'https://www.browserbase.com/devtools/sess_123',
        pages: [],
        wsUrl: 'wss://connect.browserbase.com/debug/sess_123',
      });
    }
    return jsonResponse(500, { error: 'unexpected' });
  });

  const connector = createBrowserbaseConnector(
    testConfig({
      BROWSERBASE_API_KEY: 'bb_test_key',
      BROWSERBASE_PROJECT_ID: 'proj_live_view',
    }),
  );

  const result = await connector.query();

  assert.equal(result.receipt.provider, 'browserbase');
  assert.equal(result.receipt.sample.kind, 'live-view-session');
  assert.equal(result.receipt.sample.sessionId, 'sess_123');
  assert.equal(
    result.receipt.sample.liveViewUrl,
    'https://www.browserbase.com/devtools-fullscreen/sess_123',
  );
  assert.equal(calls.length, 2);
  const createBody = JSON.parse(String(calls[0]?.init?.body ?? '{}')) as {
    projectId?: string;
  };
  assert.equal(createBody.projectId, 'proj_live_view');
});
