import { loadConfig, type BrokerConfig } from '../config.js';

export function testConfig(env: NodeJS.ProcessEnv = {}): BrokerConfig {
  return loadConfig(
    {
      NODE_ENV: 'development',
      ...env,
    },
    [],
  );
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
