import { lazy, Suspense } from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';
import LandingPage from './features/marketing/LandingPage';
import IntegrationsPage from './features/integrations/IntegrationsPage';
import LegalPage from './features/legal/LegalPage';
import ProductShell from './layouts/ProductShell';
import { AuthProvider } from './auth/AuthProvider';
import AuthCallbackPage from './auth/AuthCallbackPage';

const WarRoomRoute = lazy(() => import('./WarRoomRoute'));

function RouteLoading() {
  return (
    <main className="route-state" aria-live="polite">
      <span className="route-state__signal" aria-hidden="true"><i /><i /><i /></span>
      <strong>Opening the shared room</strong>
      <p>Connecting the realtime investigation surface…</p>
    </main>
  );
}

function ProductPlaceholder({ title }: { title: string }) {
  return (
    <section className="product-placeholder">
      <span>PRODUCT PREVIEW</span>
      <h1>{title}</h1>
      <p>This surface comes after the first verified connector path. The live demo and signal-source blueprint are ready to inspect now.</p>
      <Link to="/app/integrations">Open signal sources <span aria-hidden="true">→</span></Link>
    </section>
  );
}

function NotFound() {
  return (
    <main className="route-state">
      <span>404 · OFF AIR</span>
      <strong>That surface is not in this room.</strong>
      <Link to="/">Return to Proactive</Link>
    </main>
  );
}

export default function RouterApp() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/privacy" element={<LegalPage document="privacy" />} />
          <Route path="/terms" element={<LegalPage document="terms" />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/app" element={<ProductShell />}>
            <Route index element={<Navigate to="integrations" replace />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="services" element={<ProductPlaceholder title="Services" />} />
            <Route path="audit" element={<ProductPlaceholder title="Audit trail" />} />
            <Route path="settings" element={<ProductPlaceholder title="Workspace settings" />} />
          </Route>
          <Route
            path="/demo/war-room"
            element={
              <Suspense fallback={<RouteLoading />}>
                <WarRoomRoute />
              </Suspense>
            }
          />
          <Route path="/room/checkout-r42" element={<Navigate to="/demo/war-room" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
