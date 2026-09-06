import { PublicError } from '../errors.js';

export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function configurationError(provider: string): never {
  throw new PublicError(
    503,
    'provider_not_configured',
    `${provider} needs valid server-side connection settings before it can be verified.`,
  );
}

export function safeHttpBaseUrl(
  raw: string | undefined,
  options: { allowLocalHttp?: boolean } = {},
): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.search || url.hash) return undefined;
    if (url.protocol !== 'https:') {
      const local =
        options.allowLocalHttp &&
        url.protocol === 'http:' &&
        (url.hostname === 'localhost' ||
          url.hostname === '127.0.0.1' ||
          url.hostname === '::1');
      if (!local) return undefined;
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

export function safeSpacetimeBaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.search || url.hash) return undefined;
    if (url.protocol === 'ws:') url.protocol = 'http:';
    if (url.protocol === 'wss:') url.protocol = 'https:';
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (
      url.protocol === 'http:' &&
      url.hostname !== 'localhost' &&
      url.hostname !== '127.0.0.1' &&
      url.hostname !== '::1'
    ) {
      return undefined;
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

export function validSimpleIdentifier(value: string | undefined): value is string {
  return Boolean(value && /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(value));
}

export function validDatabaseIdentifier(value: string | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value));
}

export function validSchemaTable(value: string): boolean {
  return /^[a-z_][a-z0-9_]{0,62}\.[a-z_][a-z0-9_]{0,62}$/.test(value);
}

/** One table or a comma-separated list, e.g. public.events,public.alerts */
export function parseSchemaTables(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

export function quoteSchemaTable(value: string): string {
  const [schema, table] = value.split('.');
  if (!schema || !table || !validSchemaTable(value)) {
    throw new Error('Invalid schema-qualified table');
  }
  return `"${schema}"."${table}"`;
}

export function recordsFrom(
  value: unknown,
  candidateKeys: readonly string[],
): JsonRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  for (const key of candidateKeys) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
  }
  return [];
}

export function limitedString(value: unknown, maximum = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;
}

export function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function firstIsoDate(records: JsonRecord[], keys: readonly string[]): string | undefined {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value !== 'string') continue;
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }
  return undefined;
}

export function compactRecord(
  entries: ReadonlyArray<readonly [string, unknown]>,
): JsonRecord {
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
}

export function sanitizeJson(
  value: unknown,
  depth = 0,
): null | boolean | number | string | unknown[] | JsonRecord {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') return limitedString(value, 500) ?? '';
  if (depth >= 4) return '[nested value omitted]';
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeJson(item, depth + 1));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 30)
        .map(([key, item]) => [key.slice(0, 100), sanitizeJson(item, depth + 1)]),
    );
  }
  return String(value).slice(0, 500);
}
