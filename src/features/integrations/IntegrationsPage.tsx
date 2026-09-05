import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
  X,
} from 'lucide-react';
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
type Operation = 'verify' | 'query';

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
      status: operation === 'verify' ? 'verifying' : 'querying',
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

function ConnectionDrawer({
  provider,
  status,
  operation,
  receipt,
  error,
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
  onVerify: () => void;
  onQuery: () => void;
  onClose: () => void;
  canRequest: boolean;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const live = isLiveProviderId(provider.id);
  const activeState = operation === 'verify' ? 'verifying' : operation === 'query' ? 'querying' : status?.status;
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
    ? 'RUNTIME · OPTIONAL CURATED SOURCE'
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
          {live ? (
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
                  ? 'SpacetimeDB runs the Proactive room. Query testing applies only to a separately configured SPACETIME_SOURCE database and curated view.'
                  : 'Verification calls the provider through the typed broker. A green state appears only after that request succeeds.'
                : provider.summary}
            </p>

            {live && provider.configurationKeys && (
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
          {live ? (
            <>
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
    setBrokerState('checking');
    setBrokerMessage('Checking the local connector broker');
    try {
      const snapshot = await getConnectorStatuses(signal, idToken);
      setStatuses(snapshot.providers);
      setBrokerState('online');
      setBrokerMessage(snapshot.brokerMessage ?? 'Secrets stay in the server environment');
    } catch (requestError) {
      if (signal?.aborted) return;
      const message = requestError instanceof Error ? requestError.message : 'Connector broker is unavailable';
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
  }, [authConfigured, authLoading, idToken]);

  const visibleProviders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return providers.filter(provider => {
      const matchesFilter = filter === 'all' || provider.causalRoles.includes(filter);
      const searchable = `${provider.name} ${provider.summary} ${provider.capabilities.join(' ')}`.toLowerCase();
      return matchesFilter && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [filter, query]);

  const runOperation = async (provider: ProviderManifest, operation: Operation) => {
    if (!isLiveProviderId(provider.id)) return;
    const providerId = provider.id;
    setSelected(provider);
    setOperations(current => ({ ...current, [providerId]: operation }));
    setErrors(current => ({ ...current, [providerId]: undefined }));
    try {
      const receipt = operation === 'verify'
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
      const message = requestError instanceof Error ? requestError.message : 'The connector request failed.';
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
          <p>Configure credentials in the local server environment, then prove each source with a bounded read. Secrets never enter this page.</p>
        </div>
        <div className={`integrations-header__boundary integrations-header__boundary--${brokerState}`} role="status">
          {brokerState === 'checking' ? <LoaderCircle size={17} aria-hidden="true" /> : <ShieldCheck size={17} strokeWidth={1.8} aria-hidden="true" />}
          <span><strong>{brokerState === 'online' ? 'Broker online' : brokerState === 'offline' ? 'Broker offline' : brokerState === 'auth' ? 'Auth setup needed' : brokerState === 'access' ? 'Access restricted' : brokerState === 'error' ? 'Broker error' : 'Checking broker'}</strong>{brokerMessage}</span>
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
          <div><dt>Secrets</dt><dd>Server environment only</dd></div>
          <div><dt>Queries</dt><dd>Typed connector broker</dd></div>
          <div><dt>Shared state</dt><dd>SpacetimeDB room</dd></div>
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
          onVerify={() => void runOperation(selected, 'verify')}
          onQuery={() => void runOperation(selected, 'query')}
          onClose={() => setSelected(null)}
          canRequest={brokerState === 'online' && Boolean(selectedStatus?.configured)}
        />
      )}
    </div>
  );
}
