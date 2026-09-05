import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Identity } from 'spacetimedb';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { useAuth } from './auth/AuthProvider';
import { DbConnection, type ErrorContext } from './module_bindings';

const HOST = import.meta.env.VITE_SPACETIMEDB_HOST ?? 'ws://localhost:3000';
const DB_NAME = import.meta.env.VITE_SPACETIMEDB_DB_NAME ?? 'react-ts';
const ANONYMOUS_TOKEN_KEY = `${HOST}/${DB_NAME}/anonymous_auth_token`;

type ConnectionCredential =
  | { kind: 'oidc'; idToken: string }
  | { kind: 'anonymous-local-demo' };

function isLoopbackHost(value: string) {
  try {
    const url = new URL(value.replace(/^ws/, 'http'));
    return url.hostname === 'localhost'
      || url.hostname === '127.0.0.1'
      || url.hostname === '::1'
      || url.hostname === '[::1]';
  } catch {
    return false;
  }
}

// Anonymous access is deliberately constrained to a loopback SpacetimeDB.
// Development gets this automatically so the bundled demo remains usable;
// a production preview must opt in and still cannot point at a remote host.
const ALLOW_ANONYMOUS_LOCAL_DEMO = isLoopbackHost(HOST)
  && (import.meta.env.DEV || import.meta.env.VITE_ALLOW_ANONYMOUS_DEMO === 'true');

function readAnonymousToken() {
  try {
    return localStorage.getItem(ANONYMOUS_TOKEN_KEY) || undefined;
  } catch {
    return undefined;
  }
}

function storeAnonymousToken(token: string) {
  try {
    localStorage.setItem(ANONYMOUS_TOKEN_KEY, token);
  } catch {
    // The demo can continue with a new anonymous identity when storage is blocked.
  }
}

function createConnectionBuilder(credential: ConnectionCredential) {
  const token = credential.kind === 'oidc'
    ? credential.idToken
    : readAnonymousToken();

  return DbConnection.builder()
    .withUri(HOST)
    .withDatabaseName(DB_NAME)
    .withToken(token)
    .onConnect((_connection: DbConnection, identity: Identity, sessionToken: string) => {
      // OIDC ID tokens live only in the OIDC session store. Never write one,
      // or a Spacetime session derived from one, under the anonymous demo key.
      if (credential.kind === 'anonymous-local-demo') storeAnonymousToken(sessionToken);
      console.info('Connected to the Proactive demo room as', identity.toHexString());
    })
    .onDisconnect(() => {
      console.info('Disconnected from the Proactive demo room');
    })
    .onConnectError((_context: ErrorContext, error: Error) => {
      console.error('Could not connect to the Proactive demo room', error);
    });
}

function credentialsMatch(
  left: ConnectionCredential | undefined,
  right: ConnectionCredential,
) {
  if (!left || left.kind !== right.kind) return false;
  return left.kind === 'anonymous-local-demo'
    || left.idToken === (right as { kind: 'oidc'; idToken: string }).idToken;
}

function ConnectionMount({
  children,
  credential,
}: {
  children: ReactNode;
  credential: ConnectionCredential;
}) {
  const connectionBuilder = useMemo(
    () => createConnectionBuilder(credential),
    [credential],
  );

  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      {children}
    </SpacetimeDBProvider>
  );
}

/**
 * SpacetimeDB's React connection pool is keyed by host + database, not token.
 * A same-commit keyed remount therefore reuses the old live connection. Leave
 * one macrotask with no provider mounted so the SDK's deferred release closes
 * and deletes the old pool entry before a renewed ID token connects.
 */
function TokenAwareConnection({
  children,
  credential,
}: {
  children: ReactNode;
  credential: ConnectionCredential;
}) {
  const [activeCredential, setActiveCredential] = useState<ConnectionCredential | undefined>(credential);

  useEffect(() => {
    if (!credentialsMatch(activeCredential, credential)) {
      setActiveCredential(undefined);
    }
  }, [activeCredential, credential]);

  useEffect(() => {
    if (activeCredential) return;

    // This effect runs after ConnectionMount has unmounted. Its timer is queued
    // after the SDK's release timer; the small cushion also makes that ordering
    // explicit across React scheduling modes.
    const reconnect = window.setTimeout(() => setActiveCredential(credential), 16);
    return () => window.clearTimeout(reconnect);
  }, [activeCredential, credential]);

  if (!activeCredential) {
    return (
      <main className="route-state" aria-live="polite">
        <strong>Refreshing the live identity</strong>
        <p>Replacing the room connection with the renewed SpacetimeAuth session.</p>
      </main>
    );
  }

  return <ConnectionMount credential={activeCredential}>{children}</ConnectionMount>;
}

function SignInGate({
  authError,
  signIn,
}: {
  authError: string;
  signIn: () => Promise<void>;
}) {
  const [redirectError, setRedirectError] = useState('');

  const beginSignIn = () => {
    setRedirectError('');
    void signIn().catch(reason => {
      setRedirectError(reason instanceof Error ? reason.message : String(reason));
    });
  };

  return (
    <main className="route-state">
      <span>AUTHENTICATION REQUIRED</span>
      <strong>Sign in before opening the live room.</strong>
      <p>{redirectError || authError || 'The production room never falls back to an anonymous identity.'}</p>
      <button className="route-state__action" type="button" onClick={beginSignIn}>
        Continue with Google
      </button>
    </main>
  );
}

export default function SpacetimeRoomProvider({
  children,
  signInReturnTo = '/demo/war-room',
}: {
  children: ReactNode;
  signInReturnTo?: string;
}) {
  const { configured, error, idToken, loading, signInWithGoogle, user } = useAuth();

  const credential = useMemo<ConnectionCredential | undefined>(() => {
    if (configured) {
      return user && idToken ? { kind: 'oidc', idToken } : undefined;
    }
    return ALLOW_ANONYMOUS_LOCAL_DEMO ? { kind: 'anonymous-local-demo' } : undefined;
  }, [configured, idToken, user]);

  if (configured && loading) {
    return (
      <main className="route-state" aria-live="polite">
        <strong>Restoring your identity</strong>
        <p>The live room will connect after the authentication state is known.</p>
      </main>
    );
  }

  if (configured && user && !idToken) {
    return (
      <main className="route-state" role="alert">
        <span>IDENTITY TOKEN MISSING</span>
        <strong>The live room stayed disconnected.</strong>
        <p>{error || 'SpacetimeAuth must return an OpenID Connect ID token for the room connection.'}</p>
      </main>
    );
  }

  if (configured && !user) {
    return <SignInGate authError={error} signIn={() => signInWithGoogle(signInReturnTo)} />;
  }

  if (!credential) {
    return (
      <main className="route-state" role="alert">
        <span>AUTH SETUP REQUIRED</span>
        <strong>Anonymous access is disabled for this host.</strong>
        <p>Add the SpacetimeAuth public client ID. Anonymous demo sessions are allowed only against a loopback database.</p>
      </main>
    );
  }

  return <TokenAwareConnection credential={credential}>{children}</TokenAwareConnection>;
}
