const state = {
  user: null,
  categories: [],
  paymentMethods: [],
  stores: [],
  transactions: []
};

const money = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

const routes = {
  '/': 'homePage',
  '/categories': 'categoriesPage',
  '/stores': 'storesPage',
  '/payment-methods': 'paymentMethodsPage',
  '/transactions': 'transactionsPage',
  '/dashboard': 'dashboardPage',
  '/filter': 'filterPage'
};

function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
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

function showPage() {
  const path = currentPath();
  qsa('.page').forEach((page) => page.classList.remove('active'));
  qs(`#${routes[path]}`).classList.add('active');
  qsa('[data-nav]').forEach((link) => link.classList.toggle('active', link.dataset.nav === path));
}

function isAdmin() {
  return Boolean(state.user?.isAdmin || state.user?.kind === 'admin');
}

function setAuthView(user) {
  state.user = user;
  document.body.classList.toggle('is-authenticated', Boolean(user));
  document.body.classList.toggle('is-admin', Boolean(user?.isAdmin || user?.kind === 'admin'));
  qs('#authPage').classList.toggle('hidden', Boolean(user));
  qs('#appShell').classList.toggle('hidden', !user);
  qs('#userMenu').classList.toggle('hidden', !user);
  qs('nav').classList.toggle('hidden', !user);
  qs('#userName').textContent = user ? `${user.name}${isAdmin() ? ' (admin)' : ''}` : '';
}

function navigate(event) {
  const link = event.target.closest('a[data-nav]');
  if (!link) return;
  event.preventDefault();
  history.pushState(null, '', link.href);
  showPage();
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

function monthOffset(offset) {
  const date = new Date();
  const target = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
}

function renderSelects() {
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
    option('__new__', 'Add new store')
  ].join('');

  qs('#oikosPaymentMethod').innerHTML = [
    option('', 'Select payment mode'),
    ...state.paymentMethods.map((paymentMethod) => option(paymentMethod.id, paymentMethod.name))
  ].join('');

  renderSubcategorySelect();
}

function renderEditSelects(transaction) {
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

  qs('#newCategoryWrap').classList.toggle('hidden', !isAdmin() || categoryId !== '__new__');
  qs('#newSubcategoryWrap').classList.toggle('hidden', !isAdmin() || (categoryId !== '__new__' && subcategorySelect.value !== '__new__'));
}

function renderStores() {
  qs('#storeList').innerHTML = state.stores.map((store) => `
    <article class="list-item"><strong>${store.name}</strong></article>
  `).join('') || '<p>No stores yet.</p>';
}

function renderPaymentMethods() {
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
  qs('#transactionsTable').innerHTML = state.transactions.map((transaction) => `
    <tr>
      <td>${transaction.date.slice(0, 10)}</td>
      <td>${money.format(Number(transaction.amount))}</td>
      <td>${transaction.expand?.payment_method?.name || transaction.paymentMethod || ''}</td>
      <td>${transaction.expand?.category?.name || ''}</td>
      <td>${transaction.expand?.subcategory?.name || ''}</td>
      <td>${transaction.expand?.store?.name || ''}</td>
      <td class="admin-only">${transaction.expand?.user?.email || transaction.expand?.user?.name || ''}</td>
      <td>
        <div class="row-actions">
          <button class="ghost" data-edit="${transaction.id}">Edit</button>
          <button class="danger" data-delete="${transaction.id}">Delete</button>
        </div>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="8">No transactions yet.</td></tr>';
}

function renderHomeTotals() {
  const thisMonth = monthOffset(0);
  const lastMonth = monthOffset(-1);
  const totals = sumBy(state.transactions, (transaction) => transaction.date.slice(0, 7));
  qs('#thisMonthTotal').textContent = money.format(totals[thisMonth] || 0);
  qs('#lastMonthTotal').textContent = money.format(totals[lastMonth] || 0);
}

function renderBars(selector, totals) {
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

function renderAll() {
  renderSelects();
  renderStores();
  renderPaymentMethods();
  renderCategories();
  renderTransactions();
  renderHomeTotals();
  renderDashboard();
  renderPivot(qs('#pivotForm select[name="row"]').value, qs('#pivotForm select[name="column"]').value);
}

async function loadData() {
  const [categories, paymentMethods, stores, transactions] = await Promise.all([
    api('/api/categories'),
    api('/api/payment-methods'),
    api('/api/stores'),
    api('/api/transactions')
  ]);
  state.categories = categories;
  state.paymentMethods = paymentMethods;
  state.stores = stores;
  state.transactions = transactions;
  renderAll();
}

async function loadCurrentUser() {
  try {
    const data = await api('/api/auth/me');
    setAuthView(data.user);
    await loadData();
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
    setAuthView(result.user);
    toast(endpoint.endsWith('login') ? 'Logged in.' : 'Account created.');
    await loadData();
  } catch (error) {
    toast(error.message);
  }
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } finally {
    state.categories = [];
    state.paymentMethods = [];
    state.stores = [];
    state.transactions = [];
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

  await api('/api/transactions', { method: 'POST', body: JSON.stringify(body) });
  form.reset();
  form.date.valueAsDate = new Date();
  toast('Expense saved.');
  await loadData();
}

function openEditTransaction(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;

  const form = qs('#editTransactionForm');
  form.elements.id.value = transaction.id;
  form.elements.date.value = transaction.date.slice(0, 10);
  form.elements.amount.value = transaction.amount;
  renderEditSelects(transaction);
  qs('#editTransactionDialog').showModal();
}

function closeEditTransaction() {
  qs('#editTransactionDialog').close();
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
    await loadData();
  } catch (error) {
    toast(error.message);
  }
}

async function submitCategory(event) {
  event.preventDefault();
  try {
    await api('/api/categories', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))
    });
    event.currentTarget.reset();
    toast('Category saved.');
    await loadData();
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
    await loadData();
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
    await loadData();
  } catch (error) {
    toast(error.message);
  }
}

async function submitStore(event) {
  event.preventDefault();
  await api('/api/stores', {
    method: 'POST',
    body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))
  });
  event.currentTarget.reset();
  toast('Store saved.');
  await loadData();
}

async function submitPaymentMethod(event) {
  event.preventDefault();
  await api('/api/payment-methods', {
    method: 'POST',
    body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))
  });
  event.currentTarget.reset();
  toast('Payment method saved.');
  await loadData();
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
    await loadData();
  } catch (error) {
    toast(error.message);
  }
}

async function deleteTransaction(event) {
  const button = event.target.closest('[data-delete]');
  if (!button) return;
  await api(`/api/transactions/${button.dataset.delete}`, { method: 'DELETE' });
  toast('Transaction deleted.');
  await loadData();
}

function handleTransactionClick(event) {
  const editButton = event.target.closest('[data-edit]');
  if (editButton) {
    openEditTransaction(editButton.dataset.edit);
    return;
  }
  deleteTransaction(event);
}

function handleCategoryClick(event) {
  const categoryButton = event.target.closest('[data-edit-category]');
  if (categoryButton) {
    editCategory(categoryButton.dataset.editCategory);
    return;
  }
  const subcategoryButton = event.target.closest('[data-edit-subcategory]');
  if (subcategoryButton) editSubcategory(subcategoryButton.dataset.editSubcategory);
}

function handlePaymentMethodClick(event) {
  const paymentMethodButton = event.target.closest('[data-edit-payment-method]');
  if (paymentMethodButton) editPaymentMethod(paymentMethodButton.dataset.editPaymentMethod);
}

function bindEvents() {
  document.addEventListener('click', navigate);
  window.addEventListener('popstate', showPage);
  qs('#expenseForm').addEventListener('submit', submitExpense);
  qs('#loginForm').addEventListener('submit', (event) => submitAuth(event, '/api/auth/login'));
  qs('#registerForm').addEventListener('submit', (event) => submitAuth(event, '/api/auth/register'));
  qs('#logoutButton').addEventListener('click', logout);
  qs('#categoryForm').addEventListener('submit', submitCategory);
  qs('#categoryList').addEventListener('click', handleCategoryClick);
  qs('#storeForm').addEventListener('submit', submitStore);
  qs('#paymentMethodForm').addEventListener('submit', submitPaymentMethod);
  qs('#paymentMethodList').addEventListener('click', handlePaymentMethodClick);
  qs('#transactionsTable').addEventListener('click', handleTransactionClick);
  qs('#editTransactionForm').addEventListener('submit', submitEditTransaction);
  qs('#closeEditDialog').addEventListener('click', closeEditTransaction);
  qs('#editCategory').addEventListener('change', () => renderEditSelects());
  qs('#oikosCategory').addEventListener('change', renderSubcategorySelect);
  qs('#oikosSubcategory').addEventListener('change', () => {
    qs('#newSubcategoryWrap').classList.toggle('hidden', qs('#oikosSubcategory').value !== '__new__');
  });
  qs('#oikosStore').addEventListener('change', () => {
    qs('#newStoreWrap').classList.toggle('hidden', qs('#oikosStore').value !== '__new__');
  });
  qs('#pivotForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    renderPivot(data.row, data.column);
  });
}

async function init() {
  bindEvents();
  showPage();
  qs('#expenseForm [name="date"]').valueAsDate = new Date();
  await loadCurrentUser();
}

init();
