import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { userDisplayName, userInitials } from '../lib/transactions';
import { ThemeToggle } from './ThemeToggle';

const mainNavItems = [
  { href: '/', label: 'Home' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/filter', label: 'Filter' }
];

const adminNavItems = [
  { href: '/categories', label: 'Categories' },
  { href: '/stores', label: 'Stores' },
  { href: '/payment-methods', label: 'Payment Methods' },
  { href: '/users', label: 'Users' }
];

function navLinkClass(href, isActive, pathname) {
  const active = href === '/transactions'
    ? pathname.startsWith('/transactions')
    : isActive;
  return active ? 'active' : '';
}

export function Header() {
  const { user, isAdmin, isApproved, logout } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef(null);

  const showAppChrome = Boolean(user && isApproved);
  const displayName = user ? userDisplayName(user) : '';
  const userLabel = displayName ? `${displayName}${isAdmin ? ' (admin)' : ''}` : '';
  const adminSectionActive = adminNavItems.some((item) => location.pathname.startsWith(item.href));

  useEffect(() => {
    setMobileNavOpen(false);
    setAdminMenuOpen(false);
    document.body.classList.remove('mobile-nav-open');
  }, [location.pathname]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 720) {
        setMobileNavOpen(false);
        document.body.classList.remove('mobile-nav-open');
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!adminMenuOpen) return undefined;

    function onPointerDown(event) {
      if (!adminMenuRef.current?.contains(event.target)) {
        setAdminMenuOpen(false);
      }
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') setAdminMenuOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [adminMenuOpen]);

  function toggleMobileNav() {
    setMobileNavOpen((open) => {
      const next = !open;
      document.body.classList.toggle('mobile-nav-open', next);
      return next;
    });
  }

  async function handleLogout() {
    await logout();
    toast('Logged out.');
  }

  return (
    <header className="site-header">
      <div className="header-shell">
        <div className="header-top">
          <Link className="brand" to="/">💸 Oikos</Link>
          <ThemeToggle
            className={`ghost mobile-theme-toggle${showAppChrome ? '' : ' hidden'}`}
            id="mobileThemeToggle"
          />
          <Link
            className={`mobile-profile-link${showAppChrome ? '' : ' hidden'}`}
            to="/me"
            aria-label="Open profile"
            title={userLabel || 'Profile'}
          >
            <span aria-hidden="true">{user ? userInitials(user) : ''}</span>
          </Link>
          <button
            type="button"
            className={`menu-toggle${showAppChrome ? '' : ' hidden'}`}
            id="menuToggle"
            aria-expanded={mobileNavOpen}
            aria-controls="siteNav"
            aria-label="Open navigation menu"
            onClick={toggleMobileNav}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
        <div className="header-panel">
          <nav id="siteNav" aria-label="Main navigation" className={showAppChrome ? '' : 'hidden'}>
            {mainNavItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/'}
                className={({ isActive }) => navLinkClass(item.href, isActive, location.pathname)}
              >
                {item.label}
              </NavLink>
            ))}

            {isAdmin ? (
              <div className="admin-nav" ref={adminMenuRef}>
                <button
                  type="button"
                  className={`admin-nav-trigger${adminSectionActive || adminMenuOpen ? ' active' : ''}`}
                  aria-expanded={adminMenuOpen}
                  aria-haspopup="menu"
                  aria-controls="adminNavMenu"
                  onClick={() => setAdminMenuOpen((open) => !open)}
                >
                  Admin
                  <span className="admin-nav-caret" aria-hidden="true" />
                </button>
                <div
                  id="adminNavMenu"
                  className={`admin-nav-menu${adminMenuOpen ? ' is-open' : ''}`}
                  role="menu"
                  hidden={!adminMenuOpen}
                >
                  {adminNavItems.map((item) => (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      role="menuitem"
                      className={({ isActive }) => (isActive ? 'active' : undefined)}
                      onClick={() => setAdminMenuOpen(false)}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ) : null}
          </nav>
          <div className={`user-menu${user ? '' : ' hidden'}`} id="userMenu">
            <ThemeToggle id="themeToggle" />
            <Link
              to="/me"
              id="userName"
              className="user-link"
              aria-label={userLabel || 'Profile'}
              title={userLabel || 'Profile'}
            >
              {user ? userInitials(user) : ''}
            </Link>
            <button type="button" id="logoutButton" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </div>
    </header>
  );
}
