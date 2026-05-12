const navItems = [
  { href: '/', label: 'Home' },
  { href: '/categories', label: 'Categories', adminOnly: true },
  { href: '/stores', label: 'Stores', adminOnly: true },
  { href: '/payment-methods', label: 'Payment Methods', adminOnly: true },
  { href: '/users', label: 'Users', adminOnly: true },
  { href: '/transactions', label: 'Transactions' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/filter', label: 'Filter' }
];

function currentPath() {
  return window.location.pathname;
}

function navMarkup() {
  return navItems.map((item) => `
    <a
      href="${item.href}"
      data-nav="${item.href}"
      ${item.adminOnly ? 'class="admin-only"' : ''}
      ${item.href === currentPath() ? 'class="active' + (item.adminOnly ? ' admin-only' : '') + '"' : ''}
    >${item.label}</a>
  `).join('');
}

class OikosHeader extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <header class="site-header">
        <div class="header-top">
          <a class="brand" href="/">💸 Oikos</a>
          <button
            type="button"
            class="menu-toggle hidden"
            id="menuToggle"
            aria-expanded="false"
            aria-controls="siteNav"
            aria-label="Open navigation menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
        <div class="header-panel">
          <nav id="siteNav" aria-label="Main navigation">
            ${navMarkup()}
          </nav>
          <div class="user-menu hidden" id="userMenu">
            <a href="/me" id="userName" class="user-link"></a>
            <button type="button" id="logoutButton">Logout</button>
          </div>
        </div>
      </header>
    `;
  }
}

class OikosAuthShell extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="page-title">
        <h1>Sign in</h1>
      </div>
      <div class="auth-grid">
        <form id="loginForm" class="panel form-stack">
          <h2>Login</h2>
          <label>
            Email
            <input type="email" name="email" autocomplete="email" required>
          </label>
          <label>
            Password
            <input type="password" name="password" autocomplete="current-password" required>
          </label>
          <button type="submit">Login</button>
        </form>

        <form id="registerForm" class="panel form-stack">
          <h2>Create account</h2>
          <label>
            Name
            <input type="text" name="name" autocomplete="name" placeholder="Optional">
          </label>
          <label>
            Email
            <input type="email" name="email" autocomplete="email" required>
          </label>
          <label>
            Password
            <input type="password" name="password" autocomplete="new-password" minlength="8" required>
          </label>
          <button type="submit">Create account</button>
        </form>
      </div>
    `;
  }
}

customElements.define('oikos-header', OikosHeader);
customElements.define('oikos-auth-shell', OikosAuthShell);
