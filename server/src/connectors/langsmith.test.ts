import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLangSmithConnector } from './langsmith.js';
import { testConfig } from './test-config.js';

test('langsmith stays unconfigured without a workspace-scoped key', () => {
  const connector = createLangSmithConnector(testConfig());
  assert.deepEqual(connector.configuration(), { configured: false, valid: false });
});

test('langsmith requires workspace and project UUIDs, not display names', () => {
  const named = createLangSmithConnector(
    testConfig({
      LANGSMITH_API_KEY: 'lsv2_sk_test',
      LANGSMITH_WORKSPACE_ID: 'my-workspace',
      LANGSMITH_SOURCE_PROJECT_ID: 'proactive-demo',
    }),
  );
  assert.equal(named.configuration().configured, true);
  assert.equal(named.configuration().valid, false);

  const uuids = createLangSmithConnector(
    testConfig({
      LANGSMITH_API_KEY: 'lsv2_sk_test',
      LANGSMITH_WORKSPACE_ID: '11111111-1111-4111-8111-111111111111',
      LANGSMITH_SOURCE_PROJECT_ID: '22222222-2222-4222-8222-222222222222',
    }),
  );
  assert.deepEqual(uuids.configuration(), { configured: true, valid: true });
});
