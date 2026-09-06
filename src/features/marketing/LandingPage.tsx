import {
  ArrowRight,
  Check,
  CircleDot,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import './LandingPage.css';

const WAITLIST_INTENT_KEY = 'proactive_waitlist_intent';
const WAITLIST_RETURN_PATH = '/';

const signalSources = [
  'Supabase',
  'LangSmith',
  'Supermemory',
  'SpacetimeDB',
  'Browserbase next',
];

const investigationSteps = [
  {
    source: 'CloudWatch',
    query: 'Compare 5xx and p95 latency around release 8f31',
    scope: 'production / checkout-api',
  },
  {
    source: 'Sentry',
    query: 'Group new error fingerprints in the same window',
    scope: 'acme / checkout',
  },
  {
    source: 'PostHog',
    query: 'Measure affected checkout sessions by release',
    scope: 'web / checkout funnel',
  },
];

function LandingAuthAction({ placement }: { placement: 'header' | 'hero' }) {
  const { configured, loading, error, user, signInWithGoogle } = useAuth();
  const [pending, setPending] = useState(false);
  const [redirectError, setRedirectError] = useState('');
  const className = placement === 'header'
    ? 'landing-header__action'
    : 'landing-button landing-button--primary';

  if (user) {
    if (placement === 'header') {
      return (
        <span className="landing-header__action landing-header__action--joined">
          <Check aria-hidden="true" size={15} strokeWidth={1.8} />
          On the waitlist
        </span>
      );
    }

    return (
      <p className="landing-waitlist-status">
        <Check aria-hidden="true" size={16} strokeWidth={1.8} />
        You’re on the waitlist. We’ll write when a seat opens.
      </p>
    );
  }

  if (!configured) {
    return (
      <button
        aria-label="Waitlist unavailable because authentication is not configured"
        className={className}
        disabled
        title="Authentication setup is incomplete"
        type="button"
      >
        Auth setup needed
      </button>
    );
  }

  const beginWaitlist = async () => {
    setPending(true);
    setRedirectError('');
    try {
      sessionStorage.setItem(WAITLIST_INTENT_KEY, '1');
      await signInWithGoogle(WAITLIST_RETURN_PATH);
    } catch (signInError) {
      sessionStorage.removeItem(WAITLIST_INTENT_KEY);
      setRedirectError(signInError instanceof Error ? signInError.message : 'Could not open Google to join the waitlist.');
    } finally {
      setPending(false);
    }
  };

  const actionError = redirectError || error;

  return (
    <>
      <button
        aria-label="Join the Proactive waitlist with Google"
        className={className}
        disabled={loading || pending}
        onClick={() => void beginWaitlist()}
        title={actionError || undefined}
        type="button"
      >
        {pending
          ? 'Opening Google…'
          : loading
            ? 'Checking session…'
            : actionError
              ? 'Try again'
              : 'Join waitlist'}
        <ArrowRight aria-hidden="true" size={placement === 'header' ? 15 : 16} strokeWidth={1.8} />
      </button>
      <span aria-live="polite" className="landing-visually-hidden" role="status">
        {actionError}
      </span>
    </>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const [waitlistNotice, setWaitlistNotice] = useState('');

  useEffect(() => {
    if (!user) return;
    if (sessionStorage.getItem(WAITLIST_INTENT_KEY) !== '1') return;
    sessionStorage.removeItem(WAITLIST_INTENT_KEY);
    setWaitlistNotice('We’ll write when a seat opens.');
  }, [user]);

  useEffect(() => {
    if (!waitlistNotice) return;
    const timer = window.setTimeout(() => setWaitlistNotice(''), 7000);
    return () => window.clearTimeout(timer);
  }, [waitlistNotice]);

  return (
    <div className="proactive-landing">
      <header className="landing-header">
        <Link className="landing-brand" to="/" aria-label="Proactive home">
          <span className="landing-brand__mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>PROACTIVE</span>
        </Link>

        <nav className="landing-nav" aria-label="Primary navigation">
          <a href="#how-it-works">Product</a>
          <Link to="/app/integrations">Integrations</Link>
          <a href="#security">Security</a>
        </nav>

        <LandingAuthAction placement="header" />
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero__copy">
            <p className="landing-eyebrow">
              <span aria-hidden="true" /> Private preview · read-only first
            </p>
            <h1 id="landing-title">
              Leave the incident call with an answer, not a trail of tabs.
            </h1>
            <p className="landing-hero__lede">
              Proactive turns a spoken or typed hypothesis into a bounded
              investigation order, runs it across approved signal sources, and
              keeps every conclusion tethered to evidence.
            </p>

            <div className="landing-hero__actions">
              <LandingAuthAction placement="hero" />
            </div>

            <p className="landing-hero__assurance">
              <ShieldCheck aria-hidden="true" size={16} strokeWidth={1.7} />
              Target boundary: organization-scoped access, explicit approval, verifiable receipts.
            </p>
          </div>

          <div
            className="incident-instrument"
            aria-label="Illustrative incident investigation using demo data"
          >
            <div className="incident-instrument__header">
              <div>
                <span className="incident-severity">SEV-2</span>
                <strong>Checkout error spike</strong>
              </div>
              <span className="instrument-state">
                <CircleDot aria-hidden="true" size={12} />
                SIMULATED RUN · DEMO DATA
              </span>
            </div>

            <div className="incident-tape">
              <article className="incident-stage">
                <div className="incident-stage__rail">
                  <span>01</span>
                  <i aria-hidden="true" />
                </div>
                <div className="incident-stage__body">
                  <p className="stage-label">HYPOTHESIS · 14:38:07</p>
                  <blockquote>
                    “Checkout failures rose after release 8f31. Is the payment
                    adapter timing out, and which sessions are affected?”
                  </blockquote>
                  <p className="stage-attribution">Incident commander · voice capture</p>
                </div>
              </article>

              <article className="incident-stage incident-stage--order">
                <div className="incident-stage__rail">
                  <span>02</span>
                  <i aria-hidden="true" />
                </div>
                <div className="incident-stage__body">
                  <div className="stage-heading-row">
                    <p className="stage-label">INVESTIGATION ORDER</p>
                    <span className="read-only-chip">READ-ONLY · APPROVED</span>
                  </div>
                  <ol className="investigation-list">
                    {investigationSteps.map((step) => (
                      <li key={step.source}>
                        <span className="investigation-list__check" aria-hidden="true">
                          <Check size={12} strokeWidth={2.2} />
                        </span>
                        <div>
                          <strong>{step.query}</strong>
                          <span>{step.source} · {step.scope}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </article>

              <article className="incident-stage incident-stage--evidence">
                <div className="incident-stage__rail">
                  <span>03</span>
                </div>
                <div className="incident-stage__body">
                  <div className="stage-heading-row">
                    <p className="stage-label">EVIDENCE RECEIPT · 14:39:26</p>
                    <span className="evidence-chip">
                      <Radio aria-hidden="true" size={11} /> EVIDENCE READY
                    </span>
                  </div>
                  <p className="evidence-observation">
                    Payment-adapter latency and timeout errors rose 94 seconds
                    after release 8f31; affected sessions share the same failing span.
                  </p>
                  <div className="evidence-boundary">
                    <span>Observed fact</span>
                    <p>3 sources agree on the onset window and service boundary.</p>
                  </div>
                  <div className="evidence-boundary evidence-boundary--inference">
                    <span>Model inference</span>
                    <p>The release is strongly correlated, but causality is not yet proven.</p>
                  </div>
                  <dl className="receipt-meta">
                    <div>
                      <dt>Sources</dt>
                      <dd>CloudWatch · Sentry · PostHog</dd>
                    </div>
                    <div>
                      <dt>Scope</dt>
                      <dd>production / checkout only</dd>
                    </div>
                    <div>
                      <dt>Receipt</dt>
                      <dd>EV-0149 · query fingerprints retained</dd>
                    </div>
                  </dl>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="signal-source-band" aria-labelledby="sources-title">
          <div>
            <p className="landing-section-kicker">SIGNAL SOURCES</p>
            <h2 id="sources-title">One investigation. The systems you already trust.</h2>
          </div>
          <ul aria-label="Live alpha and upcoming connectors">
            {signalSources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
          <p className="signal-source-band__note">
            Four bounded connector paths are live in the local alpha. The War
            Room investigation remains clearly labeled demo data.
          </p>
        </section>

        <section className="operating-model" id="how-it-works" aria-labelledby="model-title">
          <div className="operating-model__intro">
            <p className="landing-section-kicker">OPERATING MODEL</p>
            <h2 id="model-title">The bridge stays human. The investigation accelerates.</h2>
            <p>
              Proactive does not join your meeting as another bot. Share the
              focused War Room view while the agent works inside explicit limits.
            </p>
          </div>

          <ol className="operating-steps">
            <li>
              <span>01</span>
              <div>
                <h3>State the hypothesis</h3>
                <p>Voice or type the question the room needs answered.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Approve exact scope</h3>
                <p>A commander reviews sources, queries, and access boundaries.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Share the evidence</h3>
                <p>Live steps and source receipts stay visible to everyone on the bridge.</p>
              </div>
            </li>
          </ol>
        </section>

        <section className="security-section" id="security" aria-labelledby="security-title">
          <div>
            <p className="landing-section-kicker">TRUST BOUNDARY</p>
            <h2 id="security-title">Credentials stay out of the room.</h2>
          </div>
          <div className="security-section__copy">
            <p>
              The product architecture is designed so an organization admin
              connects read-only sources once. Responders query only approved
              projects; the executor receives scoped access just in time.
            </p>
            <p className="preview-disclosure">
              <strong>Alpha status:</strong> provider reads now pass through a
              server-side allowlist. Tenant-scoped authorization and the isolated
              Browserbase executor are next. Never paste a production API key into
              the demo War Room.
            </p>
          </div>
        </section>

        <section className="landing-final-cta" aria-labelledby="final-cta-title">
          <div>
            <p className="landing-section-kicker">OPEN THE ROOM</p>
            <h2 id="final-cta-title">Make the next incident legible.</h2>
          </div>
          <div className="landing-final-cta__actions">
            <Link className="landing-button landing-button--primary" to="/demo/war-room">
              Enter demo War Room
              <ArrowRight aria-hidden="true" size={16} strokeWidth={1.8} />
            </Link>
            <Link className="landing-text-link" to="/app/integrations">
              Review connector boundaries
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <Link className="landing-brand landing-brand--footer" to="/" aria-label="Proactive home">
          <span className="landing-brand__mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>PROACTIVE</span>
        </Link>
        <p>Live incident investigation · Private preview</p>
        <nav className="landing-footer__links" aria-label="Footer navigation">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/app/integrations">Signal sources</Link>
        </nav>
      </footer>

      {waitlistNotice && (
        <div className="landing-waitlist-notice" role="status">
          <Check aria-hidden="true" size={18} strokeWidth={1.8} />
          <div>
            <strong>Waitlist joined</strong>
            <span>{waitlistNotice}</span>
          </div>
          <button type="button" onClick={() => setWaitlistNotice('')} aria-label="Dismiss waitlist confirmation">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
