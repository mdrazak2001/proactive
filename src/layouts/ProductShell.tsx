import {
  Activity,
  Boxes,
  FileClock,
  LayoutDashboard,
  LoaderCircle,
  LogIn,
  LogOut,
  Radio,
  Settings,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import './ProductShell.css';

const navItems = [
  { to: '/app/integrations', label: 'Signal sources', icon: Radio },
  { to: '/demo/war-room', label: 'Live room', icon: Activity },
  { to: '/app/services', label: 'Services', icon: Boxes },
  { to: '/app/audit', label: 'Audit trail', icon: FileClock },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

function ProductMark() {
  return (
    <span className="product-mark" aria-label="Proactive">
      <span className="product-mark__signal" aria-hidden="true"><i /><i /><i /></span>
      <strong>PROACTIVE</strong>
    </span>
  );
}

function AuthControl() {
  const { configured, error: authError, loading, user, signInWithGoogle, signOut } = useAuth();
  const [error, setError] = useState('');

  const beginSignIn = () => {
    setError('');
    void signInWithGoogle('/app/integrations').catch(reason => setError(String(reason)));
  };

  const endSession = () => {
    setError('');
    void signOut().catch(reason => setError(String(reason)));
  };

  if (loading) {
    return (
      <div className="product-auth product-auth--loading" aria-label="Checking authentication">
        <LoaderCircle size={15} aria-hidden="true" />
        <span>Checking sign-in</span>
      </div>
    );
  }

  if (user) {
    const label = String(user.profile.email ?? user.profile.name ?? 'Signed in');
    return (
      <div className="product-auth">
        <span className="product-auth__identity"><i>{label.slice(0, 1).toUpperCase()}</i><strong>{label}</strong></span>
        <button type="button" onClick={endSession} aria-label="Sign out" title={error || 'Sign out'}>
          <LogOut size={15} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <button
      className="product-auth product-auth--signin"
      type="button"
      onClick={beginSignIn}
      disabled={!configured}
      title={configured ? error || authError || 'Continue with Google' : 'Add the SpacetimeAuth public client ID to enable Google sign-in'}
    >
      <LogIn size={15} aria-hidden="true" />
      <span>{configured ? 'Continue with Google' : 'Auth setup needed'}</span>
    </button>
  );
}

export default function ProductShell() {
  return (
    <div className="product-shell">
      <aside className="product-sidebar">
        <Link className="product-home-link" to="/"><ProductMark /></Link>
        <div className="product-workspace-switcher">
          <LayoutDashboard size={16} aria-hidden="true" />
          <span><strong>Local workspace</strong><small>Product preview</small></span>
        </div>
        <nav className="product-nav" aria-label="Product navigation">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                className={({ isActive }) => isActive ? 'product-nav__link is-active' : 'product-nav__link'}
                key={item.to}
                to={item.to}
              >
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="product-sidebar__note">
          <span>DEMO BOUNDARY</span>
          <p>No production credentials are stored in this client.</p>
        </div>
      </aside>

      <section className="product-stage">
        <header className="product-topbar">
          <Link to="/">Product</Link>
          <span>Connector console</span>
          <AuthControl />
          <Link className="product-topbar__demo" to="/demo/war-room">
            Open live demo <span aria-hidden="true">↗</span>
          </Link>
        </header>
        <main className="product-content">
          <Outlet />
        </main>
      </section>
    </div>
  );
}
