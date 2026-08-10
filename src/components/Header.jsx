import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDownIcon, MenuIcon, XIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { userDisplayName, userInitials } from '@/lib/transactions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

function navClass(href, isActive, pathname) {
  const active = href === '/transactions'
    ? pathname.startsWith('/transactions')
    : isActive;
  return cn(
    'inline-flex h-9 items-center rounded-md px-2.5 text-sm font-medium transition-colors',
    active
      ? 'bg-muted text-foreground'
      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
  );
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
  }, [location.pathname]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setMobileNavOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!adminMenuOpen) return undefined;
    function onPointerDown(event) {
      if (!adminMenuRef.current?.contains(event.target)) setAdminMenuOpen(false);
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

  async function handleLogout() {
    await logout();
    toast('Logged out.');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link to="/" className="shrink-0 text-base font-extrabold tracking-tight text-foreground no-underline">
          💸 Oikos
        </Link>

        {showAppChrome ? (
          <>
            <nav
              id="siteNav"
              aria-label="Main navigation"
              className="hidden min-w-0 flex-1 items-center justify-end gap-1 md:flex"
            >
              {mainNavItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === '/'}
                  className={({ isActive }) => navClass(item.href, isActive, location.pathname)}
                >
                  {item.label}
                </NavLink>
              ))}

              {isAdmin ? (
                <div className="relative" ref={adminMenuRef}>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex h-9 items-center gap-1 rounded-md px-2.5 text-sm font-medium transition-colors',
                      adminSectionActive || adminMenuOpen
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                    )}
                    aria-expanded={adminMenuOpen}
                    aria-haspopup="menu"
                    aria-controls="adminNavMenu"
                    onClick={() => setAdminMenuOpen((open) => !open)}
                  >
                    Admin
                    <ChevronDownIcon className="size-3.5 opacity-70" />
                  </button>
                  {adminMenuOpen ? (
                    <div
                      id="adminNavMenu"
                      role="menu"
                      className="absolute right-0 z-50 mt-2 min-w-48 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
                    >
                      {adminNavItems.map((item) => (
                        <NavLink
                          key={item.href}
                          to={item.href}
                          role="menuitem"
                          className={({ isActive }) => cn(
                            'block rounded-lg px-3 py-2 text-sm font-medium no-underline',
                            isActive
                              ? 'bg-muted text-foreground'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                          onClick={() => setAdminMenuOpen(false)}
                        >
                          {item.label}
                        </NavLink>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="ml-2 flex items-center gap-1.5 border-l border-border pl-3">
                <ThemeToggle id="themeToggle" className="size-9" />
                <Button asChild variant="outline" size="icon" className="size-9 rounded-full">
                  <Link to="/me" aria-label={userLabel || 'Profile'} title={userLabel || 'Profile'}>
                    {userInitials(user)}
                  </Link>
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            </nav>

            <div className="flex shrink-0 items-center gap-1.5 md:hidden">
              <ThemeToggle className="size-9" id="mobileThemeToggle" />
              <Button asChild variant="outline" size="icon" className="size-9 rounded-full">
                <Link to="/me" aria-label="Open profile" title={userLabel || 'Profile'}>
                  <span aria-hidden="true">{user ? userInitials(user) : ''}</span>
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9"
                aria-expanded={mobileNavOpen}
                aria-controls="mobileSiteNav"
                aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
                onClick={() => setMobileNavOpen((open) => !open)}
              >
                {mobileNavOpen ? <XIcon className="size-4" /> : <MenuIcon className="size-4" />}
              </Button>
            </div>
          </>
        ) : null}
      </div>

      {showAppChrome && mobileNavOpen ? (
        <div
          id="mobileSiteNav"
          className="border-t border-border bg-background px-4 py-3 md:hidden"
        >
          <nav aria-label="Mobile navigation" className="grid gap-1">
            {mainNavItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/'}
                className={({ isActive }) => cn(
                  'rounded-lg px-3 py-2.5 text-sm font-medium',
                  isActive || (item.href === '/transactions' && location.pathname.startsWith('/transactions'))
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {item.label}
              </NavLink>
            ))}
            {isAdmin ? (
              <div className="mt-2 grid gap-1 border-t border-border pt-2">
                <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Admin
                </p>
                {adminNavItems.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    className={({ isActive }) => cn(
                      'rounded-lg px-3 py-2.5 text-sm font-medium',
                      isActive ? 'bg-muted text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ) : null}
            <Button type="button" variant="outline" className="mt-2" onClick={handleLogout}>
              Logout
            </Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
