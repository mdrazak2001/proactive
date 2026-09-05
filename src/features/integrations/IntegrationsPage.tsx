import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import {
  Activity,
  BrainCircuit,
  Check,
  ChevronRight,
  Cloud,
  Database,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  Monitor,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useProcedure, useSpacetimeDB } from 'spacetimedb/react';
import {
  siDatadog,
  siGithub,
  siLangchain,
  siPosthog,
  siSentry,
  siSupabase,
  siVercel,
  type SimpleIcon,
} from 'simple-icons';
import { useAuth } from '../../auth/AuthProvider';
import {
  BrokerRequestError,
  formatSafeSample,
  getConnectorStatuses,
  isLiveProviderId,
  normalizeReceipt,
  normalizeStatusSnapshot,
  parseProcedurePayload,
  queryConnector,
  verifyConnector,
  type ConnectionState,
  type ConnectorReceipt,
  type ConnectorStatus,
  type LiveProviderId,
} from './api';
import {
  causalRoleLabel,
  providers,
  readinessLabel,
  type CausalRole,
  type ProviderIcon,
  type ProviderManifest,
} from './catalog';
import { procedures } from '../../module_bindings';
import './IntegrationsPage.css';

const simpleIcons: Partial<Record<ProviderIcon, SimpleIcon>> = {
  supabase: siSupabase,
  langsmith: siLangchain,
  posthog: siPosthog,
  datadog: siDatadog,
  sentry: siSentry,
  github: siGithub,
  vercel: siVercel,
};

const filterOptions: Array<{ value: 'all' | CausalRole; label: string }> = [
  { value: 'all', label: 'All sources' },
  { value: 'signal', label: 'Signal' },
  { value: 'change', label: 'Change' },
  { value: 'impact', label: 'Impact' },
  { value: 'runtime', label: 'Runtime' },
];

const stateLabels: Record<ConnectionState, string> = {
  not_configured: 'Needs config',
  configured: 'Ready to verify',
  verifying: 'Verifying',
  querying: 'Fetching',
  verified: 'Verified',
  error: 'Needs attention',
  offline: 'Broker offline',
};

type BrokerState = 'checking' | 'online' | 'offline' | 'auth' | 'access' | 'error';
type Operation = 'connect' | 'disconnect' | 'verify' | 'query';
type SelfServiceProviderId = 'supabase' | 'langsmith' | 'spacetimedb';
type ConnectorSetup =
  | {
      provider: 'supabase';
      accessToken: string;
      projectRef: string;
      sourceTable: string;
    }
  | {
      provider: 'langsmith';
      apiKey: string;
      workspaceId: string;
      projectId: string;
      region: string;
    };

const selfServiceProviderIds = ['supabase', 'langsmith', 'spacetimedb'] as const;
const isSelfServiceProvider = (value: string): value is SelfServiceProviderId =>
  selfServiceProviderIds.includes(value as SelfServiceProviderId);

function operationErrorMessage(value: unknown, fallback: string) {
  const raw = value instanceof Error
    ? value.message
    : typeof value === 'string'
      ? value
      : typeof value === 'object' && value !== null && 'message' in value && typeof value.message === 'string'
        ? value.message
        : '';
  if (!raw.trim()) return fallback;
  return raw
    .replace(/^.*?SenderError:\s*/i, '')
    .replace(/^The module instance encountered a fatal error:\s*/i, '')
    .slice(0, 500);
}

function ProviderMark({ provider }: { provider: ProviderManifest }) {
  const simpleIcon = simpleIcons[provider.icon];
  const size = 22;
  const style = { '--provider-accent': `#${provider.accent}` } as CSSProperties;

  let fallback = <ScanLine size={size} strokeWidth={1.7} />;
  if (provider.icon === 'cloudwatch') fallback = <Cloud size={size} strokeWidth={1.7} />;
  if (provider.icon === 'browserbase') fallback = <Monitor size={size} strokeWidth={1.7} />;
  if (provider.icon === 'supermemory') fallback = <BrainCircuit size={size} strokeWidth={1.7} />;
  if (provider.icon === 'spacetimedb') fallback = <Database size={size} strokeWidth={1.7} />;

  return (
    <span className="provider-mark" style={style} aria-hidden="true">
      {simpleIcon ? (
        <svg viewBox="0 0 24 24" width={size} height={size} role="img">
          <path d={simpleIcon.path} fill="currentColor" />
        </svg>
      ) : fallback}
    </span>
  );
}

function StatusChip({ state }: { state: ConnectionState }) {
  const isBusy = state === 'verifying' || state === 'querying';
  return (
    <span className={`connection-status connection-status--${state}`} role="status">
      {isBusy ? <LoaderCircle size={10} aria-hidden="true" /> : <i aria-hidden="true" />}
      {stateLabels[state]}
    </span>
  );
}

function readableTime(value?: string) {
  if (!value) return 'Not checked yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function statusFor(
  providerId: LiveProviderId,
  statuses: Partial<Record<LiveProviderId, ConnectorStatus>>,
  brokerState: BrokerState,
  operation?: Operation,
): ConnectorStatus {
  const current = statuses[providerId];
  if (operation) {
    return {
      ...(current ?? { provider: providerId, configured: true, scope: [] }),
      status: operation === 'query' ? 'querying' : 'verifying',
    };
  }
  if (brokerState === 'offline') {
    return {
      ...(current ?? { provider: providerId, configured: false, scope: [] }),
      status: 'offline',
    };
  }
  if (brokerState === 'auth' || brokerState === 'access' || brokerState === 'error') {
    return {
      ...(current ?? { provider: providerId, configured: false, scope: [] }),
      status: 'error',
    };
  }
  return current ?? { provider: providerId, configured: false, status: 'not_configured', scope: [] };
}

function ConnectorSetupForm({
  provider,
  disabled,
  onConnect,
}: {
  provider: ProviderManifest;
  disabled: boolean;
  onConnect: (input: ConnectorSetup) => void;
}) {
  const [accessToken, setAccessToken] = useState('');
  const [supabaseMode, setSupabaseMode] = useState<'publishable' | 'scoped'>('publishable');
  const [projectRef, setProjectRef] = useState('');
  const [sourceTable, setSourceTable] = useState('public.proactive_events');
  const [apiKey, setApiKey] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [region, setRegion] = useState('us');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (provider.id === 'supabase') {
      onConnect({ provider: 'supabase', accessToken, projectRef, sourceTable });
    }
    if (provider.id === 'langsmith') {
      onConnect({ provider: 'langsmith', apiKey, workspaceId, projectId, region });
    }
  };

  if (provider.id !== 'supabase' && provider.id !== 'langsmith') return null;

  return (
    <form id="connector-connect-form" className="connector-form" onSubmit={submit} autoComplete="off">
      <div className="connector-form__heading">
        <span>AUTHORIZE</span>
        <strong>Connect your {provider.name} account</strong>
        <p>The credential is sent once over the live encrypted connection and saved in a private SpacetimeDB table. It is never subscribed back to any client.</p>
      </div>

      {provider.id === 'supabase' ? (
        <>
          <label>
            <span>Connection method</span>
            <select
              value={supabaseMode}
              onChange={event => {
                setSupabaseMode(event.target.value as 'publishable' | 'scoped');
                setAccessToken('');
              }}
              disabled={disabled}
            >
              <option value="publishable">Publishable key + RLS demo table</option>
              <option value="scoped">Fine-grained token (sbp_fc)</option>
            </select>
            <small>Publishable mode works on every Supabase account. Scoped tokens are still in public alpha.</small>
          </label>
          <label>
            <span>{supabaseMode === 'publishable' ? 'Project publishable key' : 'Scoped platform token'}</span>
            <input
              type="password"
              value={accessToken}
              onChange={event => setAccessToken(event.target.value)}
              placeholder={supabaseMode === 'publishable' ? 'sb_publishable_…' : 'sbp_fc…'}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={4096}
              disabled={disabled}
            />
            <small>
              {supabaseMode === 'publishable'
                ? 'Use the public client key from Project Settings → API Keys. Secret, service-role, anon JWT, and classic PAT values are rejected.'
                : 'Use a fine-grained token limited to this project with Database Read. Classic PATs are rejected.'}
            </small>
          </label>
          <label>
            <span>Project ref</span>
            <input
              value={projectRef}
              onChange={event => setProjectRef(event.target.value.toLowerCase())}
              placeholder="abcdefghijklmnop"
              pattern="[a-z0-9]{8,64}"
              required
              disabled={disabled}
            />
          </label>
          <label>
            <span>Read-only table (schema.table)</span>
            <input
              value={sourceTable}
              onChange={event => setSourceTable(event.target.value.toLowerCase())}
              placeholder="public.proactive_events"
              pattern="[a-z_][a-z0-9_]{0,62}\.[a-z_][a-z0-9_]{0,62}"
              readOnly={supabaseMode === 'publishable'}
              required
              disabled={disabled}
            />
            <small>
              {supabaseMode === 'publishable'
                ? 'Demo mode accepts only the public schema. Its occurred_at column must be intentionally readable by the anon role through RLS.'
                : 'Verification reads one occurred_at timestamp; samples return at most five timestamps.'}
            </small>
          </label>
          {supabaseMode === 'publishable' && (
            <div className="connector-form__receipt connector-form__receipt--caution">
              <ShieldCheck size={16} aria-hidden="true" />
              <span><strong>Demo-safe boundary</strong>The publishable key is not a secret. Only use this path with the supplied sanitized table policy—never expose a customer incident table to anon.</span>
            </div>
          )}
        </>
      ) : (
        <>
          <label>
            <span>Workspace service key</span>
            <input
              type="password"
              value={apiKey}
              onChange={event => setApiKey(event.target.value)}
              placeholder="lsv2_pt_…"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={4096}
              disabled={disabled}
            />
            <small>Prefer an expiring, workspace-scoped service key. Raw prompts and outputs are not requested.</small>
          </label>
          <label>
            <span>Workspace ID</span>
            <input
              value={workspaceId}
              onChange={event => setWorkspaceId(event.target.value)}
              placeholder="00000000-0000-4000-8000-000000000000"
              required
              disabled={disabled}
            />
          </label>
          <label>
            <span>Tracing project ID</span>
            <input
              value={projectId}
              onChange={event => setProjectId(event.target.value)}
              placeholder="00000000-0000-4000-8000-000000000000"
              required
              disabled={disabled}
            />
          </label>
          <label>
            <span>Cloud region</span>
            <select value={region} onChange={event => setRegion(event.target.value)} disabled={disabled}>
              <option value="us">GCP US</option>
              <option value="eu">GCP EU</option>
              <option value="apac">GCP APAC</option>
              <option value="aws_us">AWS US</option>
            </select>
          </label>
        </>
      )}

      <div className="connector-form__receipt">
        <ShieldCheck size={16} aria-hidden="true" />
        <span><strong>Read-only execution</strong>Fixed provider host · fixed query shape · timestamp only · 1-row verification · 5-row sample</span>
      </div>
    </form>
  );
}

function ConnectionDrawer({
  provider,
  status,
  operation,
  receipt,
  error,
  onConnect,
  onDisconnect,
  onVerify,
  onQuery,
  onClose,
  canRequest,
}: {
  provider: ProviderManifest;
  status?: ConnectorStatus;
  operation?: Operation;
  receipt?: ConnectorReceipt;
  error?: string;
  onConnect: (input: ConnectorSetup) => void;
  onDisconnect: () => void;
  onVerify: () => void;
  onQuery: () => void;
  onClose: () => void;
  canRequest: boolean;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const live = isLiveProviderId(provider.id);
  const selfService = isSelfServiceProvider(provider.id);
  const canDisconnect = provider.id === 'supabase' || provider.id === 'langsmith';
  const activeState = operation === 'query' ? 'querying' : operation ? 'verifying' : status?.status;
  const sampleText = formatSafeSample(receipt?.sample);
  const roleText = provider.causalRoles.map(role => causalRoleLabel[role]).join(' + ');

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    closeButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const connectorKind = provider.id === 'spacetimedb'
    ? 'RUNTIME · PRIVATE CONNECTION STORE'
    : selfService
      ? 'SELF-SERVICE CONNECTOR'
    : live ? 'LIVE CONNECTOR' : 'PLANNED CONNECTOR';

  return (
    <div className="connector-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="connector-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connector-drawer-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="connector-drawer__header">
          <div className="connector-drawer__identity">
            <ProviderMark provider={provider} />
            <div>
              <span>{connectorKind}</span>
              <h2 id="connector-drawer-title">{provider.name}</h2>
            </div>
          </div>
          <button ref={closeButton} className="drawer-close" type="button" onClick={onClose} aria-label={`Close ${provider.name} details`}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="setup-disclosure">
          <ShieldCheck size={16} strokeWidth={1.8} aria-hidden="true" />
          {provider.id === 'spacetimedb' ? (
            <p><strong>Identity linked.</strong> SpacetimeAuth identifies the owner of every connection. Provider credentials live in a private table and are never included in client subscriptions.</p>
          ) : selfService ? (
            <p><strong>Private connection vault.</strong> Submit the scoped credential once. Only a sanitized status and read receipt come back to this browser.</p>
          ) : live ? (
            <p><strong>Server-side credentials.</strong> Keys are read from the broker environment and never entered, returned, or stored in this browser.</p>
          ) : (
            <p><strong>Planned.</strong> This provider has an access design, but no endpoint is wired. Nothing here implies a working connection.</p>
          )}
        </div>

        <div className="connection-detail">
          <section className="connection-overview" aria-labelledby="connection-state-title">
            <div className="connection-overview__heading">
              <div>
                <p className="setup-stage__kicker">CONNECTION</p>
                <h3 id="connection-state-title">{live ? 'Prove the boundary with a real read.' : 'Review the proposed boundary.'}</h3>
              </div>
              {live && activeState && <StatusChip state={activeState} />}
            </div>
            <p className="setup-stage__lede">
              {live
                ? provider.id === 'spacetimedb'
                  ? 'This signed-in identity owns its connector records. The private credential table is excluded from generated client bindings and subscriptions.'
                  : selfService
                    ? 'Connect verifies the exact source before saving it. A green state appears only after the provider accepts the bounded read.'
                    : 'Verification calls the provider through the typed broker. A green state appears only after that request succeeds.'
                : provider.summary}
            </p>

            {selfService && provider.id !== 'spacetimedb' && !status?.configured && (
              <ConnectorSetupForm
                provider={provider}
                disabled={Boolean(operation) || !canRequest}
                onConnect={onConnect}
              />
            )}

            {selfService && status?.configured && (
              <div className="saved-connection">
                <Check size={16} aria-hidden="true" />
                <span>
                  <strong>{provider.id === 'spacetimedb' ? 'Control plane linked to this identity' : 'Connection saved for this identity'}</strong>
                  {provider.id === 'spacetimedb'
                    ? 'The live connection can reach private connector state without exposing it.'
                    : 'The credential is private; only this access receipt is client-visible.'}
                </span>
              </div>
            )}

            {live && !selfService && provider.configurationKeys && (
              <div className="environment-keys" aria-label={`${provider.name} server environment variables`}>
                <span>SERVER ENVIRONMENT</span>
                <p>Add values to <code>.env.local</code>, restart the broker, then verify here.</p>
                <ul>
                  {provider.configurationKeys.map(key => <li key={key}><code>{key}</code></li>)}
                </ul>
              </div>
            )}

            {(error || status?.message) && (
              <div className="connection-message" role="alert">
                <strong>{error ? 'Request failed' : 'Provider note'}</strong>
                <p>{error ?? status?.message}</p>
              </div>
            )}

            <dl className="access-spec">
              <div><dt>Credential</dt><dd>{provider.auth}</dd></div>
              <div><dt>Minimum access</dt><dd>{provider.minimumAccess}</dd></div>
              <div><dt>Causal role</dt><dd>{roleText}</dd></div>
              {live && <div><dt>Last checked</dt><dd>{readableTime(receipt?.checkedAt ?? status?.checkedAt)}</dd></div>}
            </dl>

            <div className="safety-note"><KeyRound size={16} aria-hidden="true" /><p>{provider.safetyNote}</p></div>
          </section>

          <section className="connection-test" aria-labelledby="test-title">
            <p className="setup-stage__kicker">BOUNDED TEST</p>
            <h3 id="test-title">One question, one inspectable receipt.</h3>
            <div className="test-question">
              <span>{live ? 'QUERY TEMPLATE' : 'PROPOSED QUERY'}</span>
              <blockquote>“{provider.signatureQuestion}”</blockquote>
            </div>

            <div className="capability-list">
              <span>ALLOWLISTED CAPABILITIES</span>
              <ul>
                {provider.capabilities.map(capability => <li key={capability}><Check size={12} aria-hidden="true" />{capability}</li>)}
              </ul>
            </div>

            {live && receipt && (
              <div className={`evidence-receipt evidence-receipt--${receipt.status}`} aria-live="polite">
                <span><Activity size={15} aria-hidden="true" /> LIVE RECEIPT</span>
                <dl>
                  <div><dt>Provider</dt><dd>{provider.name}</dd></div>
                  <div><dt>Result</dt><dd>{stateLabels[receipt.status]}</dd></div>
                  <div><dt>Boundary</dt><dd>{receipt.credentialBoundary ?? 'Broker-enforced read path'}</dd></div>
                  <div><dt>Checked</dt><dd>{readableTime(receipt.checkedAt)}</dd></div>
                  <div className="evidence-receipt__scope"><dt>Scope</dt><dd>{receipt.scope.length ? receipt.scope.join(' · ') : provider.minimumAccess}</dd></div>
                </dl>
                {sampleText && <p className="evidence-receipt__sample"><strong>Sanitized sample</strong>{sampleText}</p>}
              </div>
            )}
          </section>
        </div>

        <footer className="connector-drawer__footer">
          <a href={provider.docsUrl} target="_blank" rel="noreferrer">
            Provider docs <ExternalLink size={13} aria-hidden="true" />
          </a>
          {selfService && canDisconnect && !status?.configured ? (
            <button
              className="drawer-button drawer-button--primary"
              type="submit"
              form="connector-connect-form"
              disabled={Boolean(operation) || !canRequest}
            >
              {operation === 'connect' && <LoaderCircle size={14} aria-hidden="true" />}
              {operation === 'connect' ? 'Connecting' : 'Connect & verify'}
            </button>
          ) : live ? (
            <>
              {selfService && canDisconnect && (
                <button
                  className="drawer-button drawer-button--danger"
                  type="button"
                  onClick={onDisconnect}
                  disabled={Boolean(operation) || !canRequest}
                  aria-label={`Disconnect ${provider.name}`}
                >
                  <Trash2 size={13} aria-hidden="true" /> Disconnect
                </button>
              )}
              <button className="drawer-button drawer-button--quiet" type="button" onClick={onVerify} disabled={Boolean(operation) || !canRequest}>
                {operation === 'verify' && <LoaderCircle size={14} aria-hidden="true" />} Verify
              </button>
              <button className="drawer-button drawer-button--primary" type="button" onClick={onQuery} disabled={Boolean(operation) || !canRequest || status?.status !== 'verified'}>
                {operation === 'query' && <LoaderCircle size={14} aria-hidden="true" />} Fetch sample
              </button>
            </>
          ) : (
            <button className="drawer-button" type="button" disabled>Planned</button>
          )}
        </footer>
      </aside>
    </div>
  );
}

export default function IntegrationsPage() {
  const { configured: authConfigured, loading: authLoading, idToken } = useAuth();
  const { isActive: realtimeActive } = useSpacetimeDB();
  const listVaultConnections = useProcedure(procedures.listConnectorConnections);
  const connectSupabaseProcedure = useProcedure(procedures.connectSupabase);
  const connectLangsmithProcedure = useProcedure(procedures.connectLangsmith);
  const verifyVaultConnection = useProcedure(procedures.verifyConnectorConnection);
  const sampleVaultConnection = useProcedure(procedures.sampleConnectorConnection);
  const disconnectVaultConnection = useProcedure(procedures.disconnectConnectorConnection);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | CausalRole>('all');
  const [selected, setSelected] = useState<ProviderManifest | null>(null);
  const [brokerState, setBrokerState] = useState<BrokerState>('checking');
  const [brokerMessage, setBrokerMessage] = useState('Checking the local connector broker');
  const [statuses, setStatuses] = useState<Partial<Record<LiveProviderId, ConnectorStatus>>>({});
  const [operations, setOperations] = useState<Partial<Record<LiveProviderId, Operation>>>({});
  const [receipts, setReceipts] = useState<Partial<Record<LiveProviderId, ConnectorReceipt>>>({});
  const [errors, setErrors] = useState<Partial<Record<LiveProviderId, string>>>({});

  const loadStatuses = async (signal?: AbortSignal) => {
    if (authLoading) return;
    if (authConfigured && !idToken) {
      setBrokerState('auth');
      setBrokerMessage('Continue with Google to inspect connector state');
      return;
    }
    if (!realtimeActive) {
      setBrokerState('checking');
      setBrokerMessage('Connecting the private per-user store');
      return;
    }
    setBrokerState('checking');
    setBrokerMessage('Checking your private connector records');
    try {
      const vaultPayload = parseProcedurePayload(await listVaultConnections());
      const vaultSnapshot = normalizeStatusSnapshot(vaultPayload);
      let brokerProviders: Partial<Record<LiveProviderId, ConnectorStatus>> = {};
      let brokerWarning = '';
      try {
        const brokerSnapshot = await getConnectorStatuses(signal, idToken);
        brokerProviders = brokerSnapshot.providers;
      } catch (requestError) {
        if (signal?.aborted) return;
        brokerWarning = requestError instanceof Error ? requestError.message : 'Runtime broker unavailable';
      }
      if (signal?.aborted) return;
      setStatuses({ ...brokerProviders, ...vaultSnapshot.providers });
      setBrokerState('online');
      setBrokerMessage(
        brokerWarning
          ? 'Personal connectors online · runtime broker is offline'
          : vaultSnapshot.brokerMessage ?? 'Private per-user connector store online',
      );
    } catch (requestError) {
      if (signal?.aborted) return;
      const message = requestError instanceof Error ? requestError.message : 'Private connector store is unavailable';
      if (requestError instanceof BrokerRequestError && requestError.status > 0) {
        const authSetupError = requestError.code.startsWith('oidc_')
          || requestError.code === 'authentication_required';
        if (requestError.status === 403) setBrokerState('access');
        else setBrokerState(requestError.status === 401 || authSetupError ? 'auth' : 'error');
      } else {
        setBrokerState('offline');
      }
      setBrokerMessage(message);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadStatuses(controller.signal);
    return () => controller.abort();
  }, [authConfigured, authLoading, idToken, realtimeActive]);

  const visibleProviders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return providers.filter(provider => {
      const matchesFilter = filter === 'all' || provider.causalRoles.includes(filter);
      const searchable = `${provider.name} ${provider.summary} ${provider.capabilities.join(' ')}`.toLowerCase();
      return matchesFilter && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [filter, query]);

  const runOperation = async (provider: ProviderManifest, operation: 'verify' | 'query') => {
    if (!isLiveProviderId(provider.id)) return;
    const providerId = provider.id;
    setSelected(provider);
    setOperations(current => ({ ...current, [providerId]: operation }));
    setErrors(current => ({ ...current, [providerId]: undefined }));
    try {
      const receipt = isSelfServiceProvider(providerId)
        ? normalizeReceipt(
            parseProcedurePayload(
              operation === 'verify'
                ? await verifyVaultConnection({ provider: providerId })
                : await sampleVaultConnection({ provider: providerId }),
            ),
            providerId,
            'verified',
          )
        : operation === 'verify'
          ? await verifyConnector(providerId, idToken)
          : await queryConnector(providerId, idToken);
      setReceipts(current => ({ ...current, [providerId]: receipt }));
      setStatuses(current => ({
        ...current,
        [providerId]: {
          provider: providerId,
          configured: true,
          status: receipt.status === 'error' ? 'error' : 'verified',
          credentialBoundary: receipt.credentialBoundary,
          scope: receipt.scope,
          checkedAt: receipt.checkedAt,
          message: receipt.message,
          sample: receipt.sample,
        },
      }));
      setBrokerState('online');
    } catch (requestError) {
      const message = operationErrorMessage(requestError, 'The connector request failed.');
      setErrors(current => ({ ...current, [providerId]: message }));
      setStatuses(current => ({
        ...current,
        [providerId]: {
          ...(current[providerId] ?? { provider: providerId, configured: false, scope: [] }),
          status: requestError instanceof BrokerRequestError && requestError.status === 0 ? 'offline' : 'error',
          message,
        },
      }));
      if (requestError instanceof BrokerRequestError && requestError.status === 0) {
        setBrokerState('offline');
        setBrokerMessage(message);
      }
    } finally {
      setOperations(current => ({ ...current, [providerId]: undefined }));
    }
  };

  const runConnect = async (input: ConnectorSetup) => {
    const providerId = input.provider;
    const provider = providers.find(item => item.id === providerId);
    if (!provider) return;
    setOperations(current => ({ ...current, [providerId]: 'connect' }));
    setErrors(current => ({ ...current, [providerId]: undefined }));
    try {
      const rawReceipt = input.provider === 'supabase'
        ? await connectSupabaseProcedure({
            accessToken: input.accessToken,
            projectRef: input.projectRef,
            sourceTable: input.sourceTable,
          })
        : await connectLangsmithProcedure({
            apiKey: input.apiKey,
            workspaceId: input.workspaceId,
            projectId: input.projectId,
            region: input.region,
          });
      const receipt = normalizeReceipt(
        parseProcedurePayload(rawReceipt),
        providerId,
        'verified',
      );
      setReceipts(current => ({ ...current, [providerId]: receipt }));
      setStatuses(current => ({
        ...current,
        [providerId]: {
          provider: providerId,
          configured: true,
          status: 'verified',
          credentialBoundary: receipt.credentialBoundary,
          scope: receipt.scope,
          checkedAt: receipt.checkedAt,
          message: receipt.message,
          sample: receipt.sample,
        },
      }));
      setBrokerState('online');
      setBrokerMessage('Connection verified and saved to your private connector store');
    } catch (requestError) {
      const message = operationErrorMessage(requestError, 'The provider rejected this connection.');
      setErrors(current => ({ ...current, [providerId]: message }));
      setStatuses(current => ({
        ...current,
        [providerId]: {
          provider: providerId,
          configured: false,
          status: 'error',
          scope: current[providerId]?.scope ?? [],
          message,
        },
      }));
    } finally {
      setOperations(current => ({ ...current, [providerId]: undefined }));
    }
  };

  const runDisconnect = async (provider: ProviderManifest) => {
    if (provider.id !== 'supabase' && provider.id !== 'langsmith') return;
    const providerId = provider.id;
    setOperations(current => ({ ...current, [providerId]: 'disconnect' }));
    setErrors(current => ({ ...current, [providerId]: undefined }));
    try {
      await disconnectVaultConnection({ provider: providerId });
      setReceipts(current => ({ ...current, [providerId]: undefined }));
      setStatuses(current => ({
        ...current,
        [providerId]: {
          provider: providerId,
          configured: false,
          status: 'not_configured',
          scope: [],
          message: 'Connection removed. Revoke the provider key if it will not be reused.',
        },
      }));
      setBrokerMessage(`${provider.name} disconnected from this identity`);
    } catch (requestError) {
      const message = operationErrorMessage(requestError, 'The connection could not be removed.');
      setErrors(current => ({ ...current, [providerId]: message }));
    } finally {
      setOperations(current => ({ ...current, [providerId]: undefined }));
    }
  };

  const rowAction = (provider: ProviderManifest) => {
    if (!isLiveProviderId(provider.id)) {
      setSelected(provider);
      return;
    }
    const providerStatus = statusFor(provider.id, statuses, brokerState, operations[provider.id]);
    if (providerStatus.status === 'verified') {
      void runOperation(provider, 'query');
    } else if (providerStatus.configured && brokerState === 'online') {
      void runOperation(provider, 'verify');
    } else {
      setSelected(provider);
    }
  };

  const rowActionLabel = (provider: ProviderManifest) => {
    if (!isLiveProviderId(provider.id)) return 'View details';
    const providerStatus = statusFor(provider.id, statuses, brokerState, operations[provider.id]);
    if (providerStatus.status === 'verified') return 'Fetch sample';
    if (providerStatus.status === 'verifying') return 'Verifying';
    if (providerStatus.status === 'querying') return 'Fetching';
    if (providerStatus.configured && brokerState === 'online') return 'Verify';
    if (isSelfServiceProvider(provider.id)) return 'Connect';
    return 'Setup details';
  };

  const selectedId = selected && isLiveProviderId(selected.id) ? selected.id : undefined;
  const selectedStatus = selectedId ? statusFor(selectedId, statuses, brokerState, operations[selectedId]) : undefined;

  return (
    <div className="integrations-page">
      <header className="integrations-header">
        <div>
          <p className="integrations-kicker">INTEGRATIONS</p>
          <h1>Connect your tools</h1>
          <p>Connect one scoped source, prove it with a bounded read, and keep its credential private to your signed-in identity.</p>
        </div>
        <div className={`integrations-header__boundary integrations-header__boundary--${brokerState}`} role="status">
          {brokerState === 'checking' ? <LoaderCircle size={17} aria-hidden="true" /> : <ShieldCheck size={17} strokeWidth={1.8} aria-hidden="true" />}
          <span><strong>{brokerState === 'online' ? 'Connection store online' : brokerState === 'offline' ? 'Connection store offline' : brokerState === 'auth' ? 'Sign-in required' : brokerState === 'access' ? 'Access restricted' : brokerState === 'error' ? 'Connection error' : 'Checking connection store'}</strong>{brokerMessage}</span>
          <button type="button" onClick={() => void loadStatuses()} aria-label="Refresh connector status" disabled={brokerState === 'checking'}>
            <RefreshCw size={15} aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="connector-catalog" aria-labelledby="catalog-title">
        <div className="catalog-heading">
          <div><span>AVAILABLE INTEGRATIONS</span><h2 id="catalog-title">Provider catalog</h2></div>
          <label className="connector-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search integrations</span>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search providers or capabilities" />
          </label>
        </div>

        <div className="catalog-filters" role="group" aria-label="Filter integrations by role">
          {filterOptions.map(option => (
            <button
              type="button"
              key={option.value}
              className={filter === option.value ? 'is-active' : ''}
              onClick={() => setFilter(option.value)}
            >{option.label}</button>
          ))}
        </div>

        <div className="provider-list">
          {visibleProviders.map(provider => {
            const providerId = isLiveProviderId(provider.id) ? provider.id : undefined;
            const live = providerId !== undefined;
            const providerStatus = providerId ? statusFor(providerId, statuses, brokerState, operations[providerId]) : undefined;
            const isBusy = providerStatus?.status === 'verifying' || providerStatus?.status === 'querying';
            return (
              <article className="provider-row" key={provider.id}>
                <ProviderMark provider={provider} />
                <span className="provider-row__identity">
                  <span>
                    <strong>{provider.name}</strong>
                    {providerStatus
                      ? <StatusChip state={providerStatus.status} />
                      : <em className={`readiness readiness--${provider.readiness}`}>{readinessLabel[provider.readiness]}</em>}
                  </span>
                  <small>{provider.summary}</small>
                </span>
                <span className="provider-row__roles">
                  {provider.causalRoles.map(role => <i key={role}>{causalRoleLabel[role]}</i>)}
                </span>
                <span className="provider-row__auth"><small>{live ? 'BOUNDARY' : 'AUTH'}</small>{providerStatus?.credentialBoundary ?? provider.auth}</span>
                <button className="provider-row__action" type="button" onClick={() => rowAction(provider)} disabled={isBusy}>
                  {isBusy && <LoaderCircle size={14} aria-hidden="true" />}
                  {rowActionLabel(provider)}
                  {!isBusy && <ChevronRight size={15} aria-hidden="true" />}
                </button>
              </article>
            );
          })}
          {visibleProviders.length === 0 && (
            <div className="provider-empty"><Search size={20} aria-hidden="true" /><strong>No matching source</strong><p>Try a provider name or capability such as traces or metrics.</p></div>
          )}
        </div>
      </section>

      <section className="connector-boundary">
        <div><ShieldCheck size={18} aria-hidden="true" /><span><strong>Where each thing lives</strong><small>The separation that keeps the live experience safe.</small></span></div>
        <dl>
          <div><dt>Secrets</dt><dd>Private SpacetimeDB table</dd></div>
          <div><dt>Queries</dt><dd>Fixed module procedures</dd></div>
          <div><dt>Ownership</dt><dd>Signed-in SpacetimeAuth identity</dd></div>
          <div><dt>Visible computer</dt><dd>Sanitized Browserbase session</dd></div>
        </dl>
      </section>

      {selected && (
        <ConnectionDrawer
          provider={selected}
          status={selectedStatus}
          operation={selectedId ? operations[selectedId] : undefined}
          receipt={selectedId ? receipts[selectedId] : undefined}
          error={selectedId ? errors[selectedId] : undefined}
          onConnect={input => void runConnect(input)}
          onDisconnect={() => void runDisconnect(selected)}
          onVerify={() => void runOperation(selected, 'verify')}
          onQuery={() => void runOperation(selected, 'query')}
          onClose={() => setSelected(null)}
          canRequest={brokerState === 'online'}
        />
      )}
    </div>
  );
}
