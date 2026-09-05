import { createServer } from 'node:http';
import { loadConfig } from './config.js';
import { handleBrokerRequest } from './handler.js';

const config = loadConfig();
const server = createServer((request, response) => {
  void handleBrokerRequest(request, response);
});

server.listen(config.port, config.host, () => {
  console.log(
    `[connector-broker] listening on http://${config.host}:${config.port} (${config.nodeEnv})`,
  );
  if (config.allowUnauthenticatedLocal && config.nodeEnv !== 'production') {
    console.warn('[connector-broker] local unauthenticated development mode is enabled');
  }
});

function closeServer(): void {
  server.close(() => process.exit(0));
}

process.once('SIGINT', closeServer);
process.once('SIGTERM', closeServer);
