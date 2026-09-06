import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSupabaseConnector } from './supabase.js';
import { testConfig } from './test-config.js';

test('supabase stays unconfigured until the management token and project ref exist', () => {
  const connector = createSupabaseConnector(testConfig());
  assert.deepEqual(connector.configuration(), { configured: false, valid: false });
});

test('supabase rejects a service-role-shaped project ref and accepts a hosted ref', () => {
  const invalid = createSupabaseConnector(
    testConfig({
      SUPABASE_ACCESS_TOKEN: 'sbp_test',
      SUPABASE_PROJECT_REF: 'NOT A REF',
    }),
  );
  assert.equal(invalid.configuration().configured, true);
  assert.equal(invalid.configuration().valid, false);

  const valid = createSupabaseConnector(
    testConfig({
      SUPABASE_ACCESS_TOKEN: 'sbp_test',
      SUPABASE_PROJECT_REF: 'tzjrmgrthhpcssljvgmc',
      SUPABASE_SOURCE_TABLE: 'public.proactive_events,public.incident_notes',
    }),
  );
  assert.deepEqual(valid.configuration(), { configured: true, valid: true });
});
