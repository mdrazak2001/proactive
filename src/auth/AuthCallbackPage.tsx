import { useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, TriangleAlert } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import './auth.css';

export default function AuthCallbackPage() {
  const { configured, error, loading, user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [timedOut, setTimedOut] = useState(false);
  const nextPath = searchParams.get('next');
  const safeNextPath = nextPath?.startsWith('/') && !nextPath.startsWith('//')
    ? nextPath
    : '/app/integrations';

  useEffect(() => {
    if (!loading && user) navigate(safeNextPath, { replace: true });
  }, [loading, navigate, safeNextPath, user]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setTimedOut(true), 8_000);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!configured) {
    return (
      <main className="auth-state">
        <TriangleAlert size={24} aria-hidden="true" />
        <span>AUTH SETUP REQUIRED</span>
        <h1>SpacetimeAuth is not configured.</h1>
        <p>Add the public OIDC client ID locally, then reload this callback.</p>
        <Link to="/app/integrations">Return to integrations</Link>
      </main>
    );
  }

  if (user) {
    return (
      <main className="auth-state">
        <CheckCircle2 size={24} aria-hidden="true" />
        <span>IDENTITY VERIFIED</span>
        <h1>Google sign-in complete.</h1>
        <p>Opening the connector console…</p>
      </main>
    );
  }

  return (
    <main className="auth-state">
      <LoaderCircle className="auth-state__spinner" size={24} aria-hidden="true" />
      <span>VERIFYING IDENTITY</span>
      <h1>{error || timedOut ? 'The sign-in did not complete.' : 'Finishing Google sign-in.'}</h1>
      <p>{error || (timedOut ? 'The callback may be missing from the SpacetimeAuth redirect allow list.' : 'Exchanging the authorization code and restoring your session…')}</p>
      {timedOut && <Link to="/app/integrations">Return to integrations</Link>}
    </main>
  );
}
