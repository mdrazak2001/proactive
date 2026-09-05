export type CausalRole = 'signal' | 'change' | 'impact' | 'runtime';
export type ProviderIcon =
  | 'supabase'
  | 'langsmith'
  | 'supermemory'
  | 'spacetimedb'
  | 'posthog'
  | 'datadog'
  | 'cloudwatch'
  | 'sentry'
  | 'github'
  | 'vercel'
  | 'neatlogs'
  | 'browserbase';

export type ProviderReadiness = 'alpha' | 'next' | 'planned' | 'experimental';

export interface ProviderManifest {
  id: string;
  name: string;
  icon: ProviderIcon;
  accent: string;
  causalRoles: CausalRole[];
  readiness: ProviderReadiness;
  summary: string;
  auth: string;
  minimumAccess: string;
  discovery: string;
  capabilities: string[];
  configurationKeys?: string[];
  signatureQuestion: string;
  safetyNote: string;
  docsUrl: string;
}

export const providers: ProviderManifest[] = [
  {
    id: 'supabase',
    name: 'Supabase',
    icon: 'supabase',
    accent: '3ecf8e',
    causalRoles: ['signal', 'impact'],
    readiness: 'alpha',
    summary: 'Connect your project and read at most five incident events from one curated table.',
    auth: 'Publishable key + RLS demo path · scoped sbp_fc when available',
    minimumAccess: 'One public table · occurred_at column only · Database Read for scoped tokens',
    discovery: 'Configured project → fixed read path → allowlisted table',
    capabilities: ['database.health', 'data.query_bounded'],
    configurationKeys: ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_REF', 'SUPABASE_SOURCE_TABLE'],
    signatureQuestion: 'Did the incident coincide with a database, function, or auth failure?',
    safetyNote: 'Publishable mode is only for the supplied sanitized RLS table and exposes its timestamp column to anon. Scoped-token mode stays fixed to this table through Supabase’s read-only role.',
    docsUrl: 'https://supabase.com/docs/reference/api/v1-read-only-query',
  },
  {
    id: 'langsmith',
    name: 'LangSmith',
    icon: 'langsmith',
    accent: '1cbd74',
    causalRoles: ['signal'],
    readiness: 'alpha',
    summary: 'Connect one tracing project and read five recent run timestamps without prompts or outputs.',
    auth: 'Expiring workspace-scoped service key',
    minimumAccess: 'projects:read · runs:read · one selected tracing project',
    discovery: 'Configured workspace → tracing project → recent run metadata',
    capabilities: ['projects.verify', 'runs.recent_metadata'],
    configurationKeys: ['LANGSMITH_API_KEY', 'LANGSMITH_WORKSPACE_ID', 'LANGSMITH_SOURCE_PROJECT_ID'],
    signatureQuestion: 'Did a prompt, model, or tool change increase failures?',
    safetyNote: 'The key is submitted once to a private per-user table. Queries select only run IDs and timestamps from the chosen project.',
    docsUrl: 'https://docs.langchain.com/langsmith/organization-workspace-operations',
  },
  {
    id: 'supermemory',
    name: 'Supermemory',
    icon: 'supermemory',
    accent: 'a8c7ff',
    causalRoles: ['signal'],
    readiness: 'alpha',
    summary: 'Retrieve incident context from one isolated memory container.',
    auth: 'Container-scoped API key',
    minimumAccess: 'One containerTag · documents, memories, and search only',
    discovery: 'Scoped key → container → searchable memories',
    capabilities: ['memories.search', 'documents.list', 'context.retrieve'],
    configurationKeys: ['SUPERMEMORY_API_KEY', 'SUPERMEMORY_CONTAINER_TAG'],
    signatureQuestion: 'What prior decision, incident, or customer context is relevant now?',
    safetyNote: 'Use a revocable container-scoped key, never an organization-wide API key, and keep it in the server-side vault.',
    docsUrl: 'https://supermemory.ai/docs/authentication',
  },
  {
    id: 'spacetimedb',
    name: 'SpacetimeDB',
    icon: 'spacetimedb',
    accent: 'b9ff66',
    causalRoles: ['runtime'],
    readiness: 'alpha',
    summary: 'Own private connection records and live room state with the signed-in SpacetimeAuth identity.',
    auth: 'Same SpacetimeAuth ID token already used for the room connection',
    minimumAccess: 'Own private connector rows · shared public incident-room state',
    discovery: 'SpacetimeAuth identity → private connector vault → live room',
    capabilities: ['connector.private_state', 'room.runtime'],
    configurationKeys: ['VITE_SPACETIMEDB_HOST', 'VITE_SPACETIMEDB_DB_NAME'],
    signatureQuestion: 'Is this identity linked to its private connector state and the live room?',
    safetyNote: 'The private credential table is omitted from client bindings and subscriptions. Procedures return sanitized receipts only.',
    docsUrl: 'https://spacetimedb.com/docs/core-concepts/authentication/',
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: 'github',
    accent: 'f1efe7',
    causalRoles: ['change'],
    readiness: 'next',
    summary: 'Correlate commits, deployments, checks, and release metadata.',
    auth: 'GitHub App installation',
    minimumAccess: 'Selected repositories · metadata, contents, deployments: read',
    discovery: 'Installation → selected repositories → deployments',
    capabilities: ['changes.list', 'commits.compare', 'deployments.get'],
    signatureQuestion: 'What changed between the last good and first bad release?',
    safetyNote: 'Repository selection stays explicit. Write permissions are not requested.',
    docsUrl: 'https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app',
  },
  {
    id: 'posthog',
    name: 'PostHog',
    icon: 'posthog',
    accent: 'f4bd3d',
    causalRoles: ['impact', 'signal'],
    readiness: 'next',
    summary: 'Measure affected users, sessions, funnels, and product errors.',
    auth: 'OAuth with regional token exchange',
    minimumAccess: 'organization:read · project:read · query:read',
    discovery: 'Organization → projects → event taxonomy',
    capabilities: ['impact.aggregate', 'events.search', 'funnels.compare'],
    signatureQuestion: 'Which customers and product journeys were affected?',
    safetyNote: 'Queries are compiled from bounded templates; the model cannot submit arbitrary HogQL.',
    docsUrl: 'https://posthog.com/docs/api/oauth',
  },
  {
    id: 'sentry',
    name: 'Sentry',
    icon: 'sentry',
    accent: 'c7a8ff',
    causalRoles: ['signal'],
    readiness: 'next',
    summary: 'Find newly introduced issues, stacks, releases, and impact.',
    auth: 'OAuth authorization code + PKCE',
    minimumAccess: 'org:read · project:read · event:read',
    discovery: 'Organization → projects → environments → issues',
    capabilities: ['errors.search', 'issues.get', 'releases.list'],
    signatureQuestion: 'Which issue first appeared with this release?',
    safetyNote: 'Only organization, project, and event read scopes are requested.',
    docsUrl: 'https://docs.sentry.io/api/permissions/',
  },
  {
    id: 'datadog',
    name: 'Datadog',
    icon: 'datadog',
    accent: '9274d9',
    causalRoles: ['signal'],
    readiness: 'planned',
    summary: 'Compare metrics, logs, traces, events, and dependencies.',
    auth: 'Confidential OAuth; scoped key for private alpha',
    minimumAccess: 'metrics, logs, APM, events, service catalog: read',
    discovery: 'Datadog site → service catalog → environments',
    capabilities: ['metrics.timeseries', 'logs.aggregate', 'traces.search'],
    signatureQuestion: 'Was it our deploy or a downstream dependency?',
    safetyNote: 'Production OAuth distribution requires Datadog partner onboarding and site-aware callbacks.',
    docsUrl: 'https://docs.datadoghq.com/extend/authorization/oauth2_in_datadog/',
  },
  {
    id: 'cloudwatch',
    name: 'AWS CloudWatch',
    icon: 'cloudwatch',
    accent: 'ff9900',
    causalRoles: ['signal'],
    readiness: 'planned',
    summary: 'Inspect bounded metrics, alarms, logs, and X-Ray traces.',
    auth: 'Cross-account IAM role + unique external ID',
    minimumAccess: 'CloudWatch, Logs Insights, and optional X-Ray read actions',
    discovery: 'Account + regions → namespaces → log groups',
    capabilities: ['metrics.timeseries', 'logs.aggregate', 'alarms.list'],
    signatureQuestion: 'Which service began erroring, and what signature explains it?',
    safetyNote: 'Use a customer-deployed role. Static AWS access keys are never accepted.',
    docsUrl: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_common-scenarios-third-party.html',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    icon: 'vercel',
    accent: 'f1efe7',
    causalRoles: ['change'],
    readiness: 'planned',
    summary: 'Read production deployment timing, projects, and release metadata.',
    auth: 'Installable integration',
    minimumAccess: 'Integration configuration, project, deployment: read',
    discovery: 'Team → projects → production deployments',
    capabilities: ['changes.list', 'deployments.get'],
    signatureQuestion: 'Which production deployment introduced the regression?',
    safetyNote: 'A distributed integration requires Vercel review; a private alpha can begin with a private integration.',
    docsUrl: 'https://vercel.com/docs/integrations/create-integration/vercel-api-integrations',
  },
  {
    id: 'neatlogs',
    name: 'Neatlogs',
    icon: 'neatlogs',
    accent: '70d7ff',
    causalRoles: ['signal'],
    readiness: 'experimental',
    summary: 'Inspect AI-agent traces and tool-call behavior through MCP.',
    auth: 'Project API key',
    minimumAccess: 'Project key currently has coarse project-wide access',
    discovery: 'Identity → key-bound project → trace search',
    capabilities: ['traces.search', 'traces.get'],
    signatureQuestion: 'Which agent step or tool call began behaving differently?',
    safetyNote: 'Experimental until a server-side read allowlist compensates for the provider’s broad key scope.',
    docsUrl: 'https://docs.neatlogs.com/guides/mcp-integration',
  },
  {
    id: 'browserbase',
    name: 'Browserbase',
    icon: 'browserbase',
    accent: 'b9ff66',
    causalRoles: ['runtime'],
    readiness: 'alpha',
    summary: 'Create an isolated browser session and stream a read-only Live View into the war room.',
    auth: 'Server-side project ID + API key',
    minimumAccess: 'Create and observe isolated browser sessions',
    discovery: 'Project → session → Live View URL',
    capabilities: ['browser.session', 'browser.live_view'],
    configurationKeys: ['BROWSERBASE_API_KEY', 'BROWSERBASE_PROJECT_ID'],
    signatureQuestion: 'What is the agent doing right now?',
    safetyNote: 'Browserbase displays sanitized work. Telemetry credentials stay in the connector broker, not the browser.',
    docsUrl: 'https://docs.browserbase.com/platform/browser/observability/session-live-view',
  },
];

export const readinessLabel: Record<ProviderReadiness, string> = {
  alpha: 'Live alpha',
  next: 'Next connector',
  planned: 'Planned',
  experimental: 'Needs validation',
};

export const causalRoleLabel: Record<CausalRole, string> = {
  signal: 'Signal',
  change: 'Change',
  impact: 'Impact',
  runtime: 'Runtime',
};
