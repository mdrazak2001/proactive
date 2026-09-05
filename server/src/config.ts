export interface BrokerConfig {
  host: string;
  port: number;
  nodeEnv: string;
  allowUnauthenticatedLocal: boolean;
  allowedSubjects: readonly string[];
  allowedEmails: readonly string[];
  requestBodyLimitBytes: number;
  upstreamResponseLimitBytes: number;
  upstreamTimeoutMs: number;
  oidc: {
    issuer: string;
    clientId?: string;
  };
  supabase: {
    accessToken?: string;
    projectRef?: string;
    sourceTable: string;
    baseUrl: string;
  };
  langsmith: {
    apiKey?: string;
    workspaceId?: string;
    projectId?: string;
    endpoint: string;
  };
  supermemory: {
    apiKey?: string;
    containerTag?: string;
    baseUrl: string;
    sampleQuery: string;
  };
  spacetime: {
    host?: string;
    database?: string;
    sourceTable?: string;
    token?: string;
  };
  browserbase: {
    apiKey?: string;
    projectId?: string;
    baseUrl: string;
  };
  computer: {
    openAiApiKey?: string;
    model: string;
    startUrl: string;
    allowedOrigins: readonly string[];
    maxSteps: number;
    timeoutMs: number;
  };
}

function optional(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function integerInRange(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= minimum && value <= maximum
    ? value
    : fallback;
}

function booleanValue(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase() === 'true';
}

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function commaSeparated(raw: string | undefined, normalize = false): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => (normalize ? value.toLowerCase() : value)),
    ),
  ];
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  argv: readonly string[] = process.argv,
): BrokerConfig {
  const nodeEnv = (
    argv.includes('--production')
      ? 'production'
      : (optional(env, 'NODE_ENV') ?? 'development')
  ).toLowerCase();
  const clientId =
    optional(env, 'BROKER_OIDC_CLIENT_ID') ?? optional(env, 'VITE_OIDC_CLIENT_ID');
  const issuer = withoutTrailingSlash(
    optional(env, 'BROKER_OIDC_ISSUER') ??
      optional(env, 'VITE_OIDC_AUTHORITY') ??
      'https://auth.spacetimedb.com/oidc',
  );

  return {
    host:
      optional(env, 'BROKER_HOST') ??
      (nodeEnv === 'production' ? '0.0.0.0' : '127.0.0.1'),
    port: integerInRange(
      optional(env, 'PORT') ?? optional(env, 'BROKER_PORT'),
      8787,
      1,
      65_535,
    ),
    nodeEnv,
    allowUnauthenticatedLocal: booleanValue(
      optional(env, 'BROKER_ALLOW_UNAUTHENTICATED_LOCAL'),
    ),
    allowedSubjects: commaSeparated(optional(env, 'BROKER_ALLOWED_SUBJECTS')),
    allowedEmails: commaSeparated(
      optional(env, 'BROKER_ALLOWED_EMAILS'),
      true,
    ),
    requestBodyLimitBytes: integerInRange(
      optional(env, 'BROKER_BODY_LIMIT_BYTES'),
      4_096,
      512,
      65_536,
    ),
    upstreamResponseLimitBytes: integerInRange(
      optional(env, 'BROKER_UPSTREAM_RESPONSE_LIMIT_BYTES'),
      1_048_576,
      32_768,
      5_242_880,
    ),
    upstreamTimeoutMs: integerInRange(
      optional(env, 'BROKER_UPSTREAM_TIMEOUT_MS'),
      10_000,
      1_000,
      30_000,
    ),
    oidc: { issuer, clientId },
    supabase: {
      accessToken: optional(env, 'SUPABASE_ACCESS_TOKEN'),
      projectRef: optional(env, 'SUPABASE_PROJECT_REF'),
      sourceTable:
        optional(env, 'SUPABASE_SOURCE_TABLE') ?? 'public.proactive_events',
      baseUrl: withoutTrailingSlash(
        optional(env, 'SUPABASE_MANAGEMENT_API_URL') ?? 'https://api.supabase.com',
      ),
    },
    langsmith: {
      apiKey: optional(env, 'LANGSMITH_API_KEY'),
      workspaceId:
        optional(env, 'LANGSMITH_WORKSPACE_ID') ?? optional(env, 'LANGSMITH_TENANT_ID'),
      projectId:
        optional(env, 'LANGSMITH_SOURCE_PROJECT_ID') ??
        optional(env, 'LANGSMITH_PROJECT_ID'),
      endpoint: withoutTrailingSlash(
        optional(env, 'LANGSMITH_ENDPOINT') ?? 'https://api.smith.langchain.com',
      ),
    },
    supermemory: {
      apiKey: optional(env, 'SUPERMEMORY_API_KEY'),
      containerTag: optional(env, 'SUPERMEMORY_CONTAINER_TAG'),
      baseUrl: withoutTrailingSlash(
        optional(env, 'SUPERMEMORY_BASE_URL') ?? 'https://api.supermemory.ai',
      ),
      sampleQuery:
        optional(env, 'SUPERMEMORY_SAMPLE_QUERY') ??
        'What recent incident context is relevant?',
    },
    spacetime: {
      host:
        optional(env, 'SPACETIME_SOURCE_HOST') ??
        optional(env, 'VITE_SPACETIMEDB_HOST') ??
        optional(env, 'SPACETIMEDB_HOST'),
      database:
        optional(env, 'SPACETIME_SOURCE_DATABASE') ??
        optional(env, 'VITE_SPACETIMEDB_DB_NAME') ??
        optional(env, 'SPACETIMEDB_DB_NAME'),
      sourceTable: optional(env, 'SPACETIME_SOURCE_TABLE') ?? 'incident_room',
      token: optional(env, 'SPACETIME_SOURCE_TOKEN'),
    },
    browserbase: {
      apiKey: optional(env, 'BROWSERBASE_API_KEY'),
      projectId: optional(env, 'BROWSERBASE_PROJECT_ID'),
      baseUrl: withoutTrailingSlash(
        optional(env, 'BROWSERBASE_BASE_URL') ?? 'https://api.browserbase.com',
      ),
    },
    computer: {
      openAiApiKey: optional(env, 'OPENAI_API_KEY'),
      model: optional(env, 'OPENAI_COMPUTER_MODEL') ?? 'gpt-5.4-mini',
      startUrl:
        optional(env, 'OPENAI_COMPUTER_START_URL') ??
        'https://proactive-six.vercel.app/demo/observability',
      allowedOrigins: commaSeparated(
        optional(env, 'OPENAI_COMPUTER_ALLOWED_ORIGINS') ??
          'https://proactive-six.vercel.app',
      ),
      maxSteps: integerInRange(
        optional(env, 'OPENAI_COMPUTER_MAX_STEPS'),
        10,
        1,
        20,
      ),
      timeoutMs: integerInRange(
        optional(env, 'OPENAI_COMPUTER_TIMEOUT_MS'),
        180_000,
        10_000,
        240_000,
      ),
    },
  };
}
