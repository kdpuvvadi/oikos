import './layout.js';

const state = {
  user: null,
  categories: [],
  paymentMethods: [],
  stores: [],
  users: [],
  transactions: [],
  transactionRows: [],
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
    homeTotals: false
  },
  pending: {}
};

const money = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

const routes = {
  '/': 'homePage',
  '/me': 'mePage',
  '/categories': 'categoriesPage',
  '/stores': 'storesPage',
  '/payment-methods': 'paymentMethodsPage',
  '/users': 'usersPage',
  '/transactions': 'transactionsPage',
  '/dashboard': 'dashboardPage',
  '/filter': 'filterPage'
};

let routeRequestId = 0;
const authHintCookieName = 'oikos_session';

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

function has(selector, root = document) {
  return Boolean(qs(selector, root));
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
    throw new Error(data?.error || 'Request failed');
  }
  return data;
}

function toast(message) {
  const node = qs('#toast');
  node.textContent = message;
  node.classList.add('show');
  window.setTimeout(() => node.classList.remove('show'), 3200);
}

function currentPath() {
  return routes[window.location.pathname] ? window.location.pathname : '/';
}

function showPage(path = currentPath()) {
  qsa('[data-nav]').forEach((link) => link.classList.toggle('active', link.dataset.nav === path));
  closeMobileNav();
}

function isAdmin() {
  return Boolean(state.user?.isAdmin || state.user?.kind === 'admin');
}

function setAuthView(user) {
  state.user = user;
  setSessionHint(Boolean(user));
  document.body.classList.toggle('is-authenticated', Boolean(user));
  document.body.classList.toggle('is-admin', Boolean(user?.isAdmin || user?.kind === 'admin'));
  document.body.classList.remove('mobile-nav-open');
  if (has('#authPage')) qs('#authPage').classList.toggle('hidden', Boolean(user));
  if (has('#appShell')) qs('#appShell').classList.toggle('hidden', !user);
  if (has('#userMenu')) qs('#userMenu').classList.toggle('hidden', !user);
  if (has('nav')) qs('nav').classList.toggle('hidden', !user);
  if (has('#menuToggle')) {
    qs('#menuToggle').classList.toggle('hidden', !user);
    qs('#menuToggle').setAttribute('aria-expanded', 'false');
  }
  if (has('#userName')) qs('#userName').textContent = user ? `${user.name}${isAdmin() ? ' (admin)' : ''}` : '';
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

function labelFor(transaction, field) {
  if (field === 'month') return transaction.date.slice(0, 7);
  if (field === 'category') return transaction.expand?.category?.name || 'Uncategorized';
  if (field === 'subcategory') return transaction.expand?.subcategory?.name || 'None';
  if (field === 'store') return transaction.expand?.store?.name || 'Unknown';
  if (field === 'paymentMethod') return transaction.expand?.payment_method?.name || transaction.paymentMethod || 'Not set';
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

function renderUsers() {
  if (!has('#userList')) return;
  qs('#userList').innerHTML = state.users.map((user) => `
    <article class="list-item">
      <div class="list-heading">
        <strong>${user.name || user.email}</strong>
        <span class="pill">${user.isAdmin ? 'Admin' : 'User'}</span>
      </div>
      <p>${user.email || 'Email hidden'}</p>
    </article>
  `).join('') || '<p>No users yet.</p>';
}

function renderMe() {
  if (!has('#meProfile')) return;
  const user = state.user;
  if (!user) {
    qs('#meProfile').innerHTML = '<p>Please sign in to view your profile.</p>';
    return;
  }

  qs('#meProfile').innerHTML = `
    <article class="panel">
      <div class="detail-list">
        <div class="detail-row">
          <span class="detail-label">Name</span>
          <strong class="detail-value">${user.name || '-'}</strong>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email</span>
          <span class="detail-value">${user.email || '-'}</span>
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
  if (!has('#transactionsTable')) return;
  qs('#transactionsTable').innerHTML = state.transactionRows.map((transaction) => `
    <tr>
      <td class="transaction-cell transaction-date-cell" data-label="Date"><span class="transaction-value transaction-date">${transaction.date.slice(0, 10)}</span></td>
      <td class="transaction-cell transaction-amount-cell" data-label="Amount"><strong class="transaction-value transaction-amount">${money.format(Number(transaction.amount))}</strong></td>
      <td class="transaction-cell transaction-payment-cell" data-label="Payment mode"><span class="transaction-value">${transaction.expand?.payment_method?.name || transaction.paymentMethod || 'Not set'}</span></td>
      <td class="transaction-cell transaction-category-cell" data-label="Category"><span class="transaction-value">${transaction.expand?.category?.name || 'Uncategorized'}</span></td>
      <td class="transaction-cell transaction-subcategory-cell" data-label="Subcategory"><span class="transaction-value">${transaction.expand?.subcategory?.name || 'None'}</span></td>
      <td class="transaction-cell transaction-store-cell" data-label="Store"><span class="transaction-value">${transaction.expand?.store?.name || 'Unknown'}</span></td>
      <td class="transaction-cell transaction-user-cell admin-only" data-label="User"><span class="transaction-value">${transaction.expand?.user?.email || transaction.expand?.user?.name || ''}</span></td>
      <td class="transaction-cell transaction-actions-cell" data-label="Actions">
        <div class="row-actions">
          <button class="ghost" data-edit="${transaction.id}">Edit</button>
          <button class="danger" data-delete="${transaction.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('') || '<tr class="table-empty-row"><td colspan="8">No transactions yet.</td></tr>';
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
  return ['fromDate', 'toDate', 'category', 'subcategory', 'user'].some((key) => String(data.get(key) || '').trim());
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
  renderBars('#monthChart', sumBy(state.transactions, (transaction) => transaction.date.slice(0, 7)));
  renderBars('#categoryChart', sumBy(state.transactions, (transaction) => transaction.expand?.category?.name || 'Uncategorized'));
  renderBars('#storeChart', sumBy(state.transactions, (transaction) => transaction.expand?.store?.name || 'Unknown'));
}

function renderPivot(row = 'month', column = 'category') {
  if (!has('#pivotTable')) return;
  const rowLabels = [...new Set(state.transactions.map((transaction) => labelFor(transaction, row)))].sort();
  const columnLabels = [...new Set(state.transactions.map((transaction) => labelFor(transaction, column)))].sort();
  const matrix = {};

  state.transactions.forEach((transaction) => {
    const rowKey = labelFor(transaction, row);
    const columnKey = labelFor(transaction, column);
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
  state.categories = [];
  state.paymentMethods = [];
  state.stores = [];
  state.users = [];
  state.transactions = [];
  state.transactionRows = [];
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
    state.transactions = await api('/api/transactions');
    state.loaded.transactions = true;
  }, force);
}

async function loadTransactionRows() {
  state.transactionRows = await api(`/api/transactions${buildTransactionFilterQuery()}`);
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

async function toggleEmailVisibility() {
  const nextValue = !state.user.emailVisibility;

  try {
    const result = await api('/api/auth/me', {
      method: 'PUT',
      body: JSON.stringify({ emailVisibility: nextValue })
    });
    setAuthView(result.user);
    renderMe();
    toast(`Email visibility ${nextValue ? 'enabled' : 'disabled'}.`);
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

async function loadDashboardPage(force = false) {
  await loadTransactions(force);
  renderDashboard();
}

async function loadFilterPage(force = false) {
  await loadTransactions(force);
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
  '/dashboard': loadDashboardPage,
  '/filter': loadFilterPage
};

async function syncRoute(force = false) {
  const path = currentPath();
  const requestId = ++routeRequestId;
  showPage(path);
  if (!state.user) return;

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
    setAuthView(data.user);
    await syncRoute(true);
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
    resetDataState();
    setAuthView(result.user);
    toast(endpoint.endsWith('login') ? 'Logged in.' : 'Account created.');
    await syncRoute(true);
  } catch (error) {
    toast(error.message);
  }
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } finally {
    resetDataState();
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
    amount: data.amount,
    paymentMethod: data.paymentMethod,
    category: data.category === '__new__' ? '' : data.category,
    subcategory: data.subcategory === '__new__' ? '' : data.subcategory,
    store: data.store === '__new__' ? '' : data.store,
    categoryName: data.categoryName,
    subcategoryName: data.subcategoryName,
    storeName: data.storeName
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
  const transaction = state.transactionRows.find((item) => item.id === id) || state.transactions.find((item) => item.id === id);
  if (!transaction || !has('#editTransactionForm') || !has('#editTransactionDialog')) return;

  const form = qs('#editTransactionForm');
  form.elements.id.value = transaction.id;
  form.elements.date.value = transaction.date.slice(0, 10);
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
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        category: data.category,
        subcategory: data.subcategory,
        store: data.store
      })
    });
    closeEditTransaction();
    toast('Transaction updated.');
    await refreshCurrentPage(['transactions', 'homeTotals']);
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
  try {
    await api('/api/payment-methods', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))
    });
    event.currentTarget.reset();
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

async function deleteTransaction(event) {
  const button = event.target.closest('[data-delete]');
  if (!button) return;
  try {
    await api(`/api/transactions/${button.dataset.delete}`, { method: 'DELETE' });
    toast('Transaction deleted.');
    await refreshCurrentPage(['transactions', 'homeTotals']);
  } catch (error) {
    toast(error.message);
  }
}

function buildTransactionFilterQuery() {
  if (!has('#transactionFilterForm')) return '';

  const data = new FormData(qs('#transactionFilterForm'));
  const params = new URLSearchParams();
  ['fromDate', 'toDate', 'category', 'subcategory', 'user'].forEach((key) => {
    const value = String(data.get(key) || '').trim();
    if (value) params.set(key, value);
  });

  const query = params.toString();
  return query ? `?${query}` : '';
}

async function applyTransactionFilters(event) {
  event.preventDefault();
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
  updateTransactionFilterSubcategories();
  syncTransactionFilterVisibility();

  try {
    await loadTransactionRows();
    renderTransactions();
  } catch (error) {
    toast(error.message);
  }
}

function handleTransactionClick(event) {
  const editButton = event.target.closest('[data-edit]');
  if (editButton) {
    openEditTransaction(editButton.dataset.edit);
    return;
  }
  void deleteTransaction(event);
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

function bindEvents() {
  window.addEventListener('resize', () => {
    if (window.innerWidth > 720) closeMobileNav();
  });
  if (has('#expenseForm')) qs('#expenseForm').addEventListener('submit', submitExpense);
  if (has('#loginForm')) qs('#loginForm').addEventListener('submit', (event) => submitAuth(event, '/api/auth/login'));
  if (has('#registerForm')) qs('#registerForm').addEventListener('submit', (event) => submitAuth(event, '/api/auth/register'));
  if (has('#logoutButton')) qs('#logoutButton').addEventListener('click', logout);
  if (has('#menuToggle')) qs('#menuToggle').addEventListener('click', toggleMobileNav);
  if (has('#categoryForm')) qs('#categoryForm').addEventListener('submit', submitCategory);
  if (has('#categoryList')) qs('#categoryList').addEventListener('click', handleCategoryClick);
  if (has('#storeForm')) qs('#storeForm').addEventListener('submit', submitStore);
  if (has('#paymentMethodForm')) qs('#paymentMethodForm').addEventListener('submit', submitPaymentMethod);
  if (has('#paymentMethodList')) qs('#paymentMethodList').addEventListener('click', handlePaymentMethodClick);
  if (has('#transactionsTable')) qs('#transactionsTable').addEventListener('click', handleTransactionClick);
  if (has('#transactionFilterForm')) qs('#transactionFilterForm').addEventListener('submit', applyTransactionFilters);
  if (has('#clearTransactionFilters')) qs('#clearTransactionFilters').addEventListener('click', clearTransactionFilters);
  if (has('#transactionFilterCategory')) qs('#transactionFilterCategory').addEventListener('change', updateTransactionFilterSubcategories);
  if (has('#toggleTransactionFilters')) qs('#toggleTransactionFilters').addEventListener('click', toggleTransactionFilters);
  if (has('#meProfile')) {
    qs('#meProfile').addEventListener('change', (event) => {
      if (event.target.matches('[data-email-visibility]')) void toggleEmailVisibility();
    });
  }
  if (has('#editTransactionForm')) qs('#editTransactionForm').addEventListener('submit', submitEditTransaction);
  if (has('#closeEditDialog')) qs('#closeEditDialog').addEventListener('click', closeEditTransaction);
  if (has('#editCategory')) qs('#editCategory').addEventListener('change', () => renderEditSelects());
  if (has('#oikosCategory')) qs('#oikosCategory').addEventListener('change', renderSubcategorySelect);
  if (has('#oikosSubcategory')) {
    qs('#oikosSubcategory').addEventListener('change', () => {
      if (has('#newSubcategoryWrap')) qs('#newSubcategoryWrap').classList.toggle('hidden', qs('#oikosSubcategory').value !== '__new__');
    });
  }
  if (has('#oikosStore')) {
    qs('#oikosStore').addEventListener('change', () => {
      if (has('#newStoreWrap')) qs('#newStoreWrap').classList.toggle('hidden', qs('#oikosStore').value !== '__new__');
    });
  }
  if (has('#pivotForm')) {
    qs('#pivotForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      renderPivot(data.row, data.column);
    });
  }
}

async function init() {
  bindEvents();
  showPage();
  if (has('#expenseForm [name="date"]')) qs('#expenseForm [name="date"]').valueAsDate = new Date();
  await loadCurrentUser();
}

init();
