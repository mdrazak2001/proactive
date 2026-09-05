import type { IncomingMessage } from 'node:http';
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';
import type { BrokerConfig } from './config.js';
import { PublicError } from './errors.js';
import { upstreamJson } from './upstream.js';

interface OidcDiscoveryDocument {
  issuer: string;
  jwks_uri: string;
}

export interface BrokerPrincipal {
  subject: string;
  mode: 'oidc' | 'local-development';
  claims?: JWTPayload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeIssuer(value: string): string {
  return value.replace(/\/+$/, '');
}

function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  const normalized = address.toLowerCase();
  return (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '::ffff:127.0.0.1'
  );
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function hasOnlyLoopbackRequestMetadata(request: IncomingMessage): boolean {
  if (
    request.headers.forwarded ||
    request.headers['x-forwarded-for'] ||
    request.headers['x-forwarded-host'] ||
    request.headers['x-forwarded-proto']
  ) {
    return false;
  }

  const host = request.headers.host;
  try {
    if (host && !isLoopbackHostname(new URL(`http://${host}`).hostname)) return false;
    const origin = request.headers.origin;
    return !origin || isLoopbackHostname(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function parseBearer(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const match = /^Bearer ([A-Za-z0-9_~+./=-]+)$/.exec(header);
  return match?.[1];
}

function isSafeJwksUrl(url: URL, config: BrokerConfig): boolean {
  if (url.protocol === 'https:') return true;
  return (
    config.nodeEnv !== 'production' &&
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1')
  );
}

export function createAuthorizer(config: BrokerConfig): {
  authorize(request: IncomingMessage): Promise<BrokerPrincipal>;
} {
  if (
    config.nodeEnv === 'production' &&
    config.allowedSubjects.length === 0 &&
    config.allowedEmails.length === 0
  ) {
    throw new Error(
      'Production requires BROKER_ALLOWED_SUBJECTS or BROKER_ALLOWED_EMAILS for the single-workspace broker.',
    );
  }

  const allowedSubjects = new Set(config.allowedSubjects);
  const allowedEmails = new Set(config.allowedEmails);
  let keyResolverPromise: Promise<JWTVerifyGetKey> | undefined;

  async function getKeyResolver(): Promise<JWTVerifyGetKey> {
    if (!keyResolverPromise) {
      keyResolverPromise = (async () => {
        const issuer = normalizeIssuer(config.oidc.issuer);
        let discoveryUrl: URL;
        try {
          discoveryUrl = new URL(`${issuer}/.well-known/openid-configuration`);
        } catch {
          throw new PublicError(
            503,
            'oidc_configuration_invalid',
            'The broker OIDC issuer is not a valid URL.',
          );
        }

        const raw = await upstreamJson(
          discoveryUrl.toString(),
          { method: 'GET', headers: { accept: 'application/json' } },
          { provider: 'SpacetimeAuth', config },
        );
        if (
          !isRecord(raw) ||
          typeof raw.issuer !== 'string' ||
          typeof raw.jwks_uri !== 'string'
        ) {
          throw new PublicError(
            503,
            'oidc_discovery_invalid',
            'SpacetimeAuth returned an invalid discovery document.',
          );
        }

        const discovery: OidcDiscoveryDocument = {
          issuer: normalizeIssuer(raw.issuer),
          jwks_uri: raw.jwks_uri,
        };
        if (discovery.issuer !== issuer) {
          throw new PublicError(
            503,
            'oidc_issuer_mismatch',
            'SpacetimeAuth discovery did not match the configured issuer.',
          );
        }

        const jwksUrl = new URL(discovery.jwks_uri);
        if (!isSafeJwksUrl(jwksUrl, config)) {
          throw new PublicError(
            503,
            'oidc_jwks_url_rejected',
            'The broker rejected the configured OIDC key endpoint.',
          );
        }

        return createRemoteJWKSet(jwksUrl, {
          timeoutDuration: config.upstreamTimeoutMs,
          cooldownDuration: 30_000,
        });
      })().catch((error: unknown) => {
        keyResolverPromise = undefined;
        throw error;
      });
    }
    return keyResolverPromise;
  }

  async function authorize(request: IncomingMessage): Promise<BrokerPrincipal> {
    const token = parseBearer(request.headers.authorization);
    const localBypassAllowed =
      config.allowUnauthenticatedLocal &&
      config.nodeEnv !== 'production' &&
      isLoopbackHostname(config.host) &&
      isLoopbackAddress(request.socket.remoteAddress) &&
      hasOnlyLoopbackRequestMetadata(request);

    if (!token && localBypassAllowed) {
      return { subject: 'local-development', mode: 'local-development' };
    }
    if (!config.oidc.clientId) {
      throw new PublicError(
        503,
        'oidc_not_configured',
        'Application login must be configured before the connector broker can be used.',
      );
    }
    if (!token) {
      throw new PublicError(401, 'authentication_required', 'Sign in before using integrations.');
    }

    try {
      const keys = await getKeyResolver();
      const result = await jwtVerify(token, keys, {
        issuer: normalizeIssuer(config.oidc.issuer),
        audience: config.oidc.clientId,
        requiredClaims: ['sub', 'exp', 'iat'],
      });
      if (!result.payload.sub) {
        throw new Error('Missing subject');
      }
      if (
        Array.isArray(result.payload.aud) &&
        result.payload.aud.length > 1 &&
        result.payload.azp !== config.oidc.clientId
      ) {
        throw new Error('Invalid authorized party');
      }

      const email =
        typeof result.payload.email === 'string'
          ? result.payload.email.trim().toLowerCase()
          : undefined;
      const allowlistConfigured =
        allowedSubjects.size > 0 || allowedEmails.size > 0;
      const subjectAllowed = allowedSubjects.has(result.payload.sub);
      const emailAllowed = Boolean(
        email &&
          result.payload.email_verified === true &&
          allowedEmails.has(email),
      );
      if (allowlistConfigured && !subjectAllowed && !emailAllowed) {
        throw new PublicError(
          403,
          'workspace_access_denied',
          'This identity is not permitted to use this private workspace.',
        );
      }
      return {
        subject: result.payload.sub,
        mode: 'oidc',
        claims: result.payload,
      };
    } catch (error) {
      if (error instanceof PublicError) throw error;
      throw new PublicError(
        401,
        'invalid_identity_token',
        'The application identity token is invalid or expired.',
      );
    }
  }

  return { authorize };
}
