import './layout.js';
import { seoConfig } from './seo.config.js';

const state = {
  user: null,
  profileEditMode: false,
  pendingVerificationEmail: '',
  categories: [],
  paymentMethods: [],
  stores: [],
  users: [],
  transactions: [],
  summaryTransactions: [],
  transactionRows: [],
  currentTransaction: null,
  transactionPagination: {
    page: 1,
    perPage: 25,
    totalItems: 0,
    totalPages: 1
  },
  homeTotals: {
    thisMonth: 0,
    lastMonth: 0
  },
  loaded: {
    categories: false,
    paymentMethods: false,
    stores: false,
    users: false,
    transactions: false,
    summaryTransactions: false,
    homeTotals: false
  },
  pending: {}
};

const money = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

function formatDate(dateString) {
  if (!dateString) return '';
  const isoDate = String(dateString).slice(0, 10);
  const [year = '', month = '', day = ''] = isoDate.split('-');
  if (!year || !month || !day) return isoDate || String(dateString);
  
  const format = seoConfig.dateFormat || 'DD-MM-YYYY';
  
  if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
  if (format === 'MM-DD-YYYY') return `${month}-${day}-${year}`;
  if (format === 'DD-MM-YYYY') return `${day}-${month}-${year}`;
  
  return `${day}-${month}-${year}`;
}

function formatLongDate(dateString) {
  if (!dateString) return '';
  const isoDate = String(dateString).slice(0, 10);
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return formatDate(dateString);
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

const routes = {
  '/': 'homePage',
  '/me': 'mePage',
  '/categories': 'categoriesPage',
  '/stores': 'storesPage',
  '/payment-methods': 'paymentMethodsPage',
  '/users': 'usersPage',
  '/transactions': 'transactionsPage',
  '/transactions/:id': 'transactionDetailPage',
  '/dashboard': 'dashboardPage',
  '/filter': 'filterPage'
};

let routeRequestId = 0;
const authHintCookieName = 'oikos_session';
const transactionPageSizeOptions = [10, 25, 50, 100];
const themeStorageKey = 'oikos_theme';

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function has(selector, root = document) {
  return Boolean(qs(selector, root));
}

function preferredSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function savedTheme() {
  const theme = window.localStorage.getItem(themeStorageKey);
  return theme === 'dark' || theme === 'light' ? theme : '';
}

function activeTheme() {
  return document.documentElement.dataset.theme || savedTheme() || preferredSystemTheme();
}

function themeToggleIconMarkup() {
  if (activeTheme() === 'dark') {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 4.75a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V5.5a.75.75 0 0 1 .75-.75Zm0 11a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Zm0 1.5a5.25 5.25 0 1 1 0-10.5 5.25 5.25 0 0 1 0 10.5Zm6.5-6a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm-16 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm13.096-5.846a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.061l-1.06-1.06a.75.75 0 0 1 0-1.061Zm-9.192 9.192a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.061l-1.06-1.06a.75.75 0 0 1 0-1.061Zm10.252 1.06a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.061l-1.06-1.06a.75.75 0 0 1 0-1.061Zm-10.252-10.252a.75.75 0 0 1 1.06 0l1.06 1.06A.75.75 0 0 1 7.464 8.53l-1.06-1.06a.75.75 0 0 1 0-1.061ZM12 17a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 12 17Z"/>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M14.768 3.96a.75.75 0 0 1 .79.214 7.99 7.99 0 0 0 1.947 1.662 8 8 0 1 0-9.679 12.86 8.08 8.08 0 0 0 8.208-.542.75.75 0 0 1 1.125.804 9.5 9.5 0 1 1-2.39-14.762Z"/>
    </svg>
  `;
}

function syncThemeToggleLabels() {
  const nextLabel = activeTheme() === 'dark' ? 'Light mode' : 'Dark mode';
  qsa('[data-theme-toggle]').forEach((button) => {
    button.innerHTML = themeToggleIconMarkup();
    button.title = nextLabel;
    button.setAttribute('aria-label', `Switch to ${nextLabel.toLowerCase()}`);
  });
}

function applyTheme(theme, { persist = true } = {}) {
  const resolved = theme === 'dark' || theme === 'light' ? theme : preferredSystemTheme();
  document.documentElement.dataset.theme = resolved;
  if (persist) {
    window.localStorage.setItem(themeStorageKey, resolved);
  }
  syncThemeToggleLabels();
}

function initializeTheme() {
  applyTheme(savedTheme() || preferredSystemTheme(), { persist: false });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!savedTheme()) applyTheme(preferredSystemTheme(), { persist: false });
  });
}

function toggleTheme() {
  applyTheme(activeTheme() === 'dark' ? 'light' : 'dark');
}

function setSessionHint(enabled) {
  document.documentElement.classList.toggle('has-session', enabled);
  if (enabled) {
    document.cookie = `${authHintCookieName}=1; Path=/; SameSite=Lax`;
  } else {
    document.cookie = `${authHintCookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/auth/me') setAuthView(null);
    const error = new Error(data?.error || 'Request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function toast(message) {
  const node = qs('#toast');
  node.textContent = message;
  node.classList.add('show');
  window.setTimeout(() => node.classList.remove('show'), 3200);
}

function routeKeyForPath(pathname = window.location.pathname) {
  if (routes[pathname]) return pathname;
  if (pathname.startsWith('/transactions/')) return '/transactions/:id';
  return '/';
}

function currentPath() {
  return routeKeyForPath(window.location.pathname);
}

function showPage(path = currentPath()) {
  const navPath = path === '/transactions/:id' ? '/transactions' : path;
  qsa('[data-nav]').forEach((link) => link.classList.toggle('active', link.dataset.nav === navPath));
  closeMobileNav();
}

function isAdmin() {
  return Boolean(state.user?.isAdmin || state.user?.kind === 'admin');
}

function isApprovedUser(user = state.user) {
  return Boolean(user?.approved || user?.isAdmin || user?.kind === 'admin');
}

function setAuthView(user) {
  state.user = user;
  state.profileEditMode = false;
  const approvalPending = Boolean(user && !isApprovedUser(user));
  setSessionHint(Boolean(user) && !approvalPending);
  document.body.classList.toggle('is-authenticated', Boolean(user));
  document.body.classList.toggle('is-admin', Boolean(user?.isAdmin || user?.kind === 'admin'));
  document.body.classList.toggle('approval-pending', approvalPending);
  document.body.classList.remove('mobile-nav-open');
  if (has('#authPage')) qs('#authPage').classList.toggle('hidden', Boolean(user) && !approvalPending);
  if (has('#appShell')) qs('#appShell').classList.toggle('hidden', !user || approvalPending);
  if (has('#authForms')) qs('#authForms').classList.toggle('hidden', approvalPending);
  if (has('#approvalPending')) qs('#approvalPending').classList.toggle('hidden', !approvalPending);
  if (has('#userMenu')) qs('#userMenu').classList.toggle('hidden', !user);
  if (has('nav')) qs('nav').classList.toggle('hidden', !user || approvalPending);
  if (has('#menuToggle')) {
    qs('#menuToggle').classList.toggle('hidden', !user || approvalPending);
    qs('#menuToggle').setAttribute('aria-expanded', 'false');
  }
  const userLabel = user ? `${user.name}${isAdmin() ? ' (admin)' : ''}` : '';
  if (has('#userName')) qs('#userName').textContent = userLabel;
  if (has('#mobileProfileLink')) {
    qs('#mobileProfileLink').title = userLabel || 'Profile';
    qs('#mobileProfileLink').classList.toggle('hidden', !user || approvalPending);
  }
  if (has('#mobileThemeToggle')) {
    qs('#mobileThemeToggle').classList.toggle('hidden', !user || approvalPending);
  }
  if (approvalPending && has('#approvalPendingEmail')) qs('#approvalPendingEmail').textContent = user.email || '';
  renderAuthStatus();
}

function closeMobileNav() {
  document.body.classList.remove('mobile-nav-open');
  if (has('#menuToggle')) qs('#menuToggle').setAttribute('aria-expanded', 'false');
}

function toggleMobileNav() {
  const isOpen = document.body.classList.toggle('mobile-nav-open');
  if (has('#menuToggle')) qs('#menuToggle').setAttribute('aria-expanded', String(isOpen));
}

function option(value, label) {
  return `<option value="${value}">${label}</option>`;
}

function transactionDetailPath(id) {
  return `/transactions/${id}`;
}

function currentTransactionId() {
  if (currentPath() !== '/transactions/:id') return '';
  return decodeURIComponent(window.location.pathname.slice('/transactions/'.length));
}

function transactionPageSizeOptionMarkup(selectedValue) {
  return transactionPageSizeOptions.map((value) => `
    <option value="${value}" ${String(value) === String(selectedValue) ? 'selected' : ''}>${value} per page</option>
  `).join('');
}

function transactionToneClass(transaction) {
  const seed = String(
    transaction.expand?.category?.name
    || transaction.expand?.subcategory?.name
    || transaction.title
    || 'x'
  ).toLowerCase();
  const tones = ['emerald', 'indigo', 'amber', 'rose', 'violet'];
  const index = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length;
  return `transaction-tone-${tones[index]}`;
}

function transactionAvatarLabel(transaction) {
  const text = String(transaction.title || transaction.expand?.subcategory?.name || transaction.expand?.category?.name || 'T').trim();
  return (text[0] || 'T').toUpperCase();
}

function verificationBadge(user) {
  return user?.verified
    ? '<span class="status-pill success">Verified</span>'
    : '<span class="status-pill warning">Pending verification</span>';
}

function approvalBadge(user) {
  return isApprovedUser(user)
    ? '<span class="status-pill success">Approved</span>'
    : '<span class="status-pill warning">Approval pending</span>';
}

function renderAuthStatus() {
  if (!has('#authStatus')) return;
  document.body.classList.toggle('has-auth-status', Boolean(!state.user && state.pendingVerificationEmail));
  if (state.user || !state.pendingVerificationEmail) {
    qs('#authStatus').innerHTML = '';
    return;
  }

  qs('#authStatus').innerHTML = `
    <article class="panel auth-status-panel">
      <div class="detail-list">
        <div class="detail-row">
          <span class="detail-label">Verification pending</span>
          <strong class="detail-value">${state.pendingVerificationEmail}</strong>
        </div>
        <p class="auth-status-copy">Check your inbox for the verification email before signing in. If it didn’t arrive, resend it here.</p>
        <div class="inline-actions">
          <button type="button" class="ghost" data-resend-verification="${state.pendingVerificationEmail}">Resend verification email</button>
          <a class="text-link" href="/verify-email">Open verification page</a>
        </div>
      </div>
    </article>
  `;
}

function otherStoreId() {
  return state.stores.find((store) => store.name?.trim().toLowerCase() === 'other')?.id || '';
}

function displayStore(transaction) {
  return transaction.storeText || transaction.expand?.store?.name || 'Unknown';
}

function summaryLabelFor(transaction, field) {
  if (field === 'month') return String(transaction.date || '').slice(0, 7);
  if (field === 'category') return transaction.category || 'Uncategorized';
  if (field === 'subcategory') return transaction.subcategory || 'None';
  if (field === 'store') return transaction.store || 'Unknown';
  if (field === 'paymentMethod') return transaction.paymentMethod || 'Not set';
  return 'Total';
}

function labelFor(transaction, field) {
  if (field === 'month') return transaction.date.slice(0, 7);
  if (field === 'category') return transaction.expand?.category?.name || 'Uncategorized';
  if (field === 'subcategory') return transaction.expand?.subcategory?.name || 'None';
  if (field === 'store') return displayStore(transaction);
  if (field === 'paymentMethod') return transaction.expand?.payment_method?.name || 'Not set';
  return 'Total';
}

function sumBy(records, group) {
  return records.reduce((map, record) => {
    const key = group(record);
    map[key] = (map[key] || 0) + Number(record.amount || 0);
    return map;
  }, {});
}

function renderSelects() {
  if (!has('#oikosCategory') || !has('#oikosStore') || !has('#oikosPaymentMethod') || !has('#oikosSubcategory')) return;
  const admin = isAdmin();
  const categorySelect = qs('#oikosCategory');
  categorySelect.innerHTML = [
    option('', 'Select category'),
    ...state.categories.map((category) => option(category.id, category.name)),
    ...(admin ? [option('__new__', 'Add new category')] : [])
  ].join('');

  const storeSelect = qs('#oikosStore');
  storeSelect.innerHTML = [
    option('', 'Select store'),
    ...state.stores.map((store) => option(store.id, store.name)),
    ...(admin ? [option('__new__', 'Add new store')] : [])
  ].join('');

  qs('#oikosPaymentMethod').innerHTML = [
    option('', 'Select payment mode'),
    ...state.paymentMethods.map((paymentMethod) => option(paymentMethod.id, paymentMethod.name))
  ].join('');

  renderSubcategorySelect();
  syncStoreInputVisibility();
}

function renderEditSelects(transaction) {
  if (!has('#editCategory') || !has('#editStore') || !has('#editPaymentMethod') || !has('#editSubcategory')) return;
  const categoryId = transaction?.category || qs('#editCategory').value;
  const category = state.categories.find((item) => item.id === categoryId);
  const subcategories = category?.subcategories || [];

  qs('#editCategory').innerHTML = state.categories.map((item) => option(item.id, item.name)).join('');
  qs('#editStore').innerHTML = state.stores.map((item) => option(item.id, item.name)).join('');
  qs('#editPaymentMethod').innerHTML = [
    option('', 'Select payment mode'),
    ...state.paymentMethods.map((item) => option(item.id, item.name))
  ].join('');
  qs('#editCategory').value = categoryId;
  qs('#editSubcategory').innerHTML = subcategories.map((item) => option(item.id, item.name)).join('');

  const subcategoryId = transaction?.subcategory || qs('#editSubcategory').value;
  qs('#editSubcategory').value = subcategories.some((item) => item.id === subcategoryId) ? subcategoryId : subcategories[0]?.id || '';
  qs('#editStore').value = transaction?.store || qs('#editStore').value;
  qs('#editPaymentMethod').value = transaction?.payment_method || '';
  if (has('#editStoreText')) qs('#editStoreText').value = transaction?.storeText || '';
  syncEditStoreInputVisibility();
}

function renderSubcategorySelect() {
  if (!has('#oikosCategory') || !has('#oikosSubcategory')) return;
  const categoryId = qs('#oikosCategory').value;
  const category = state.categories.find((item) => item.id === categoryId);
  const subcategories = category?.subcategories || [];
  const subcategorySelect = qs('#oikosSubcategory');
  subcategorySelect.innerHTML = [
    option('', categoryId === '__new__' ? 'Create subcategory' : 'Select subcategory'),
    ...subcategories.map((subcategory) => option(subcategory.id, subcategory.name)),
    ...(isAdmin() ? [option('__new__', 'Add new subcategory')] : [])
  ].join('');
  if (categoryId === '__new__' && isAdmin()) subcategorySelect.value = '__new__';

  if (has('#newCategoryWrap')) qs('#newCategoryWrap').classList.toggle('hidden', !isAdmin() || categoryId !== '__new__');
  if (has('#newSubcategoryWrap')) qs('#newSubcategoryWrap').classList.toggle('hidden', !isAdmin() || (categoryId !== '__new__' && subcategorySelect.value !== '__new__'));
}

function renderStores() {
  if (!has('#storeList')) return;
  qs('#storeList').innerHTML = state.stores.map((store) => `
    <article class="list-item"><strong>${store.name}</strong></article>
  `).join('') || '<p>No stores yet.</p>';
}

function syncStoreInputVisibility() {
  if (!has('#oikosStore') || !has('#newStoreWrap')) return;
  const storeId = qs('#oikosStore').value;
  const isAdminCreatingStore = isAdmin() && storeId === '__new__';
  const usesCustomStoreText = storeId === otherStoreId();
  qs('#newStoreWrap').classList.toggle('hidden', !isAdminCreatingStore && !usesCustomStoreText);
  const input = qs('#newStoreWrap input');
  input.name = isAdminCreatingStore ? 'storeName' : 'storeText';
}

function syncEditStoreInputVisibility() {
  if (!has('#editStore') || !has('#editStoreTextWrap')) return;
  qs('#editStoreTextWrap').classList.toggle('hidden', qs('#editStore').value !== otherStoreId());
}

function renderUsers() {
  if (!has('#userList')) return;
  if (!state.users.length) {
    qs('#userList').innerHTML = '<p class="panel-empty">No users yet.</p>';
    return;
  }

  qs('#userList').innerHTML = `
    <table class="users-table">
      <thead>
        <tr>
          <th scope="col">User</th>
          <th scope="col">Role</th>
          <th scope="col">Verification</th>
          <th scope="col">Approval</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${state.users.map((user) => {
          const actions = [];
          if (!user.verified && user.email) {
            actions.push(`<button type="button" class="ghost" data-admin-resend-verification="${user.id}">Resend verification</button>`);
          }
          if (!user.isAdmin && !user.approved) {
            actions.push(`<button type="button" class="ghost" data-approve-user="${user.id}">Approve user</button>`);
          }

          return `
            <tr>
              <td class="users-table-user-cell" data-label="User">
                <strong class="users-table-name">${user.name || user.email}</strong>
                <span class="users-table-email">${user.email || 'Email hidden'}</span>
              </td>
              <td data-label="Role">
                <span class="pill">${user.isAdmin ? 'Admin' : 'User'}</span>
              </td>
              <td data-label="Verification">${verificationBadge(user)}</td>
              <td data-label="Approval">${approvalBadge(user)}</td>
              <td class="users-table-actions-cell" data-label="Actions">
                ${actions.length ? `
                  <details class="row-menu">
                    <summary class="row-menu-trigger">Actions</summary>
                    <div class="row-menu-panel">
                      ${actions.join('')}
                    </div>
                  </details>
                ` : '<span class="users-table-empty">No actions</span>'}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderMe() {
  if (!has('#meProfile')) return;
  const user = state.user;
  if (!user) {
    qs('#meProfile').innerHTML = '<p>Please sign in to view your profile.</p>';
    return;
  }

  const profileHeader = `
    <div class="page-title-bar">
      <div class="page-title">
        <p class="eyebrow">Profile</p>
        <h1>Me</h1>
      </div>
      <div class="inline-actions">
        ${state.profileEditMode ? `
          <button type="submit" form="profileEditForm">Save profile</button>
          <button type="button" class="ghost" data-cancel-profile-edit>Cancel</button>
        ` : `
          <button type="button" class="ghost" data-edit-profile>Edit profile</button>
        `}
      </div>
    </div>
  `;

  if (!state.profileEditMode) {
    qs('#meProfile').innerHTML = `
      ${profileHeader}
      <article class="panel">
        <div class="detail-list">
          <div class="detail-row">
            <span class="detail-label">Name</span>
            <strong class="detail-value">${user.name || '-'}</strong>
          </div>
          <div class="detail-row">
            <span class="detail-label">Email</span>
            <div class="detail-value detail-inline">
              <span>${user.email || '-'}</span>
              ${verificationBadge(user)}
            </div>
          </div>
          <div class="detail-row">
            <span class="detail-label">Transaction page size</span>
            <div class="detail-value detail-stack">
              <label>
                <select data-transaction-page-size>
                  ${transactionPageSizeOptionMarkup(user.transactionPageSize || state.transactionPagination.perPage)}
                </select>
              </label>
              <div class="detail-help">Choose how many transactions load on each page by default.</div>
            </div>
          </div>
          <div class="detail-row">
            <span class="detail-label">Email verification</span>
            <div class="detail-value detail-stack">
              <div>${user.verified ? 'Your email is verified.' : 'Your email still needs verification.'}</div>
              ${user.verified ? '' : '<button type="button" class="ghost" data-resend-verification>Resend verification email</button>'}
            </div>
          </div>
          <div class="detail-row">
            <span class="detail-label">Admin approval</span>
            <div class="detail-value detail-stack">
              <div class="detail-inline">${approvalBadge(user)}</div>
              <div>${isApprovedUser(user) ? 'Your account is approved.' : 'Your account is waiting for admin approval.'}</div>
            </div>
          </div>
          <div class="detail-row">
            <span class="detail-label">Email visibility</span>
            <div class="detail-value">
              <label class="toggle-switch">
                <input type="checkbox" ${user.emailVisibility ? 'checked' : ''} data-email-visibility>
                <span class="toggle-slider"></span>
              </label>
              <div style="font-size: 0.85rem; color: #666; margin-top: 0.5rem;">
                ${user.emailVisibility ? 'Your email is visible to other users and admins.' : 'Your email is hidden from other users and admin lists.'}
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
    return;
  }

  qs('#meProfile').innerHTML = `
    ${profileHeader}
    <article class="panel">
      <form id="profileEditForm" class="detail-list" data-profile-form>
        <div class="detail-row">
          <span class="detail-label">Name</span>
          <label class="detail-value detail-stack">
            <input type="text" name="name" value="${user.name || ''}" autocomplete="name" required>
            <div class="detail-help">Update the display name shown around the app.</div>
          </label>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email</span>
          <label class="detail-value detail-stack">
            <input type="email" name="email" value="${user.email || ''}" autocomplete="email" required>
            <div class="detail-inline">
              <span>${user.email || '-'}</span>
              ${verificationBadge(user)}
            </div>
            <div class="detail-help">If your email changes, you may need to verify the new address again.</div>
          </label>
        </div>
        <div class="detail-row">
          <span class="detail-label">Transaction page size</span>
          <div class="detail-value detail-stack">
            <label>
              <select data-transaction-page-size>
                ${transactionPageSizeOptionMarkup(user.transactionPageSize || state.transactionPagination.perPage)}
              </select>
            </label>
            <div class="detail-help">Choose how many transactions load on each page by default.</div>
          </div>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email verification</span>
          <div class="detail-value detail-stack">
            <div>${user.verified ? 'Your email is verified.' : 'Your email still needs verification.'}</div>
            ${user.verified ? '' : '<button type="button" class="ghost" data-resend-verification>Resend verification email</button>'}
          </div>
        </div>
        <div class="detail-row">
          <span class="detail-label">Admin approval</span>
          <div class="detail-value detail-stack">
            <div class="detail-inline">${approvalBadge(user)}</div>
            <div>${isApprovedUser(user) ? 'Your account is approved.' : 'Your account is waiting for admin approval.'}</div>
          </div>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email visibility</span>
          <div class="detail-value">
            <label class="toggle-switch">
              <input type="checkbox" ${user.emailVisibility ? 'checked' : ''} data-email-visibility>
              <span class="toggle-slider"></span>
            </label>
            <div style="font-size: 0.85rem; color: #666; margin-top: 0.5rem;">
              ${user.emailVisibility ? 'Your email is visible to other users and admins.' : 'Your email is hidden from other users and admin lists.'}
            </div>
          </div>
        </div>
      </form>
    </article>
  `;
}

async function submitProfileBasics(form) {
  const formData = new FormData(form);
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim();

  if (!name || !email) {
    toast('Name and email are required.');
    return;
  }

  try {
    const emailChanged = email.toLowerCase() !== String(state.user?.email || '').toLowerCase();
    await saveProfileSettings(
      { name, email },
      emailChanged ? 'Profile updated. Verify the new email if prompted.' : 'Profile updated.'
    );
    state.profileEditMode = false;
    renderMe();
  } catch (error) {
    toast(error.message);
  }
}

function renderTransactionPagination() {
  if (!has('#transactionsPagination')) return;

  const { page, perPage, totalItems, totalPages } = state.transactionPagination;
  const safePage = Math.max(page || 1, 1);
  const safeTotalPages = Math.max(totalPages || 1, 1);
  const startItem = totalItems ? ((safePage - 1) * perPage) + 1 : 0;
  const endItem = totalItems ? Math.min(safePage * perPage, totalItems) : 0;
  qs('#transactionsPagination').classList.remove('hidden');

  qs('#transactionsPagination').innerHTML = `
    <div class="pagination-summary">
      <strong>${startItem}-${endItem} of ${totalItems}</strong>
      <span>Page ${safePage} of ${safeTotalPages}</span>
    </div>
    <div class="pagination-actions">
      <label class="pagination-page-size">
        <span>Rows</span>
        <select data-transaction-page-size>
          ${transactionPageSizeOptionMarkup(perPage)}
        </select>
      </label>
      <button type="button" class="ghost" data-page-action="prev" ${safePage <= 1 ? 'disabled' : ''}>Previous</button>
      <button type="button" class="ghost" data-page-action="next" ${safePage >= safeTotalPages ? 'disabled' : ''}>Next</button>
    </div>
  `;
}

function renderPaymentMethods() {
  if (!has('#paymentMethodList')) return;
  qs('#paymentMethodList').innerHTML = state.paymentMethods.map((paymentMethod) => `
    <article class="list-item">
      <div class="list-heading">
        <strong>${paymentMethod.name}</strong>
        ${isAdmin() ? `<button class="ghost small-button" data-edit-payment-method="${paymentMethod.id}">Edit</button>` : ''}
      </div>
    </article>
  `).join('') || '<p>No payment methods yet.</p>';
}

function renderCategories() {
  if (!has('#categoryList')) return;
  qs('#categoryList').innerHTML = state.categories.map((category) => `
    <article class="list-item">
      <div class="list-heading">
        <strong>${category.name}</strong>
        ${isAdmin() ? `<button class="ghost small-button" data-edit-category="${category.id}">Edit</button>` : ''}
      </div>
      <div class="pill-list">
        ${(category.subcategories || []).map((subcategory) => `
          <span class="pill">
            ${subcategory.name}
            ${isAdmin() ? `<button class="pill-button" data-edit-subcategory="${subcategory.id}">Edit</button>` : ''}
          </span>
        `).join('') || '<span class="pill">No subcategories</span>'}
      </div>
    </article>
  `).join('') || '<p>No categories yet.</p>';
}

function renderTransactions() {
  if (!has('#transactionsList')) return;
  if (!state.transactionRows.length) {
    qs('#transactionsList').innerHTML = '<div class="panel"><p class="panel-empty">No transactions yet.</p></div>';
    renderTransactionPagination();
    return;
  }

  const grouped = state.transactionRows.reduce((acc, transaction) => {
    const key = String(transaction.date || '').slice(0, 10);
    if (!acc[key]) {
      acc[key] = { date: key, total: 0, items: [] };
    }
    acc[key].items.push(transaction);
    acc[key].total += Number(transaction.amount || 0);
    return acc;
  }, {});

  qs('#transactionsList').innerHTML = Object.values(grouped).map((group) => `
    <section class="transaction-day-group">
      <header class="transaction-day-header">
        <div>
          <h2>${formatLongDate(group.date)}</h2>
        </div>
        <strong class="transaction-day-total">${money.format(group.total)}</strong>
      </header>
      <div class="transaction-day-items">
        ${group.items.map((transaction) => `
          <a class="transaction-list-card" href="${transactionDetailPath(transaction.id)}" data-transaction-link="${transaction.id}">
            <div class="transaction-list-avatar ${transactionToneClass(transaction)}" aria-hidden="true">${transactionAvatarLabel(transaction)}</div>
            <div class="transaction-list-main">
              <div class="transaction-list-topline">
                <strong class="transaction-list-title">${transaction.title || transaction.expand?.subcategory?.name || 'Untitled transaction'}</strong>
                ${transaction.expand?.category?.name ? `<span class="transaction-list-badge">${transaction.expand?.category?.name}</span>` : ''}
              </div>
              <div class="transaction-list-subline">
                ${transaction.expand?.subcategory?.name || 'None'} • ${displayStore(transaction)} • ${transaction.expand?.payment_method?.name || 'Not set'}
                ${isAdmin() ? ` • ${transaction.expand?.user?.email || transaction.expand?.user?.name || 'Unknown user'}` : ''}
              </div>
            </div>
            <div class="transaction-list-side">
              <strong class="transaction-list-amount">${money.format(Number(transaction.amount || 0))}</strong>
              <span class="transaction-list-date">${formatLongDate(transaction.date)}</span>
            </div>
            <div class="transaction-list-chevron" aria-hidden="true">›</div>
            <div class="transaction-list-mobile-meta">
              <strong class="transaction-list-amount">${money.format(Number(transaction.amount || 0))}</strong>
              <span class="transaction-list-date">${formatLongDate(transaction.date)}</span>
            </div>
          </a>
        `).join('')}
      </div>
    </section>
  `).join('');
  renderTransactionPagination();
}

function renderTransactionDetail() {
  if (!has('#transactionDetailCard')) return;
  const transaction = state.currentTransaction;
  if (!transaction) {
    qs('#transactionDetailCard').innerHTML = '<p class="panel-empty">Transaction not found.</p>';
    return;
  }

  qs('#transactionDetailCard').innerHTML = `
    <div class="transaction-detail-hero">
      <div>
        <p class="eyebrow">Recorded on ${formatLongDate(transaction.date)}</p>
        <h2>${transaction.title || transaction.expand?.subcategory?.name || 'Untitled transaction'}</h2>
      </div>
      <strong class="transaction-detail-amount">${money.format(Number(transaction.amount || 0))}</strong>
    </div>
    <div class="detail-list transaction-detail-list">
      <div class="detail-row">
        <span class="detail-label">Category</span>
        <strong class="detail-value">${transaction.expand?.category?.name || 'Uncategorized'}</strong>
      </div>
      <div class="detail-row">
        <span class="detail-label">Subcategory</span>
        <strong class="detail-value">${transaction.expand?.subcategory?.name || 'None'}</strong>
      </div>
      <div class="detail-row">
        <span class="detail-label">Store</span>
        <strong class="detail-value">${displayStore(transaction)}</strong>
      </div>
      <div class="detail-row">
        <span class="detail-label">Payment method</span>
        <strong class="detail-value">${transaction.expand?.payment_method?.name || 'Not set'}</strong>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date</span>
        <strong class="detail-value">${formatDate(transaction.date)}</strong>
      </div>
      ${isAdmin() ? `
        <div class="detail-row admin-only">
          <span class="detail-label">User</span>
          <strong class="detail-value">${transaction.expand?.user?.email || transaction.expand?.user?.name || 'Unknown user'}</strong>
        </div>
      ` : ''}
    </div>
    <div class="inline-actions transaction-detail-actions">
      <button type="button" class="ghost" data-edit-transaction-detail="${transaction.id}">Edit transaction</button>
      <button type="button" class="danger" data-delete-transaction-detail="${transaction.id}">Delete transaction</button>
    </div>
  `;
}

function renderTransactionFilterControls() {
  if (!has('#transactionFilterCategory') || !has('#transactionFilterSubcategory')) return;

  const categorySelect = qs('#transactionFilterCategory');
  const selectedCategory = categorySelect.value;
  categorySelect.innerHTML = [
    option('', 'All categories'),
    ...state.categories.map((category) => option(category.id, category.name))
  ].join('');
  categorySelect.value = state.categories.some((category) => category.id === selectedCategory) ? selectedCategory : '';

  if (has('#transactionFilterPaymentMethod')) {
    const paymentMethodSelect = qs('#transactionFilterPaymentMethod');
    const selectedPaymentMethod = paymentMethodSelect.value;
    paymentMethodSelect.innerHTML = [
      option('', 'All payment methods'),
      ...state.paymentMethods.map((method) => option(method.id, method.name))
    ].join('');
    paymentMethodSelect.value = state.paymentMethods.some((method) => method.id === selectedPaymentMethod) ? selectedPaymentMethod : '';
  }

  if (has('#transactionFilterStore')) {
    const storeSelect = qs('#transactionFilterStore');
    const selectedStore = storeSelect.value;
    storeSelect.innerHTML = [
      option('', 'All stores'),
      ...state.stores.map((store) => option(store.id, store.name))
    ].join('');
    storeSelect.value = state.stores.some((store) => store.id === selectedStore) ? selectedStore : '';
  }

  if (has('#transactionFilterUser')) {
    const userSelect = qs('#transactionFilterUser');
    const selectedUser = userSelect.value;
    userSelect.innerHTML = [
      option('', 'All users'),
      ...state.users.map((user) => option(user.id, user.name || user.email))
    ].join('');
    userSelect.value = state.users.some((user) => user.id === selectedUser) ? selectedUser : '';
  }

  updateTransactionFilterSubcategories();
  syncTransactionFilterVisibility();
}

function updateTransactionFilterSubcategories() {
  if (!has('#transactionFilterCategory') || !has('#transactionFilterSubcategory')) return;

  const categoryId = qs('#transactionFilterCategory').value;
  const subcategorySelect = qs('#transactionFilterSubcategory');
  const selectedSubcategory = subcategorySelect.value;
  const category = state.categories.find((item) => item.id === categoryId);
  const subcategories = category?.subcategories || [];

  subcategorySelect.innerHTML = [
    option('', 'All subcategories'),
    ...subcategories.map((subcategory) => option(subcategory.id, subcategory.name))
  ].join('');
  subcategorySelect.disabled = !categoryId;
  subcategorySelect.value = subcategories.some((subcategory) => subcategory.id === selectedSubcategory) ? selectedSubcategory : '';
}

function hasActiveTransactionFilters() {
  if (!has('#transactionFilterForm')) return false;
  const data = new FormData(qs('#transactionFilterForm'));
  return ['fromDate', 'toDate', 'category', 'subcategory', 'paymentMethod', 'store', 'user'].some((key) => String(data.get(key) || '').trim());
}

function syncTransactionFilterVisibility(forceOpen = false) {
  if (!has('#transactionFiltersPanel') || !has('#toggleTransactionFilters')) return;

  const shouldOpen = forceOpen || hasActiveTransactionFilters();
  qs('#transactionFiltersPanel').classList.toggle('hidden', !shouldOpen);
  qs('#toggleTransactionFilters').setAttribute('aria-expanded', String(shouldOpen));
}

function toggleTransactionFilters() {
  if (!has('#transactionFiltersPanel') || !has('#toggleTransactionFilters')) return;

  const panel = qs('#transactionFiltersPanel');
  const willOpen = panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !willOpen);
  qs('#toggleTransactionFilters').setAttribute('aria-expanded', String(willOpen));
}

function renderHomeTotals() {
  if (!has('#thisMonthTotal') || !has('#lastMonthTotal')) return;
  qs('#thisMonthTotal').textContent = money.format(state.homeTotals.thisMonth || 0);
  qs('#lastMonthTotal').textContent = money.format(state.homeTotals.lastMonth || 0);
}

function renderBars(selector, totals) {
  if (!has(selector)) return;
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const max = Math.max(...entries.map(([, total]) => total), 1);
  qs(selector).innerHTML = entries.map(([name, total]) => `
    <div class="bar-row">
      <strong>${name}</strong>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max((total / max) * 100, 4)}%"></div></div>
      <span>${money.format(total)}</span>
    </div>
  `).join('') || '<p>No expense data yet.</p>';
}

function renderDashboard() {
  renderBars('#monthChart', sumBy(state.summaryTransactions, (transaction) => String(transaction.date || '').slice(0, 7)));
  renderBars('#categoryChart', sumBy(state.summaryTransactions, (transaction) => transaction.category || 'Uncategorized'));
  renderBars('#storeChart', sumBy(state.summaryTransactions, (transaction) => transaction.store || 'Unknown'));
}

function renderPivot(row = 'month', column = 'category') {
  if (!has('#pivotTable')) return;
  const rowLabels = [...new Set(state.summaryTransactions.map((transaction) => summaryLabelFor(transaction, row)))].sort();
  const columnLabels = [...new Set(state.summaryTransactions.map((transaction) => summaryLabelFor(transaction, column)))].sort();
  const matrix = {};

  state.summaryTransactions.forEach((transaction) => {
    const rowKey = summaryLabelFor(transaction, row);
    const columnKey = summaryLabelFor(transaction, column);
    matrix[rowKey] = matrix[rowKey] || {};
    matrix[rowKey][columnKey] = (matrix[rowKey][columnKey] || 0) + Number(transaction.amount);
  });

  qs('#pivotTable').innerHTML = `
    <thead>
      <tr><th>${row}</th>${columnLabels.map((label) => `<th>${label}</th>`).join('')}<th>Total</th></tr>
    </thead>
    <tbody>
      ${rowLabels.map((rowLabel) => {
        const total = columnLabels.reduce((sum, columnLabel) => sum + (matrix[rowLabel]?.[columnLabel] || 0), 0);
        return `<tr><th>${rowLabel}</th>${columnLabels.map((columnLabel) => `<td>${money.format(matrix[rowLabel]?.[columnLabel] || 0)}</td>`).join('')}<td>${money.format(total)}</td></tr>`;
      }).join('') || '<tr><td>No transaction data yet.</td></tr>'}
    </tbody>
  `;
}

function resetDataState() {
  const defaultPerPage = state.user?.transactionPageSize || 25;
  state.categories = [];
  state.paymentMethods = [];
  state.stores = [];
  state.users = [];
  state.transactions = [];
  state.summaryTransactions = [];
  state.transactionRows = [];
  state.currentTransaction = null;
  state.transactionPagination = {
    page: 1,
    perPage: defaultPerPage,
    totalItems: 0,
    totalPages: 1
  };
  state.homeTotals = { thisMonth: 0, lastMonth: 0 };
  Object.keys(state.loaded).forEach((key) => {
    state.loaded[key] = false;
  });
  state.pending = {};
  renderHomeTotals();
}

function invalidate(...keys) {
  keys.forEach((key) => {
    state.loaded[key] = false;
  });
}

async function ensureLoaded(key, loader, force = false) {
  if (force) state.loaded[key] = false;
  if (state.loaded[key]) return;
  if (!state.pending[key]) {
    state.pending[key] = loader().finally(() => {
      delete state.pending[key];
    });
  }
  await state.pending[key];
}

async function loadCategories(force = false) {
  await ensureLoaded('categories', async () => {
    state.categories = await api('/api/categories');
    state.loaded.categories = true;
  }, force);
}

async function loadPaymentMethods(force = false) {
  await ensureLoaded('paymentMethods', async () => {
    state.paymentMethods = await api('/api/payment-methods');
    state.loaded.paymentMethods = true;
  }, force);
}

async function loadStores(force = false) {
  await ensureLoaded('stores', async () => {
    state.stores = await api('/api/stores');
    state.loaded.stores = true;
  }, force);
}

async function loadUsers(force = false) {
  await ensureLoaded('users', async () => {
    state.users = await api('/api/users');
    state.loaded.users = true;
  }, force);
}

async function loadTransactions(force = false) {
  await ensureLoaded('transactions', async () => {
    const data = await api('/api/transactions');
    state.transactions = data.items || [];
    state.loaded.transactions = true;
  }, force);
}

async function loadSummaryTransactions(force = false) {
  await ensureLoaded('summaryTransactions', async () => {
    const data = await api('/api/summary');
    state.summaryTransactions = data.transactions || [];
    state.loaded.summaryTransactions = true;
  }, force);
}

async function loadTransactionRows() {
  const data = await api(`/api/transactions${buildTransactionFilterQuery()}`);
  if ((data.items || []).length === 0 && (data.totalItems || 0) > 0 && (data.totalPages || 1) < (data.page || 1)) {
    state.transactionPagination.page = data.totalPages || 1;
    return loadTransactionRows();
  }
  state.transactionRows = data.items || [];
  state.transactionPagination = {
    page: data.page || 1,
    perPage: data.perPage || state.transactionPagination.perPage,
    totalItems: data.totalItems || 0,
    totalPages: data.totalPages || 1
  };
}

async function loadTransactionDetail() {
  const transactionId = currentTransactionId();
  if (!transactionId) {
    state.currentTransaction = null;
    return;
  }
  state.currentTransaction = await api(`/api/transactions/${transactionId}`);
}

async function loadHomeTotals(force = false) {
  await ensureLoaded('homeTotals', async () => {
    state.homeTotals = await api('/api/home-totals');
    state.loaded.homeTotals = true;
  }, force);
}

async function loadHomePage(force = false) {
  await Promise.all([
    loadCategories(force),
    loadPaymentMethods(force),
    loadStores(force),
    loadHomeTotals(force)
  ]);
  renderSelects();
  renderHomeTotals();
}

async function loadMePage() {
  renderMe();
}

async function saveProfileSettings(updates, successMessage) {
  const result = await api('/api/auth/me', {
    method: 'PUT',
    body: JSON.stringify({
      emailVisibility: state.user?.emailVisibility !== false,
      transactionPageSize: state.user?.transactionPageSize || state.transactionPagination.perPage,
      ...updates
    })
  });
  setAuthView(result.user);
  state.transactionPagination.perPage = result.user.transactionPageSize || state.transactionPagination.perPage;
  renderMe();
  if (successMessage) toast(successMessage);
  return result.user;
}

async function toggleEmailVisibility() {
  const nextValue = !state.user.emailVisibility;

  try {
    await saveProfileSettings({ emailVisibility: nextValue }, `Email visibility ${nextValue ? 'enabled' : 'disabled'}.`);
  } catch (error) {
    toast(error.message);
  }
}

async function updateTransactionPageSize(nextValue, { refreshTransactions = false } = {}) {
  const pageSize = Number.parseInt(String(nextValue || ''), 10);
  if (!transactionPageSizeOptions.includes(pageSize)) return;

  try {
    await saveProfileSettings({ transactionPageSize: pageSize }, 'Transaction page size updated.');
    if (refreshTransactions && has('#transactionsList')) {
      state.transactionPagination.page = 1;
      state.transactionPagination.perPage = pageSize;
      await loadTransactionRows();
      renderTransactions();
    }
  } catch (error) {
    toast(error.message);
  }
}

async function resendVerificationEmail(email = state.user?.email || state.pendingVerificationEmail) {
  const targetEmail = String(email || '').trim();
  if (!targetEmail) {
    toast('Email address unavailable for verification.');
    return;
  }

  try {
    const result = await api('/api/auth/request-verification', {
      method: 'POST',
      body: JSON.stringify({ email: targetEmail })
    });
    state.pendingVerificationEmail = result.email || targetEmail;
    renderAuthStatus();
    renderMe();
    toast(result.message || 'Verification email sent.');
  } catch (error) {
    toast(error.message);
  }
}

async function approveUser(userId) {
  try {
    await api(`/api/users/${userId}/approve`, {
      method: 'POST'
    });
    toast('User approved.');
    await refreshCurrentPage(['users']);
  } catch (error) {
    toast(error.message);
  }
}

async function adminResendVerification(userId) {
  try {
    const result = await api(`/api/users/${userId}/resend-verification`, {
      method: 'POST'
    });
    toast(result.message || 'Verification email sent.');
  } catch (error) {
    toast(error.message);
  }
}

async function loadCategoriesPage(force = false) {
  await loadCategories(force);
  renderCategories();
}

async function loadStoresPage(force = false) {
  await loadStores(force);
  renderStores();
}

async function loadPaymentMethodsPage(force = false) {
  await loadPaymentMethods(force);
  renderPaymentMethods();
}

async function loadUsersPage(force = false) {
  await loadUsers(force);
  renderUsers();
}

async function loadTransactionsPage(force = false) {
  const loaders = [
    loadCategories(force),
    loadPaymentMethods(force),
    loadStores(force)
  ];
  if (isAdmin()) loaders.push(loadUsers(force));
  await Promise.all(loaders);
  renderTransactionFilterControls();
  await loadTransactionRows();
  renderTransactions();
}

async function loadTransactionDetailPage(force = false) {
  await Promise.all([
    loadCategories(force),
    loadPaymentMethods(force),
    loadStores(force),
    loadTransactionDetail()
  ]);
  renderTransactionDetail();
}

async function loadDashboardPage(force = false) {
  await loadSummaryTransactions(force);
  renderDashboard();
}

async function loadFilterPage(force = false) {
  await loadSummaryTransactions(force);
  if (has('#pivotForm')) {
    renderPivot(qs('#pivotForm select[name="row"]').value, qs('#pivotForm select[name="column"]').value);
  }
}

const pageLoaders = {
  '/': loadHomePage,
  '/me': loadMePage,
  '/categories': loadCategoriesPage,
  '/stores': loadStoresPage,
  '/payment-methods': loadPaymentMethodsPage,
  '/users': loadUsersPage,
  '/transactions': loadTransactionsPage,
  '/transactions/:id': loadTransactionDetailPage,
  '/dashboard': loadDashboardPage,
  '/filter': loadFilterPage
};

async function syncRoute(force = false) {
  const path = currentPath();
  const requestId = ++routeRequestId;
  showPage(path);
  if (!state.user || !isApprovedUser(state.user)) return;

  try {
    await (pageLoaders[path] || loadHomePage)(force);
  } catch (error) {
    if (requestId !== routeRequestId) return;
    toast(error.message);
  }
}

async function refreshCurrentPage(keys = []) {
  invalidate(...keys);
  await syncRoute(true);
}

async function loadCurrentUser() {
  try {
    const data = await api('/api/auth/me');
    state.pendingVerificationEmail = '';
    state.transactionPagination.perPage = data.user?.transactionPageSize || state.transactionPagination.perPage;
    setAuthView(data.user);
    if (window.location.pathname === '/verify-email') {
      window.location.replace('/');
      return;
    }
    if (isApprovedUser(data.user)) {
      await syncRoute(true);
    }
  } catch {
    setAuthView(null);
  }
}

async function submitAuth(event, endpoint) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  try {
    const result = await api(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    form.reset();
    if (result.requiresVerification) {
      state.pendingVerificationEmail = result.email || String(data.email || '').trim().toLowerCase();
      renderAuthStatus();
      toast(result.message || 'Check your email to verify your account.');
      return;
    }
    resetDataState();
    state.pendingVerificationEmail = '';
    state.transactionPagination.perPage = result.user?.transactionPageSize || state.transactionPagination.perPage;
    setAuthView(result.user);
    if (result.approvalPending) {
      toast('Admin approval is still pending.');
      return;
    }
    toast(endpoint.endsWith('login') ? 'Logged in.' : 'Account created.');
    await syncRoute(true);
  } catch (error) {
    if (error.data?.requiresVerification) {
      state.pendingVerificationEmail = error.data.email || String(data.email || '').trim().toLowerCase();
      renderAuthStatus();
    }
    toast(error.message);
  }
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } finally {
    resetDataState();
    state.pendingVerificationEmail = '';
    setAuthView(null);
    toast('Logged out.');
  }
}

async function submitExpense(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const body = {
    date: data.date,
    title: data.title,
    amount: data.amount,
    paymentMethod: data.paymentMethod,
    category: data.category === '__new__' ? '' : data.category,
    subcategory: data.subcategory === '__new__' ? '' : data.subcategory,
    store: data.store === '__new__' ? '' : data.store,
    categoryName: data.categoryName,
    subcategoryName: data.subcategoryName,
    storeName: data.storeName,
    storeText: data.storeText
  };

  try {
    await api('/api/transactions', { method: 'POST', body: JSON.stringify(body) });
    form.reset();
    form.date.valueAsDate = new Date();
    toast('Expense saved.');
    await refreshCurrentPage(['categories', 'stores', 'transactions', 'homeTotals']);
  } catch (error) {
    toast(error.message);
  }
}

function openEditTransaction(id) {
  const transaction = state.transactionRows.find((item) => item.id === id)
    || state.transactions.find((item) => item.id === id)
    || (state.currentTransaction?.id === id ? state.currentTransaction : null);
  if (!transaction || !has('#editTransactionForm') || !has('#editTransactionDialog')) return;

  const form = qs('#editTransactionForm');
  form.elements.id.value = transaction.id;
  form.elements.date.value = transaction.date.slice(0, 10);
  form.elements.title.value = transaction.title || '';
  form.elements.amount.value = transaction.amount;
  renderEditSelects(transaction);
  qs('#editTransactionDialog').showModal();
}

function closeEditTransaction() {
  if (has('#editTransactionDialog')) qs('#editTransactionDialog').close();
}

async function submitEditTransaction(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  try {
    await api(`/api/transactions/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        date: data.date,
        title: data.title,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        category: data.category,
        subcategory: data.subcategory,
        store: data.store,
        storeText: data.storeText
      })
    });
    closeEditTransaction();
    toast('Transaction updated.');
    if (currentPath() === '/transactions/:id') {
      await syncRoute(true);
    } else {
      await refreshCurrentPage(['transactions', 'homeTotals']);
    }
  } catch (error) {
    toast(error.message);
  }
}

async function submitCategory(event) {
  event.preventDefault();
  const form = qs('#categoryForm');
  try {
    await api('/api/categories', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))
    });
    form.reset();
    toast('Category saved.');
    await refreshCurrentPage(['categories', 'transactions']);
  } catch (error) {
    toast(error.message);
  }
}

async function editCategory(id) {
  const category = state.categories.find((item) => item.id === id);
  if (!category) return;
  const name = window.prompt('Category name', category.name);
  if (!name || name.trim() === category.name) return;
  try {
    await api(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: name.trim() })
    });
    toast('Category updated.');
    await refreshCurrentPage(['categories', 'transactions']);
  } catch (error) {
    toast(error.message);
  }
}

async function editSubcategory(id) {
  const subcategory = state.categories.flatMap((category) => category.subcategories || []).find((item) => item.id === id);
  if (!subcategory) return;
  const name = window.prompt('Subcategory name', subcategory.name);
  if (!name || name.trim() === subcategory.name) return;
  try {
    await api(`/api/subcategories/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: name.trim() })
    });
    toast('Subcategory updated.');
    await refreshCurrentPage(['categories', 'transactions']);
  } catch (error) {
    toast(error.message);
  }
}

async function submitStore(event) {
  event.preventDefault();
  const form = qs('#storeForm');
  try {
    await api('/api/stores', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    form.reset();
    toast('Store saved.');
    await refreshCurrentPage(['stores', 'transactions']);
  } catch (error) {
    toast(error.message);
  }
}

async function submitPaymentMethod(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await api('/api/payment-methods', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    form.reset();
    toast('Payment method saved.');
    await refreshCurrentPage(['paymentMethods', 'transactions']);
  } catch (error) {
    toast(error.message);
  }
}

async function editPaymentMethod(id) {
  const paymentMethod = state.paymentMethods.find((item) => item.id === id);
  if (!paymentMethod) return;
  const name = window.prompt('Payment method name', paymentMethod.name);
  if (!name || name.trim() === paymentMethod.name) return;
  try {
    await api(`/api/payment-methods/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: name.trim() })
    });
    toast('Payment method updated.');
    await refreshCurrentPage(['paymentMethods', 'transactions']);
  } catch (error) {
    toast(error.message);
  }
}

async function deleteTransaction(transactionId) {
  if (!transactionId) return;
  try {
    await api(`/api/transactions/${transactionId}`, { method: 'DELETE' });
    toast('Transaction deleted.');
    if (currentPath() === '/transactions/:id') {
      window.location.assign('/transactions');
      return;
    }
    await refreshCurrentPage(['transactions', 'homeTotals']);
  } catch (error) {
    toast(error.message);
  }
}

function buildTransactionFilterQuery() {
  if (!has('#transactionFilterForm')) return '';

  const data = new FormData(qs('#transactionFilterForm'));
  const params = new URLSearchParams();
  params.set('page', String(state.transactionPagination.page || 1));
  params.set('perPage', String(state.transactionPagination.perPage || state.user?.transactionPageSize || 25));
  ['fromDate', 'toDate', 'category', 'subcategory', 'paymentMethod', 'store', 'user'].forEach((key) => {
    const value = String(data.get(key) || '').trim();
    if (value) params.set(key, value);
  });

  const query = params.toString();
  return query ? `?${query}` : '';
}

async function applyTransactionFilters(event) {
  event.preventDefault();
  state.transactionPagination.page = 1;
  syncTransactionFilterVisibility(true);
  try {
    await loadTransactionRows();
    renderTransactions();
  } catch (error) {
    toast(error.message);
  }
}

async function clearTransactionFilters() {
  if (!has('#transactionFilterForm')) return;
  qs('#transactionFilterForm').reset();
  state.transactionPagination.page = 1;
  updateTransactionFilterSubcategories();
  syncTransactionFilterVisibility();

  try {
    await loadTransactionRows();
    renderTransactions();
  } catch (error) {
    toast(error.message);
  }
}

async function changeTransactionPage(page) {
  const totalPages = Math.max(state.transactionPagination.totalPages || 1, 1);
  const nextPage = Math.min(Math.max(page, 1), totalPages);
  if (nextPage === state.transactionPagination.page) return;

  state.transactionPagination.page = nextPage;
  try {
    await loadTransactionRows();
    renderTransactions();
  } catch (error) {
    toast(error.message);
  }
}

function handleTransactionClick(event) {
  const card = event.target.closest('[data-transaction-link]');
  if (card) {
    window.location.assign(transactionDetailPath(card.dataset.transactionLink));
    return;
  }
  const editButton = event.target.closest('[data-edit]');
  if (editButton) {
    openEditTransaction(editButton.dataset.edit);
    return;
  }
  const deleteButton = event.target.closest('[data-delete]');
  if (deleteButton) void deleteTransaction(deleteButton.dataset.delete);
}

function handleCategoryClick(event) {
  const categoryButton = event.target.closest('[data-edit-category]');
  if (categoryButton) {
    void editCategory(categoryButton.dataset.editCategory);
    return;
  }
  const subcategoryButton = event.target.closest('[data-edit-subcategory]');
  if (subcategoryButton) void editSubcategory(subcategoryButton.dataset.editSubcategory);
}

function handlePaymentMethodClick(event) {
  const paymentMethodButton = event.target.closest('[data-edit-payment-method]');
  if (paymentMethodButton) void editPaymentMethod(paymentMethodButton.dataset.editPaymentMethod);
}

function handleUserClick(event) {
  const resendButton = event.target.closest('[data-admin-resend-verification]');
  if (resendButton) {
    void adminResendVerification(resendButton.dataset.adminResendVerification);
    return;
  }
  const approveButton = event.target.closest('[data-approve-user]');
  if (approveButton) void approveUser(approveButton.dataset.approveUser);
}

function renderVerificationStatus(type, message) {
  if (!has('#verificationStatus')) return;
  qs('#verificationStatus').innerHTML = `
    <article class="verification-card ${type || ''}">
      <h1>Email verification</h1>
      <p>${message}</p>
      <div class="inline-actions">
        <a class="ghost-link" href="/">Go to sign in</a>
      </div>
    </article>
  `;
}

async function initVerificationPage() {
  if (!has('#verificationStatus')) return;

  const params = new URLSearchParams(window.location.search);
  const token = String(params.get('token') || params.get('verificationToken') || '').trim();
  const email = String(params.get('email') || '').trim().toLowerCase();
  if (email) state.pendingVerificationEmail = email;
  renderAuthStatus();

  if (!token) {
    renderVerificationStatus('warning', 'Open the verification link from your email to finish verifying your account.');
    return;
  }

  renderVerificationStatus('pending', 'Verifying your email now...');

  try {
    const result = await api('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
    state.pendingVerificationEmail = '';
    renderAuthStatus();
    renderVerificationStatus('success', result.message || 'Email verified. You can sign in now.');
  } catch (error) {
    renderVerificationStatus('error', error.message || 'Verification failed.');
  }
}

function bindEvents() {
  window.addEventListener('resize', () => {
    if (window.innerWidth > 720) closeMobileNav();
  });
  if (has('#expenseForm')) qs('#expenseForm').addEventListener('submit', submitExpense);
  if (has('#loginForm')) qs('#loginForm').addEventListener('submit', (event) => submitAuth(event, '/api/auth/login'));
  if (has('#registerForm')) qs('#registerForm').addEventListener('submit', (event) => submitAuth(event, '/api/auth/register'));
  if (has('#logoutButton')) qs('#logoutButton').addEventListener('click', logout);
  if (has('#approvalLogoutButton')) qs('#approvalLogoutButton').addEventListener('click', logout);
  if (has('#themeToggle')) qs('#themeToggle').addEventListener('click', toggleTheme);
  if (has('#themeToggleGuest')) qs('#themeToggleGuest').addEventListener('click', toggleTheme);
  if (has('#mobileThemeToggle')) qs('#mobileThemeToggle').addEventListener('click', toggleTheme);
  if (has('#menuToggle')) qs('#menuToggle').addEventListener('click', toggleMobileNav);
  if (has('#categoryForm')) qs('#categoryForm').addEventListener('submit', submitCategory);
  if (has('#categoryList')) qs('#categoryList').addEventListener('click', handleCategoryClick);
  if (has('#storeForm')) qs('#storeForm').addEventListener('submit', submitStore);
  if (has('#paymentMethodForm')) qs('#paymentMethodForm').addEventListener('submit', submitPaymentMethod);
  if (has('#paymentMethodList')) qs('#paymentMethodList').addEventListener('click', handlePaymentMethodClick);
  if (has('#userList')) qs('#userList').addEventListener('click', handleUserClick);
  if (has('#transactionsList')) qs('#transactionsList').addEventListener('click', handleTransactionClick);
  if (has('#transactionFilterForm')) qs('#transactionFilterForm').addEventListener('submit', applyTransactionFilters);
  if (has('#clearTransactionFilters')) qs('#clearTransactionFilters').addEventListener('click', clearTransactionFilters);
  if (has('#transactionFilterCategory')) qs('#transactionFilterCategory').addEventListener('change', updateTransactionFilterSubcategories);
  if (has('#toggleTransactionFilters')) qs('#toggleTransactionFilters').addEventListener('click', toggleTransactionFilters);
  if (has('#authStatus')) {
    qs('#authStatus').addEventListener('click', (event) => {
      const button = event.target.closest('[data-resend-verification]');
      if (button) void resendVerificationEmail(button.dataset.resendVerification || undefined);
    });
  }
  if (has('#meProfile')) {
    qs('#meProfile').addEventListener('change', (event) => {
      if (event.target.matches('[data-email-visibility]')) void toggleEmailVisibility();
      if (event.target.matches('[data-transaction-page-size]')) void updateTransactionPageSize(event.target.value);
    });
    qs('#meProfile').addEventListener('submit', (event) => {
      const form = event.target.closest('[data-profile-form]');
      if (!form) return;
      event.preventDefault();
      void submitProfileBasics(form);
    });
    qs('#meProfile').addEventListener('click', (event) => {
      const editButton = event.target.closest('[data-edit-profile]');
      if (editButton) {
        state.profileEditMode = true;
        renderMe();
        return;
      }
      const cancelButton = event.target.closest('[data-cancel-profile-edit]');
      if (cancelButton) {
        state.profileEditMode = false;
        renderMe();
        return;
      }
      const button = event.target.closest('[data-resend-verification]');
      if (button) void resendVerificationEmail(button.dataset.resendVerification || undefined);
    });
  }
  if (has('#transactionsPagination')) {
    qs('#transactionsPagination').addEventListener('click', (event) => {
      const button = event.target.closest('[data-page-action]');
      if (!button) return;
      if (button.dataset.pageAction === 'prev') void changeTransactionPage(state.transactionPagination.page - 1);
      if (button.dataset.pageAction === 'next') void changeTransactionPage(state.transactionPagination.page + 1);
    });
    qs('#transactionsPagination').addEventListener('change', (event) => {
      if (event.target.matches('[data-transaction-page-size]')) {
        void updateTransactionPageSize(event.target.value, { refreshTransactions: true });
      }
    });
  }
  if (has('#editTransactionForm')) qs('#editTransactionForm').addEventListener('submit', submitEditTransaction);
  if (has('#closeEditDialog')) qs('#closeEditDialog').addEventListener('click', closeEditTransaction);
  if (has('#transactionDetailCard')) {
    qs('#transactionDetailCard').addEventListener('click', (event) => {
      const editButton = event.target.closest('[data-edit-transaction-detail]');
      if (editButton) {
        openEditTransaction(editButton.dataset.editTransactionDetail);
        return;
      }
      const deleteButton = event.target.closest('[data-delete-transaction-detail]');
      if (deleteButton) void deleteTransaction(deleteButton.dataset.deleteTransactionDetail);
    });
  }
  if (has('#editCategory')) qs('#editCategory').addEventListener('change', () => renderEditSelects());
  if (has('#oikosCategory')) qs('#oikosCategory').addEventListener('change', renderSubcategorySelect);
  if (has('#oikosSubcategory')) {
    qs('#oikosSubcategory').addEventListener('change', () => {
      if (has('#newSubcategoryWrap')) qs('#newSubcategoryWrap').classList.toggle('hidden', qs('#oikosSubcategory').value !== '__new__');
    });
  }
  if (has('#oikosStore')) {
    qs('#oikosStore').addEventListener('change', () => {
      syncStoreInputVisibility();
    });
  }
  if (has('#editStore')) qs('#editStore').addEventListener('change', syncEditStoreInputVisibility);
  if (has('#pivotForm')) {
    qs('#pivotForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      renderPivot(data.row, data.column);
    });
  }
}

async function init() {
  initializeTheme();
  bindEvents();
  renderAuthStatus();
  showPage();
  if (has('#expenseForm [name="date"]')) qs('#expenseForm [name="date"]').valueAsDate = new Date();
  await initVerificationPage();
  await loadCurrentUser();

  // Register service worker for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
    }, { once: true });
  }
}

init();
