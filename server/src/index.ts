import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createAuthorizer } from './auth.js';
import { loadConfig } from './config.js';
import {
  createConnectors,
  providerIds,
  type Connector,
  type ProviderId,
  type SafeProviderStatus,
  type SampleSummary,
} from './connectors/index.js';
import { loadLocalEnvironment } from './environment.js';
import { asPublicError, PublicError } from './errors.js';
import { createPrincipalLimiter } from './limits.js';

loadLocalEnvironment();

const config = loadConfig();
const connectors = createConnectors(config);
const authorizer = createAuthorizer(config);
const principalLimiter = createPrincipalLimiter();
const frontendRoot = resolve(fileURLToPath(new URL('../../dist/', import.meta.url)));
const frontendIndex = resolve(frontendRoot, 'index.html');

interface LastCheck {
  status: 'verified' | 'error';
  checkedAt: string;
  message: string;
  sample?: SampleSummary;
}

const lastChecks = new Map<ProviderId, LastCheck>();

function securityHeaders(): Record<string, string> {
  return {
    'cache-control': 'no-store, max-age=0',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  };
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  value: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    ...securityHeaders(),
    ...extraHeaders,
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body).toString(),
  });
  response.end(body);
}

function contentType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8';
    case '.json':
    case '.map':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.avif':
      return 'image/avif';
    case '.ico':
      return 'image/x-icon';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    case '.txt':
      return 'text/plain; charset=utf-8';
    case '.xml':
      return 'application/xml; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

function resolveFrontendRequestPath(pathname: string): string {
  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    throw new PublicError(400, 'invalid_path', 'The request path is not valid.');
  }

  if (decodedPathname.includes('\0')) {
    throw new PublicError(400, 'invalid_path', 'The request path is not valid.');
  }

  const candidate = resolve(frontendRoot, `.${decodedPathname}`);
  const relativePath = relative(frontendRoot, candidate);
  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new PublicError(400, 'invalid_path', 'The request path is not valid.');
  }
  return candidate;
}

async function regularFile(filePath: string): Promise<{ size: number } | undefined> {
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile() ? { size: fileStat.size } : undefined;
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    if (code === 'ENOENT' || code === 'ENOTDIR') return undefined;
    throw error;
  }
}

async function serveFrontend(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): Promise<void> {
  const requestedPath = resolveFrontendRequestPath(pathname);
  const requestedFile = await regularFile(requestedPath);
  const filePath = requestedFile ? requestedPath : frontendIndex;
  const file = requestedFile ?? (await regularFile(frontendIndex));
  if (!file) {
    throw new PublicError(
      503,
      'frontend_not_built',
      'The application frontend is not available. Run the production build first.',
    );
  }

  const immutableAsset = relative(frontendRoot, filePath).startsWith(`assets${sep}`);
  response.writeHead(200, {
    'cache-control': immutableAsset
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
    'content-length': file.size.toString(),
    'content-security-policy': "base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
    'content-type': contentType(filePath),
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  await pipeline(createReadStream(filePath), response);
}

async function acceptEmptyJsonBody(request: IncomingMessage): Promise<void> {
  const declaredLength = Number.parseInt(request.headers['content-length'] ?? '0', 10);
  if (Number.isFinite(declaredLength) && declaredLength > config.requestBodyLimitBytes) {
    request.resume();
    throw new PublicError(413, 'request_too_large', 'The request body exceeds the broker limit.');
  }

  const chunks: Buffer[] = [];
  let byteLength = 0;
  for await (const rawChunk of request) {
    const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
    byteLength += chunk.byteLength;
    if (byteLength > config.requestBodyLimitBytes) {
      throw new PublicError(413, 'request_too_large', 'The request body exceeds the broker limit.');
    }
    chunks.push(chunk);
  }

  if (byteLength === 0) return;
  const contentType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new PublicError(415, 'unsupported_media_type', 'POST requests accept JSON only.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks, byteLength).toString('utf8')) as unknown;
  } catch {
    throw new PublicError(400, 'invalid_json', 'The request body is not valid JSON.');
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.keys(parsed).length > 0
  ) {
    throw new PublicError(
      400,
      'unsupported_input',
      'This endpoint runs a fixed read-only check and accepts only an empty object.',
    );
  }
}

function providerStatus(connector: Connector): SafeProviderStatus {
  const state = connector.configuration();
  const checked = lastChecks.get(connector.id);
  if (!state.configured) {
    return {
      provider: connector.id,
      id: connector.id,
      name: connector.name,
      configured: false,
      status: 'not_configured',
      credentialBoundary: connector.credentialBoundary,
      scope: connector.scope,
      message: 'Add the server-side connection settings to verify this provider.',
    };
  }
  if (!state.valid) {
    return {
      provider: connector.id,
      id: connector.id,
      name: connector.name,
      configured: true,
      status: 'error',
      credentialBoundary: connector.credentialBoundary,
      scope: connector.scope,
      message: 'One or more server-side connection settings are invalid.',
    };
  }
  if (checked) {
    return {
      provider: connector.id,
      id: connector.id,
      name: connector.name,
      configured: true,
      status: checked.status,
      credentialBoundary: connector.credentialBoundary,
      scope: connector.scope,
      checkedAt: checked.checkedAt,
      message: checked.message,
      ...(checked.sample ? { sample: checked.sample } : {}),
    };
  }
  return {
    provider: connector.id,
    id: connector.id,
    name: connector.name,
    configured: true,
    status: 'configured',
    credentialBoundary: connector.credentialBoundary,
    scope: connector.scope,
    message: 'Server-side settings are present. Run verification to prove access.',
  };
}

function parseProvider(value: string): ProviderId | undefined {
  return providerIds.find((provider) => provider === value);
}

async function runConnectorOperation(
  connector: Connector,
  operation: 'verify' | 'query',
  response: ServerResponse,
): Promise<void> {
  try {
    if (operation === 'verify') {
      const receipt = await connector.verify();
      lastChecks.set(connector.id, {
        status: 'verified',
        checkedAt: receipt.checkedAt,
        message: 'Read-only access verified.',
        sample: receipt.sample,
      });
      writeJson(response, 200, receipt);
      return;
    }

    const result = await connector.query();
    lastChecks.set(connector.id, {
      status: 'verified',
      checkedAt: result.receipt.checkedAt,
      message: 'Read-only access verified with a bounded sample.',
      sample: result.receipt.sample,
    });
    writeJson(response, 200, result);
  } catch (error) {
    const publicError = asPublicError(error);
    lastChecks.set(connector.id, {
      status: 'error',
      checkedAt: new Date().toISOString(),
      message: publicError.message,
    });
    throw publicError;
  }
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const method = request.method ?? '';
  const url = new URL(request.url ?? '/', 'http://connector-broker.local');
  const isApiPath = url.pathname === '/api' || url.pathname.startsWith('/api/');
  if (!isApiPath) {
    if (config.nodeEnv === 'production' && (method === 'GET' || method === 'HEAD')) {
      await serveFrontend(request, response, url.pathname);
      return;
    }
    throw new PublicError(404, 'route_not_found', 'The requested route does not exist.');
  }

  if (url.search || url.hash) {
    throw new PublicError(400, 'query_parameters_rejected', 'This endpoint does not accept query parameters.');
  }

  if (url.pathname === '/api/integrations/status') {
    if (method !== 'GET') {
      throw new PublicError(405, 'method_not_allowed', 'This route accepts GET only.');
    }
    await authorizer.authorize(request);
    writeJson(response, 200, {
      providers: providerIds.map((id) => providerStatus(connectors.get(id) as Connector)),
    });
    return;
  }

  const operationMatch = /^\/api\/integrations\/([a-z0-9]+)\/(verify|query)$/.exec(
    url.pathname,
  );
  if (operationMatch) {
    if (method !== 'POST') {
      throw new PublicError(405, 'method_not_allowed', 'This route accepts POST only.');
    }
    const providerId = parseProvider(operationMatch[1] ?? '');
    if (!providerId) {
      throw new PublicError(404, 'provider_not_found', 'That integration is not available.');
    }
    const principal = await authorizer.authorize(request);
    await acceptEmptyJsonBody(request);
    const connector = connectors.get(providerId) as Connector;
    await principalLimiter.run(
      principal,
      () =>
        runConnectorOperation(
          connector,
          operationMatch[2] === 'verify' ? 'verify' : 'query',
          response,
        ),
    );
    return;
  }

  throw new PublicError(404, 'route_not_found', 'The requested broker route does not exist.');
}

const server = createServer((request, response) => {
  void handle(request, response).catch((error: unknown) => {
    const publicError = asPublicError(error);
    console.warn('[connector-broker] request rejected', {
      method: request.method,
      route: routeLabel(request.url),
      statusCode: publicError.statusCode,
      code: publicError.code,
    });
    if (!response.headersSent) {
      const path = request.url?.split('?', 1)[0] ?? '';
      const allowedMethod =
        publicError.statusCode === 405
          ? path === '/api/integrations/status'
            ? 'GET'
            : 'POST'
          : undefined;
      writeJson(
        response,
        publicError.statusCode,
        { error: { code: publicError.code, message: publicError.message } },
        allowedMethod ? { allow: allowedMethod } : {},
      );
    } else {
      response.end();
    }
  });
});

function routeLabel(rawUrl: string | undefined): string {
  const path = rawUrl?.split('?', 1)[0];
  if (path === '/api/integrations/status') return 'integration-status';
  if (/^\/api\/integrations\/[a-z0-9]+\/(verify|query)$/.test(path ?? '')) {
    return 'integration-operation';
  }
  return 'unknown';
}

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
