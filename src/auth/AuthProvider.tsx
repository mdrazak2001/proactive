import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import {
  AuthProvider as OidcAuthProvider,
  useAuth as useOidcAuth,
  type AuthProviderProps,
} from 'react-oidc-context';
import type { User } from 'oidc-client-ts';

const oidcAuthority = import.meta.env.VITE_OIDC_AUTHORITY?.trim()
  || 'https://auth.spacetimedb.com/oidc';
const oidcClientId = import.meta.env.VITE_OIDC_CLIENT_ID?.trim();

export const isAuthConfigured = Boolean(oidcClientId);

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  error: string;
  user: User | null;
  idToken: string | undefined;
  signInWithGoogle: (nextPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function safeAppPath(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/app/integrations';
}

function AuthBridge({ children }: { children: ReactNode }) {
  const oidc = useOidcAuth();
  const authenticatedUser = oidc.isAuthenticated && !oidc.user?.expired
    ? oidc.user ?? null
    : null;
  const missingIdToken = Boolean(authenticatedUser && !authenticatedUser.id_token);

  const value = useMemo<AuthContextValue>(() => ({
    configured: true,
    // Keep an already-authenticated session usable while silent renewal runs.
    // If renewal returns a new ID token, SpacetimeRoomProvider performs an
    // intentional connection swap instead of briefly falling back to anonymous.
    loading: oidc.isLoading || (!authenticatedUser && Boolean(oidc.activeNavigator)),
    error: oidc.error?.message
      ?? (missingIdToken ? 'SpacetimeAuth did not return the ID token required by SpacetimeDB.' : ''),
    user: authenticatedUser,
    // SpacetimeDB validates the OIDC ID token. The access token is for calling
    // an OIDC resource server and must not be substituted here.
    idToken: authenticatedUser?.id_token,
    signInWithGoogle: async (nextPath = '/app/integrations') => {
      await oidc.signinRedirect({ state: { nextPath: safeAppPath(nextPath) } });
    },
    signOut: async () => {
      await oidc.signoutRedirect();
    },
  }), [authenticatedUser, missingIdToken, oidc]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const unconfiguredAuth: AuthContextValue = {
  configured: false,
  loading: false,
  error: '',
  user: null,
  idToken: undefined,
  signInWithGoogle: async () => {
    throw new Error('SpacetimeAuth is not configured yet.');
  },
  signOut: async () => undefined,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!isAuthConfigured) {
    return <AuthContext.Provider value={unconfiguredAuth}>{children}</AuthContext.Provider>;
  }

  const config: AuthProviderProps = {
    authority: oidcAuthority,
    client_id: oidcClientId!,
    redirect_uri: `${window.location.origin}/auth/callback`,
    post_logout_redirect_uri: `${window.location.origin}/`,
    response_type: 'code',
    scope: 'openid profile email',
    disablePKCE: false,
    automaticSilentRenew: true,
    monitorSession: true,
    onSigninCallback: user => {
      const state = user?.state as { nextPath?: unknown } | undefined;
      // BrowserRouter is already mounted while react-oidc-context processes
      // the callback. A real replace guarantees both the sensitive callback
      // parameters and the router's in-memory location are reset together.
      window.location.replace(safeAppPath(state?.nextPath));
    },
  };

  return (
    <OidcAuthProvider {...config}>
      <AuthBridge>{children}</AuthBridge>
    </OidcAuthProvider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
