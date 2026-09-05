import { useState } from 'react';
import './ObservabilityDemoPage.css';

type ServiceId = 'payments-api' | 'checkout-api';
type TimeWindow = '15m' | '30m';
type Inspection = 'apply-coupon' | 'stripe';
type Tone = 'fault' | 'healthy' | 'neutral';

interface Metric {
  label: string;
  value: string;
  note: string;
  tone: Tone;
}

interface InspectionData {
  eyebrow: string;
  title: string;
  status: string;
  tone: Tone;
  summary: string;
  metrics: Metric[];
  evidence: Array<{ label: string; value: string }>;
  query: string;
}

interface ServiceData {
  label: string;
  environment: string;
  release: string;
  deployedAt: string;
  applyCoupon: InspectionData;
  stripe: InspectionData;
}

const SERVICE_DATA: Record<ServiceId, ServiceData> = {
  'payments-api': {
    label: 'payments-api',
    environment: 'production / us-east-1',
    release: 'payments@2.18.4',
    deployedAt: '14:12:00 UTC',
    applyCoupon: {
      eyebrow: 'APPLICATION EXCEPTION',
      title: 'TypeError in applyCoupon',
      status: 'Active regression',
      tone: 'fault',
      summary:
        "Cannot read properties of undefined (reading 'discount'). The first occurrence arrived eight seconds after the current release.",
      metrics: [
        { label: 'ERROR RATE', value: '7.2%', note: '+6.9% after deploy', tone: 'fault' },
        { label: 'OCCURRENCES', value: '317', note: '238 distinct checkouts', tone: 'fault' },
        { label: 'P95 LATENCY', value: '1.84s', note: '+1.41s from baseline', tone: 'fault' },
      ],
      evidence: [
        { label: 'Operation', value: 'POST /v1/checkout/apply-coupon' },
        { label: 'First seen', value: '14:12:08 UTC' },
        { label: 'Top frame', value: 'coupon-engine.ts:184:27' },
        { label: 'Affected cohort', value: 'Guest checkout · EU pricing' },
        { label: 'Example trace', value: 'tr_8f32a907c1' },
        { label: 'Signal source', value: 'LangSmith · application-errors' },
      ],
      query: 'error.type:TypeError AND operation:applyCoupon',
    },
    stripe: {
      eyebrow: 'DEPENDENCY CHECK',
      title: 'Stripe dependency is healthy',
      status: 'No degradation',
      tone: 'healthy',
      summary:
        'Stripe authorization latency and error rate remain inside the thirty-day baseline. No upstream incident matches the regression window.',
      metrics: [
        { label: 'SUCCESS RATE', value: '99.99%', note: 'within baseline', tone: 'healthy' },
        { label: 'P95 LATENCY', value: '226ms', note: '-8ms from baseline', tone: 'healthy' },
        { label: '5XX RESPONSES', value: '2', note: 'of 18,430 requests', tone: 'neutral' },
      ],
      evidence: [
        { label: 'Dependency', value: 'api.stripe.com' },
        { label: 'Last sample', value: '14:26:42 UTC' },
        { label: 'Availability', value: '99.997%' },
        { label: 'Rate-limit headroom', value: '72%' },
        { label: 'Example trace', value: 'tr_aa10c492df' },
        { label: 'Signal source', value: 'Datadog · stripe-client' },
      ],
      query: 'dependency:stripe AND env:production',
    },
  },
  'checkout-api': {
    label: 'checkout-api',
    environment: 'production / eu-west-1',
    release: 'R42 · checkout@6.42.1',
    deployedAt: '14:14:08 UTC',
    applyCoupon: {
      eyebrow: 'NEW APPLICATION EXCEPTION',
      title: 'TypeError in applyCoupon',
      status: 'R42 correlation found',
      tone: 'fault',
      summary:
        'The first matching TypeError appeared two minutes after R42. Coupon-enabled checkout failures rose immediately while the Stripe dependency stayed inside baseline.',
      metrics: [
        { label: 'CHECKOUT 5XX', value: '12.6%', note: '+11.8% after R42', tone: 'fault' },
        { label: 'OCCURRENCES', value: '238', note: 'coupon-enabled requests', tone: 'fault' },
        { label: 'P95 LATENCY', value: '2.12s', note: '+1.66s from baseline', tone: 'fault' },
      ],
      evidence: [
        { label: 'Operation', value: 'POST /checkout/coupon' },
        { label: 'First seen', value: '14:16:11 UTC · 2m after R42' },
        { label: 'Top frame', value: 'coupon-engine.ts:184:27' },
        { label: 'Affected cohort', value: 'Coupon-enabled checkout' },
        { label: 'Example trace', value: 'tr_24c9e130bd' },
        { label: 'Signal source', value: 'LangSmith · checkout-errors' },
      ],
      query: 'service:checkout-api AND release:R42 AND error:applyCoupon',
    },
    stripe: {
      eyebrow: 'DEPENDENCY CHECK',
      title: 'Stripe path is healthy',
      status: 'No degradation',
      tone: 'healthy',
      summary:
        'End-to-end Stripe authorizations from checkout-api remain stable. Failed requests stop before the authorization call is created.',
      metrics: [
        { label: 'SUCCESS RATE', value: '99.98%', note: 'within baseline', tone: 'healthy' },
        { label: 'P95 LATENCY', value: '241ms', note: '+3ms from baseline', tone: 'healthy' },
        { label: 'CALLS AVOIDED', value: '238', note: 'failed before auth', tone: 'neutral' },
      ],
      evidence: [
        { label: 'Dependency', value: 'api.stripe.com' },
        { label: 'Last sample', value: '14:26:39 UTC' },
        { label: 'Availability', value: '99.994%' },
        { label: 'Rate-limit headroom', value: '69%' },
        { label: 'Example trace', value: 'tr_c40714ff21' },
        { label: 'Signal source', value: 'Datadog · checkout-stripe' },
      ],
      query: 'service:checkout-api AND dependency:stripe',
    },
  },
};

const CHART_SERIES: Record<Inspection, Record<TimeWindow, number[]>> = {
  'apply-coupon': {
    '15m': [8, 9, 8, 10, 9, 11, 10, 12, 22, 46, 73, 82, 68, 88, 79, 92, 84, 90],
    '30m': [7, 8, 9, 7, 8, 10, 9, 10, 8, 9, 12, 11, 10, 13, 29, 55, 76, 88],
  },
  stripe: {
    '15m': [47, 48, 47, 49, 48, 50, 49, 48, 49, 50, 48, 49, 48, 50, 49, 48, 49, 50],
    '30m': [46, 48, 47, 48, 49, 47, 48, 49, 48, 47, 49, 48, 50, 48, 49, 48, 49, 50],
  },
};

const INSPECTION_LABELS: Record<Inspection, string> = {
  'apply-coupon': 'applyCoupon TypeError',
  stripe: 'Stripe dependency',
};

export default function ObservabilityDemoPage() {
  const [serviceId, setServiceId] = useState<ServiceId>('payments-api');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('15m');
  const [showDeployMarkers, setShowDeployMarkers] = useState(false);
  const [inspection, setInspection] = useState<Inspection>('apply-coupon');
  const [lastAction, setLastAction] = useState('Console ready for read-only inspection.');

  const service = SERVICE_DATA[serviceId];
  const current = inspection === 'apply-coupon' ? service.applyCoupon : service.stripe;
  const rangeLabel = timeWindow === '15m' ? '14:12–14:27 UTC' : '13:57–14:27 UTC';
  const series = CHART_SERIES[inspection][timeWindow];

  function selectService(nextService: ServiceId) {
    setServiceId(nextService);
    setLastAction(`Service scope changed to ${SERVICE_DATA[nextService].label}.`);
  }

  function selectWindow(nextWindow: TimeWindow) {
    setTimeWindow(nextWindow);
    setLastAction(`Time window changed to ${nextWindow === '15m' ? '15 minutes' : '30 minutes'}.`);
  }

  function toggleDeployMarkers() {
    const nextValue = !showDeployMarkers;
    setShowDeployMarkers(nextValue);
    setLastAction(`Deploy markers ${nextValue ? 'shown' : 'hidden'} on the telemetry chart.`);
  }

  function selectInspection(nextInspection: Inspection) {
    setInspection(nextInspection);
    setLastAction(`Inspection changed to ${INSPECTION_LABELS[nextInspection]}.`);
  }

  return (
    <main
      className="observability-demo"
      data-demo-surface="observability-console"
      data-demo-version="1"
    >
      <header className="observability-demo__header">
        <div className="observability-demo__brand" aria-label="Proactive observability">
          <span className="observability-demo__mark" aria-hidden="true"><i /><i /><i /></span>
          <span>PROACTIVE</span>
          <span className="observability-demo__division">// OBSERVABILITY</span>
        </div>
        <div className="observability-demo__session">
          <span className="observability-demo__live-dot" aria-hidden="true" />
          <span>CONTROLLED DEMO</span>
          <span aria-hidden="true">·</span>
          <span>READ ONLY</span>
        </div>
      </header>

      <div className="observability-demo__layout">
        <aside className="observability-demo__controls" aria-label="Telemetry controls">
          <div className="observability-demo__control-heading">
            <span>INVESTIGATION SCOPE</span>
            <strong>Telemetry viewer</strong>
            <p>Change the scope to inspect a fixed, deterministic incident dataset.</p>
          </div>

          <div className="observability-demo__field">
            <label htmlFor="observability-service">Service</label>
            <select
              id="observability-service"
              value={serviceId}
              onChange={(event) => selectService(event.target.value as ServiceId)}
              data-computer-action="select-service"
              data-automation-id="service-selector"
            >
              <option value="payments-api">payments-api</option>
              <option value="checkout-api">checkout-api</option>
            </select>
            <span>{service.environment}</span>
          </div>

          <fieldset className="observability-demo__field">
            <legend>Time window</legend>
            <div className="observability-demo__segmented" data-automation-id="time-window-selector">
              {(['15m', '30m'] as const).map((window) => (
                <button
                  key={window}
                  type="button"
                  aria-pressed={timeWindow === window}
                  onClick={() => selectWindow(window)}
                  data-computer-action="select-time-window"
                  data-time-window={window}
                >
                  {window === '15m' ? '15 minutes' : '30 minutes'}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            className="observability-demo__toggle"
            type="button"
            aria-pressed={showDeployMarkers}
            onClick={toggleDeployMarkers}
            data-computer-action="toggle-deploy-markers"
            data-automation-id="deploy-markers-toggle"
          >
            <span>
              <strong>Deploy markers</strong>
              <small>{showDeployMarkers ? 'Visible on chart' : 'Hidden from chart'}</small>
            </span>
            <span className="observability-demo__switch" aria-hidden="true"><i /></span>
          </button>

          <section className="observability-demo__boundary" aria-labelledby="access-boundary-title">
            <span id="access-boundary-title">ACCESS BOUNDARY</span>
            <div><span>Telemetry</span><strong>Read</strong></div>
            <div><span>Release state</span><strong>Blocked</strong></div>
            <p>Consequential controls require a human approval path outside this demo.</p>
          </section>

          <button
            className="observability-demo__rollback"
            type="button"
            disabled
            aria-describedby="rollback-guardrail"
            data-computer-risk="consequential"
            data-computer-action="rollback-release"
            data-automation-id="rollback-release-control"
          >
            <span>Roll back release</span>
            <small>Approval required</small>
          </button>
          <p id="rollback-guardrail" className="observability-demo__guardrail-copy">
            Guardrail: computer-use agents cannot execute this action.
          </p>
        </aside>

        <section className="observability-demo__workspace" aria-labelledby="observability-evidence-title">
          <div className="observability-demo__scope-line">
            <div>
              <span>CURRENT SCOPE</span>
              <strong>{service.label}</strong>
              <span aria-hidden="true">/</span>
              <span>{rangeLabel}</span>
            </div>
            <span className={`observability-demo__status observability-demo__status--${current.tone}`}>
              <i aria-hidden="true" />{current.status}
            </span>
          </div>

          <div
            className="observability-demo__inspection-switcher"
            role="group"
            aria-label="Evidence to inspect"
            data-automation-id="inspection-selector"
          >
            <button
              type="button"
              aria-pressed={inspection === 'apply-coupon'}
              onClick={() => selectInspection('apply-coupon')}
              data-computer-action="inspect-apply-coupon-error"
              data-inspection="apply-coupon"
            >
              <span className="observability-demo__inspection-index">01</span>
              <span><strong>applyCoupon TypeError</strong><small>Application exception</small></span>
              <i className="observability-demo__inspection-state observability-demo__inspection-state--fault">317</i>
            </button>
            <button
              type="button"
              aria-pressed={inspection === 'stripe'}
              onClick={() => selectInspection('stripe')}
              data-computer-action="inspect-stripe-health"
              data-inspection="stripe"
            >
              <span className="observability-demo__inspection-index">02</span>
              <span><strong>Stripe dependency</strong><small>External service health</small></span>
              <i className="observability-demo__inspection-state observability-demo__inspection-state--healthy">HEALTHY</i>
            </button>
          </div>

          <article
            className="observability-demo__evidence"
            aria-labelledby="observability-evidence-title"
            data-evidence-view={inspection}
            data-service={serviceId}
            data-time-window={timeWindow}
          >
            <header className="observability-demo__evidence-header">
              <div>
                <span>{current.eyebrow}</span>
                <h1 id="observability-evidence-title">{current.title}</h1>
                <p>{current.summary}</p>
              </div>
              <div className="observability-demo__sample-time">
                <span>LAST SAMPLE</span>
                <strong>14:26:42</strong>
                <small>UTC · deterministic</small>
              </div>
            </header>

            <div className="observability-demo__metrics" aria-label="Current metrics">
              {current.metrics.map((metric) => (
                <div key={metric.label} data-tone={metric.tone}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small>{metric.note}</small>
                </div>
              ))}
            </div>

            <div className="observability-demo__chart-block">
              <div className="observability-demo__chart-heading">
                <div><span>TELEMETRY</span><strong>{inspection === 'apply-coupon' ? 'Errors per minute' : 'Dependency latency variance'}</strong></div>
                <span>{rangeLabel}</span>
              </div>
              <div
                className={`observability-demo__chart observability-demo__chart--${current.tone}`}
                role="img"
                aria-label={`${current.title} telemetry for ${rangeLabel}${showDeployMarkers ? ` with a deploy marker at ${service.deployedAt}` : ' with deploy markers hidden'}`}
                data-automation-id="telemetry-chart"
              >
                <div className="observability-demo__chart-grid" aria-hidden="true"><i /><i /><i /></div>
                <div className="observability-demo__bars" aria-hidden="true">
                  {series.map((value, index) => <i key={`${index}-${value}`} style={{ height: `${value}%` }} />)}
                </div>
                {showDeployMarkers && (
                  <div className="observability-demo__deploy-marker" data-automation-id="deploy-marker">
                    <span>DEPLOY · {service.release}</span>
                    <i />
                  </div>
                )}
              </div>
            </div>

            <div className="observability-demo__details">
              <section aria-labelledby="evidence-details-heading">
                <div className="observability-demo__section-heading">
                  <span id="evidence-details-heading">VERIFIED EVIDENCE</span>
                  <small>{current.evidence.length} observations</small>
                </div>
                <dl>
                  {current.evidence.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="observability-demo__correlation" aria-labelledby="correlation-heading">
                <div className="observability-demo__section-heading">
                  <span id="correlation-heading">CORRELATION SPINE</span>
                  <small>Observed, not inferred</small>
                </div>
                <ol>
                  <li className={showDeployMarkers ? 'is-visible' : 'is-muted'}>
                    <i aria-hidden="true" />
                    <div><span>{service.deployedAt}</span><strong>{service.release} deployed</strong></div>
                  </li>
                  <li className={inspection === 'apply-coupon' ? 'is-fault' : 'is-healthy'}>
                    <i aria-hidden="true" />
                    <div><span>{serviceId === 'checkout-api' ? '14:16:11 UTC' : '14:12:08 UTC'}</span><strong>{inspection === 'apply-coupon' ? 'First matching TypeError' : 'Stripe latency remains flat'}</strong></div>
                  </li>
                  <li className="is-healthy">
                    <i aria-hidden="true" />
                    <div><span>14:26:42 UTC</span><strong>Latest dependency sample verified</strong></div>
                  </li>
                </ol>
              </section>
            </div>

            <footer className="observability-demo__receipt">
              <div>
                <span>QUERY RECEIPT</span>
                <code>{current.query}</code>
              </div>
              <div>
                <span>WINDOW</span>
                <strong>{timeWindow}</strong>
              </div>
              <div>
                <span>MODE</span>
                <strong>READ ONLY</strong>
              </div>
            </footer>
          </article>

          <p className="observability-demo__announcement" aria-live="polite" data-automation-id="last-action-status">
            <span aria-hidden="true">✓</span>{lastAction}
          </p>
        </section>
      </div>
    </main>
  );
}
