import PocketBase from 'pocketbase';
import { buildWeeklyDigestPreview, previousWeekRange } from './weeklyDigest.js';

function resolvePbUrl() {
  const configured = String(import.meta.env.VITE_PB_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  // Production same-origin (pb_public) or unset env: talk to the current host.
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://127.0.0.1:8090';
}

export const pb = new PocketBase(resolvePbUrl());
// React StrictMode and parallel page loaders reuse the same endpoints; keep those requests.
pb.autoCancellation(false);

let onUnauthorized = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export function isAbortError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return Boolean(
    error?.isAbort
    || error?.name === 'AbortError'
    || message.includes('autocancel')
    || message.includes('aborted')
  );
}

export function pbError(error, fallback = 'Request failed') {
  if (isAbortError(error)) {
    const err = new Error(error?.message || 'Request aborted');
    err.status = 0;
    err.isAbort = true;
    err.data = null;
    return err;
  }
  const validation = error?.response?.data || error?.data || {};
  const validationMessages = Object.entries(validation)
    .filter(([, detail]) => detail && typeof detail === 'object')
    .map(([field, detail]) => `${field}: ${detail.message || detail}`)
    .join(' ');
  const err = new Error(validationMessages || error?.message || fallback);
  err.status = error?.status || error?.response?.status || 500;
  err.data = error?.data || error?.response || null;
  if (err.status === 401) onUnauthorized?.();
  return err;
}

export function sanitizeName(value) {
  return String(value || '').trim();
}

export function normalizeTransactionPageSize(value, fallback = 25) {
  const allowed = [10, 25, 50, 100];
  const parsed = Number.parseInt(String(value || ''), 10);
  return allowed.includes(parsed) ? parsed : fallback;
}

export function publicUser(record) {
  if (!record) return null;
  const email = sanitizeName(record.email) || null;
  const firstName = sanitizeName(record.firstName);
  const lastName = sanitizeName(record.lastName);
  const name = [firstName, lastName].filter(Boolean).join(' ') || sanitizeName(record.name) || email || 'Unnamed user';
  const admin = record.kind === 'admin';
  return {
    id: record.id,
    email,
    name,
    firstName,
    lastName,
    emailVisibility: record.emailVisibility !== false,
    verified: record.verified === true,
    approved: admin ? true : record.approved === true,
    // Digests on by default; only off when user opted out.
    weeklyDigest: record.weeklyDigestOptOut !== true,
    kind: record.kind || 'user',
    isAdmin: admin,
    transactionPageSize: normalizeTransactionPageSize(record.transactionPageSize)
  };
}

export function isAdminRecord(record) {
  return record?.kind === 'admin' || record?.isAdmin;
}

export function currentAuthUser() {
  return publicUser(pb.authStore.record);
}

function pbDate(date) {
  const iso = String(date || '').slice(0, 10);
  return iso ? `${iso} 00:00:00.000Z` : '';
}

function nextDayBoundary(date) {
  const iso = String(date || '').slice(0, 10);
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.toISOString().slice(0, 10)} 00:00:00.000Z`;
}

function monthBoundary(year, monthIndex) {
  const date = new Date(Date.UTC(year, monthIndex, 1));
  return `${date.toISOString().slice(0, 10)} 00:00:00.000Z`;
}

function currentMonthRange(offset = 0) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1));
  return {
    start: `${start.toISOString().slice(0, 10)} 00:00:00.000Z`,
    end: `${end.toISOString().slice(0, 10)} 00:00:00.000Z`
  };
}

function toNameMap(records) {
  return records.reduce((map, record) => {
    map[record.id] = record.name;
    return map;
  }, {});
}

async function listRecords(collection, options = {}) {
  return pb.collection(collection).getFullList({
    ...options,
    requestKey: options.requestKey ?? null
  });
}

async function findByName(collection, name, extraFilter = '') {
  const normalized = sanitizeName(name);
  if (!normalized) return null;
  const escaped = normalized.replaceAll('"', '\\"');
  const filter = [`name = "${escaped}"`, extraFilter].filter(Boolean).join(' && ');
  try {
    return await pb.collection(collection).getFirstListItem(filter);
  } catch {
    return null;
  }
}

async function findOrCreateCategory(name) {
  const existing = await findByName('oikos_categories', name);
  return existing || pb.collection('oikos_categories').create({ name: sanitizeName(name) });
}

async function findOrCreateSubcategory(categoryId, name) {
  const normalized = sanitizeName(name);
  if (!normalized) return null;
  const existing = await findByName('oikos_subcategories', normalized, `category = "${categoryId}"`);
  return existing || pb.collection('oikos_subcategories').create({ name: normalized, category: categoryId });
}

async function findOrCreateStore(name) {
  const existing = await findByName('oikos_stores', name);
  return existing || pb.collection('oikos_stores').create({ name: sanitizeName(name) });
}

async function isOtherStore(storeId) {
  if (!storeId) return false;
  try {
    const store = await pb.collection('oikos_stores').getOne(storeId);
    return sanitizeName(store.name).toLowerCase() === 'other';
  } catch {
    return false;
  }
}

function requireAuthRecord() {
  if (!pb.authStore.isValid || !pb.authStore.record?.id) {
    throw pbError({ status: 401, message: 'Please log in to continue.' });
  }
  return pb.authStore.record;
}

function tokenExpiresInMs(token) {
  try {
    const payload = String(token || '').split('.')[1];
    if (!payload) return 0;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const json = JSON.parse(atob(padded));
    if (!json.exp) return 0;
    return (Number(json.exp) * 1000) - Date.now();
  } catch {
    return 0;
  }
}

function tokenNeedsRefresh(token) {
  return tokenExpiresInMs(token) < (60 * 60 * 1000);
}

export async function getCurrentUser() {
  if (!pb.authStore.isValid || !pb.authStore.record?.id) {
    throw pbError({ status: 401, message: 'Not logged in.' });
  }
  if (pb.authStore.record.verified !== true) {
    pb.authStore.clear();
    throw pbError({ status: 401, message: 'Not logged in.' });
  }
  if (!tokenNeedsRefresh(pb.authStore.token)) {
    return { user: publicUser(pb.authStore.record) };
  }
  try {
    const auth = await pb.collection('users').authRefresh();
    const record = auth.record || pb.authStore.record;
    if (record?.verified !== true) {
      pb.authStore.clear();
      throw pbError({ status: 401, message: 'Not logged in.' });
    }
    return { user: publicUser(record) };
  } catch (error) {
    pb.authStore.clear();
    throw pbError(error, 'Not logged in.');
  }
}

export async function login({ email, password }) {
  const normalizedEmail = sanitizeName(email).toLowerCase();
  try {
    const auth = await pb.collection('users').authWithPassword(normalizedEmail, String(password || ''));
    if (auth.record?.verified !== true) {
      pb.authStore.clear();
      const error = pbError({
        status: 403,
        message: 'Please verify your email before signing in.'
      });
      error.data = { requiresVerification: true, email: normalizedEmail };
      throw error;
    }
    return {
      user: publicUser(auth.record),
      approvalPending: !(auth.record?.kind === 'admin' || auth.record?.approved === true)
    };
  } catch (error) {
    if (error.data?.requiresVerification) throw error;
    throw pbError(error, 'Login failed.');
  }
}

export async function register({ email, password, firstName, lastName }) {
  const normalizedEmail = sanitizeName(email).toLowerCase();
  const first = sanitizeName(firstName);
  const last = sanitizeName(lastName);
  const pass = String(password || '');
  if (!normalizedEmail || !first || !last || pass.length < 8) {
    throw pbError({ status: 400, message: 'First name, last name, email, and an 8 character password are required.' });
  }
  try {
    await pb.collection('users').create({
      email: normalizedEmail,
      name: `${first} ${last}`,
      firstName: first,
      lastName: last,
      kind: 'user',
      approved: false,
      emailVisibility: true,
      password: pass,
      passwordConfirm: pass
    });
    await pb.collection('users').requestVerification(normalizedEmail);
    return {
      requiresVerification: true,
      email: normalizedEmail,
      message: 'Account created. Check your email to verify your address before signing in.'
    };
  } catch (error) {
    throw pbError(error, 'Registration failed.');
  }
}

export async function logout() {
  pb.authStore.clear();
}

export async function updateProfile(updates) {
  const record = requireAuthRecord();
  const updateBody = {
    emailVisibility: updates.emailVisibility !== undefined
      ? Boolean(updates.emailVisibility)
      : record.emailVisibility !== false
  };
  const firstName = sanitizeName(updates.firstName);
  const lastName = sanitizeName(updates.lastName);
  const email = sanitizeName(updates.email).toLowerCase();

  if (firstName || lastName) {
    if (!firstName || !lastName) {
      throw pbError({ status: 400, message: 'Both first name and last name are required.' });
    }
    updateBody.firstName = firstName;
    updateBody.lastName = lastName;
    updateBody.name = `${firstName} ${lastName}`;
  }
  if (email) updateBody.email = email;
  if (updates.transactionPageSize !== undefined) {
    updateBody.transactionPageSize = normalizeTransactionPageSize(updates.transactionPageSize);
  }
  if (updates.weeklyDigest !== undefined) {
    // UI exposes "weekly digest enabled"; store the inverse as opt-out.
    updateBody.weeklyDigestOptOut = !Boolean(updates.weeklyDigest);
  }

  try {
    const updated = await pb.collection('users').update(record.id, updateBody);
    pb.authStore.save(pb.authStore.token, updated);
    return { user: publicUser(updated) };
  } catch (error) {
    throw pbError(error, 'Profile update failed.');
  }
}

export async function requestVerification(email) {
  const target = sanitizeName(email).toLowerCase();
  if (!target) throw pbError({ status: 400, message: 'Email address unavailable for verification.' });
  try {
    await pb.collection('users').requestVerification(target);
    return { email: target, message: 'Verification email sent.' };
  } catch (error) {
    throw pbError(error, 'Could not send verification email.');
  }
}

export async function verifyEmail(token) {
  try {
    await pb.collection('users').confirmVerification(token);
    return { message: 'Email verified. You can sign in now.' };
  } catch (error) {
    throw pbError(error, 'Verification failed.');
  }
}

/** Used/expired tokens look the same in PocketBase — treat as already verified for UX. */
export function isVerificationTokenSpent(error) {
  const message = String(error?.message || '').toLowerCase();
  const data = error?.data?.data || error?.data || {};
  const tokenDetail = String(data?.token?.message || data?.token?.code || '').toLowerCase();
  return (
    message.includes('invalid or expired')
    || message.includes('invalid token')
    || message.includes('expired')
    || tokenDetail.includes('invalid')
    || tokenDetail.includes('expired')
    || tokenDetail.includes('validation_invalid_token')
  );
}

export async function fetchCategories() {
  requireAuthRecord();
  try {
    const [categories, subcategories] = await Promise.all([
      listRecords('oikos_categories', { sort: 'name' }),
      listRecords('oikos_subcategories', { sort: 'name' })
    ]);
    const subcategoriesByCategory = subcategories.reduce((map, subcategory) => {
      const key = subcategory.category;
      map[key] = map[key] || [];
      map[key].push(subcategory);
      return map;
    }, {});
    return categories.map((category) => ({
      ...category,
      subcategories: subcategoriesByCategory[category.id] || []
    }));
  } catch (error) {
    throw pbError(error);
  }
}

export async function createCategory({ name, subcategoryName }) {
  requireAuthRecord();
  try {
    const category = await findOrCreateCategory(name);
    const subcategory = await findOrCreateSubcategory(category.id, subcategoryName);
    return { category, subcategory };
  } catch (error) {
    throw pbError(error);
  }
}

export async function createSubcategory({ categoryId, name }) {
  requireAuthRecord();
  try {
    const subcategory = await findOrCreateSubcategory(categoryId, name);
    if (!subcategory) {
      throw pbError({ status: 400, message: 'Subcategory name is required.' });
    }
    return subcategory;
  } catch (error) {
    throw pbError(error);
  }
}

export async function updateCategory(id, { name }) {
  requireAuthRecord();
  try {
    return await pb.collection('oikos_categories').update(id, { name: sanitizeName(name) });
  } catch (error) {
    throw pbError(error);
  }
}

export async function updateSubcategory(id, { name }) {
  requireAuthRecord();
  try {
    return await pb.collection('oikos_subcategories').update(id, { name: sanitizeName(name) });
  } catch (error) {
    throw pbError(error);
  }
}

export async function fetchStores() {
  requireAuthRecord();
  try {
    return await listRecords('oikos_stores', { sort: 'name' });
  } catch (error) {
    throw pbError(error);
  }
}

export async function createStore({ name }) {
  requireAuthRecord();
  try {
    return await findOrCreateStore(name);
  } catch (error) {
    throw pbError(error);
  }
}

export async function updateStore(id, { name }) {
  requireAuthRecord();
  try {
    return await pb.collection('oikos_stores').update(id, { name: sanitizeName(name) });
  } catch (error) {
    throw pbError(error);
  }
}

export async function fetchPaymentMethods() {
  requireAuthRecord();
  try {
    return await listRecords('oikos_payment_methods', { sort: 'name' });
  } catch (error) {
    throw pbError(error);
  }
}

export async function createPaymentMethod({ name }) {
  requireAuthRecord();
  try {
    const existing = await findByName('oikos_payment_methods', name);
    return existing || pb.collection('oikos_payment_methods').create({ name: sanitizeName(name) });
  } catch (error) {
    throw pbError(error);
  }
}

export async function updatePaymentMethod(id, { name }) {
  requireAuthRecord();
  try {
    return await pb.collection('oikos_payment_methods').update(id, { name: sanitizeName(name) });
  } catch (error) {
    throw pbError(error);
  }
}

async function listTransactionIds(filter) {
  const records = await listRecords('oikos_transactions', {
    fields: 'id',
    filter,
    skipTotal: true,
    batch: 200,
    requestKey: null
  });
  return records.map((record) => record.id);
}

async function updateTransactions(ids, body) {
  for (const id of ids) {
    await pb.collection('oikos_transactions').update(id, body);
  }
}

export async function countTransactionsUsing(field, id) {
  requireAuthRecord();
  try {
    const result = await pb.collection('oikos_transactions').getList(1, 1, {
      filter: `${field} = "${id}"`,
      fields: 'id',
      requestKey: null
    });
    return result.totalItems || 0;
  } catch (error) {
    throw pbError(error);
  }
}

export async function deleteStore(id, { replacementId = '' } = {}) {
  requireAuthRecord();
  try {
    const usageCount = await countTransactionsUsing('store', id);
    if (usageCount > 0) {
      if (!replacementId || replacementId === id) {
        const error = pbError({
          status: 409,
          message: `This store is used by ${usageCount} transaction${usageCount === 1 ? '' : 's'}. Choose a replacement store.`
        });
        error.code = 'IN_USE';
        error.usageCount = usageCount;
        throw error;
      }
      const ids = await listTransactionIds(`store = "${id}"`);
      await updateTransactions(ids, { store: replacementId });
    }
    await pb.collection('oikos_stores').delete(id);
    return { usageCount };
  } catch (error) {
    if (error.code === 'IN_USE') throw error;
    throw pbError(error);
  }
}

export async function deletePaymentMethod(id, { replacementId = '' } = {}) {
  requireAuthRecord();
  try {
    const usageCount = await countTransactionsUsing('payment_method', id);
    if (usageCount > 0) {
      if (!replacementId || replacementId === id) {
        const error = pbError({
          status: 409,
          message: `This payment method is used by ${usageCount} transaction${usageCount === 1 ? '' : 's'}. Choose a replacement.`
        });
        error.code = 'IN_USE';
        error.usageCount = usageCount;
        throw error;
      }
      const ids = await listTransactionIds(`payment_method = "${id}"`);
      await updateTransactions(ids, { payment_method: replacementId });
    }
    await pb.collection('oikos_payment_methods').delete(id);
    return { usageCount };
  } catch (error) {
    if (error.code === 'IN_USE') throw error;
    throw pbError(error);
  }
}

export async function deleteSubcategory(id, { replacementId = '' } = {}) {
  requireAuthRecord();
  try {
    const usageCount = await countTransactionsUsing('subcategory', id);
    let replacement = null;
    if (usageCount > 0) {
      if (!replacementId || replacementId === id) {
        const error = pbError({
          status: 409,
          message: `This subcategory is used by ${usageCount} transaction${usageCount === 1 ? '' : 's'}. Choose a replacement subcategory.`
        });
        error.code = 'IN_USE';
        error.usageCount = usageCount;
        throw error;
      }
      replacement = await pb.collection('oikos_subcategories').getOne(replacementId);
      const ids = await listTransactionIds(`subcategory = "${id}"`);
      await updateTransactions(ids, {
        subcategory: replacement.id,
        category: replacement.category
      });
    }
    await pb.collection('oikos_subcategories').delete(id);
    return { usageCount };
  } catch (error) {
    if (error.code === 'IN_USE') throw error;
    throw pbError(error);
  }
}

export async function deleteCategory(id, { replacementCategoryId = '', replacementSubcategoryId = '' } = {}) {
  requireAuthRecord();
  try {
    const usageCount = await countTransactionsUsing('category', id);
    if (usageCount > 0) {
      if (!replacementCategoryId || replacementCategoryId === id || !replacementSubcategoryId) {
        const error = pbError({
          status: 409,
          message: `This category is used by ${usageCount} transaction${usageCount === 1 ? '' : 's'}. Choose a replacement category and subcategory.`
        });
        error.code = 'IN_USE';
        error.usageCount = usageCount;
        throw error;
      }
      const replacementSubcategory = await pb.collection('oikos_subcategories').getOne(replacementSubcategoryId);
      if (replacementSubcategory.category !== replacementCategoryId) {
        throw pbError({ status: 400, message: 'Replacement subcategory must belong to the selected category.' });
      }
      const ids = await listTransactionIds(`category = "${id}"`);
      await updateTransactions(ids, {
        category: replacementCategoryId,
        subcategory: replacementSubcategoryId
      });
    }

    // Remove child subcategories first so orphaned relations cannot block delete.
    const childSubcategories = await listRecords('oikos_subcategories', {
      filter: `category = "${id}"`,
      fields: 'id',
      skipTotal: true,
      batch: 200,
      requestKey: null
    });
    for (const subcategory of childSubcategories) {
      await pb.collection('oikos_subcategories').delete(subcategory.id);
    }

    await pb.collection('oikos_categories').delete(id);
    return { usageCount };
  } catch (error) {
    if (error.code === 'IN_USE') throw error;
    throw pbError(error);
  }
}

export async function fetchUsers() {
  requireAuthRecord();
  try {
    const users = await listRecords('users', { sort: 'name,email' });
    return users.map(publicUser);
  } catch (error) {
    throw pbError(error);
  }
}

export async function fetchUser(userId) {
  requireAuthRecord();
  try {
    const record = await pb.collection('users').getOne(userId);
    return publicUser(record);
  } catch (error) {
    throw pbError(error, 'User not found.');
  }
}

export async function approveUser(userId) {
  requireAuthRecord();
  try {
    const updated = await pb.collection('users').update(userId, { approved: true });
    return { user: publicUser(updated) };
  } catch (error) {
    throw pbError(error);
  }
}

export async function adminUpdateUser(userId, updates = {}) {
  requireAuthRecord();
  if (!isAdminRecord(pb.authStore.record)) {
    throw pbError({ status: 403, message: 'Admin access required.' });
  }
  const body = {};
  if (updates.weeklyDigest !== undefined) {
    body.weeklyDigestOptOut = !Boolean(updates.weeklyDigest);
  }
  if (updates.approved !== undefined) {
    body.approved = Boolean(updates.approved);
  }
  if (!Object.keys(body).length) {
    throw pbError({ status: 400, message: 'No user settings to update.' });
  }
  try {
    const updated = await pb.collection('users').update(userId, body);
    return { user: publicUser(updated) };
  } catch (error) {
    throw pbError(error, 'Could not update user.');
  }
}

export async function adminResendVerification(userId) {
  requireAuthRecord();
  try {
    const user = await pb.collection('users').getOne(userId);
    const email = sanitizeName(user.email).toLowerCase();
    if (!email) throw pbError({ status: 400, message: 'User email is unavailable.' });
    await pb.collection('users').requestVerification(email);
    return { ok: true, email, message: 'Verification email sent.' };
  } catch (error) {
    throw pbError(error);
  }
}

export async function previewWeeklyDigest(userId, { logoMode = 'embed' } = {}) {
  requireAuthRecord();
  if (!isAdminRecord(pb.authStore.record)) {
    throw pbError({ status: 403, message: 'Admin access required.' });
  }

  const range = previousWeekRange();
  const user = await fetchUser(userId);
  const firstPage = await fetchTransactions({
    user: userId,
    fromDate: range.fromIso,
    toDate: range.toInclusiveIso,
    perPage: 100,
    page: 1
  });

  let items = [...(firstPage.items || [])];
  for (let page = 2; page <= (firstPage.totalPages || 1); page += 1) {
    const next = await fetchTransactions({
      user: userId,
      fromDate: range.fromIso,
      toDate: range.toInclusiveIso,
      perPage: 100,
      page
    });
    items = items.concat(next.items || []);
  }

  return buildWeeklyDigestPreview({
    user,
    transactions: items,
    appUrl: typeof window !== 'undefined' ? window.location.origin : '',
    logoMode
  });
}

export async function sendWeeklyDigest(userId, { subject = '', html = '' } = {}) {
  requireAuthRecord();
  if (!isAdminRecord(pb.authStore.record)) {
    throw pbError({ status: 403, message: 'Admin access required.' });
  }
  const targetSubject = String(subject || '').trim();
  const targetHtml = String(html || '').trim();
  if (!userId || !targetSubject || !targetHtml) {
    throw pbError({ status: 400, message: 'Refresh the digest preview before sending.' });
  }

  try {
    const user = await fetchUser(userId);
    await pb.collection('oikos_digest_jobs').create({
      targetUser: userId,
      subject: targetSubject,
      html: targetHtml,
      status: 'pending',
      error: ''
    });
    return {
      ok: true,
      email: user.email || '',
      message: user.email
        ? `Weekly digest emailed to ${user.email}.`
        : 'Weekly digest sent.'
    };
  } catch (error) {
    const message = error?.response?.message || error?.data?.message || error?.message;
    throw pbError(error, message || 'Could not send weekly digest.');
  }
}

function userScopeFilter(user = pb.authStore.record) {
  return isAdminRecord(user) ? '' : `user = "${user.id}"`;
}

export async function fetchTransactions(query = {}) {
  const user = requireAuthRecord();
  try {
    const filters = [];
    const scope = userScopeFilter(user);
    if (scope) filters.push(scope);
    if (query.fromDate) filters.push(`date >= "${pbDate(query.fromDate)}"`);
    if (query.toDate) filters.push(`date < "${nextDayBoundary(query.toDate)}"`);
    if (query.category) filters.push(`category = "${query.category}"`);
    if (query.subcategory) filters.push(`subcategory = "${query.subcategory}"`);
    if (query.store) filters.push(`store = "${query.store}"`);
    if (query.paymentMethod) filters.push(`payment_method = "${query.paymentMethod}"`);
    if (query.user && isAdminRecord(user)) filters.push(`user = "${query.user}"`);

    const filter = filters.join(' && ');
    const page = Math.max(Number.parseInt(String(query.page || 1), 10) || 1, 1);
    const perPage = normalizeTransactionPageSize(query.perPage || user.transactionPageSize);
    const includeTotalAmount = ['1', 'true', 'yes'].includes(String(query.includeTotalAmount || '').toLowerCase());

    const transactions = await pb.collection('oikos_transactions').getList(page, perPage, {
      sort: '-date',
      expand: 'category,subcategory,store,user,payment_method',
      filter,
      requestKey: null
    });

    const pageItems = transactions.items || [];
    let totalAmount = 0;
    if (transactions.totalItems <= pageItems.length) {
      totalAmount = pageItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    } else if (includeTotalAmount) {
      const amounts = await listRecords('oikos_transactions', {
        fields: 'amount',
        filter,
        skipTotal: true,
        batch: 1000
      });
      totalAmount = amounts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    }

    return {
      items: pageItems,
      page: transactions.page,
      perPage: transactions.perPage,
      totalItems: transactions.totalItems,
      totalPages: transactions.totalPages,
      totalAmount
    };
  } catch (error) {
    throw pbError(error);
  }
}

export async function fetchTransaction(id) {
  const user = requireAuthRecord();
  try {
    const transaction = await pb.collection('oikos_transactions').getOne(id, {
      expand: 'category,subcategory,store,payment_method,user'
    });
    if (!isAdminRecord(user) && transaction.user !== user.id) {
      throw pbError({ status: 404, message: 'Transaction not found.' });
    }
    return transaction;
  } catch (error) {
    throw pbError(error);
  }
}

export async function createTransaction(body) {
  const user = requireAuthRecord();
  try {
    const amount = Number(body.amount);
    const date = sanitizeName(body.date);
    const title = sanitizeName(body.title);
    if (!date || Number.isNaN(amount) || amount <= 0) {
      throw pbError({ status: 400, message: 'Date and a positive amount are required.' });
    }

    let categoryId = sanitizeName(body.category);
    let subcategoryId = sanitizeName(body.subcategory);
    let storeId = sanitizeName(body.store);
    let storeText = sanitizeName(body.storeText);

    if ((body.categoryName || body.subcategoryName || body.storeName) && !isAdminRecord(user)) {
      throw pbError({ status: 403, message: 'Only admins can add categories, subcategories, or stores.' });
    }

    if (body.categoryName) {
      const category = await findOrCreateCategory(body.categoryName);
      categoryId = category.id;
    }
    if (body.subcategoryName && categoryId) {
      const subcategory = await findOrCreateSubcategory(categoryId, body.subcategoryName);
      subcategoryId = subcategory.id;
    }
    if (body.storeName) {
      const store = await findOrCreateStore(body.storeName);
      storeId = store.id;
    }

    if (!categoryId || !subcategoryId || !storeId) {
      throw pbError({ status: 400, message: 'Category, subcategory, and store are required.' });
    }

    if (await isOtherStore(storeId)) {
      if (!storeText) throw pbError({ status: 400, message: 'Store name is required when store is Other.' });
    } else {
      storeText = '';
    }

    const paymentMethodId = sanitizeName(body.paymentMethod) || null;

    return await pb.collection('oikos_transactions').create({
      date: pbDate(date),
      title,
      amount,
      payment_method: paymentMethodId,
      category: categoryId,
      subcategory: subcategoryId,
      store: storeId,
      storeText,
      user: user.id
    });
  } catch (error) {
    throw pbError(error);
  }
}

export async function updateTransaction(id, body) {
  const user = requireAuthRecord();
  try {
    const transaction = await pb.collection('oikos_transactions').getOne(id);
    if (!isAdminRecord(user) && transaction.user !== user.id) {
      throw pbError({ status: 404, message: 'Transaction not found.' });
    }

    const amount = Number(body.amount);
    const date = sanitizeName(body.date);
    const title = sanitizeName(body.title);
    if (!date || Number.isNaN(amount) || amount <= 0) {
      throw pbError({ status: 400, message: 'Date and a positive amount are required.' });
    }

    const categoryId = sanitizeName(body.category);
    const subcategoryId = sanitizeName(body.subcategory);
    const storeId = sanitizeName(body.store);
    let storeText = sanitizeName(body.storeText);
    if (!categoryId || !subcategoryId || !storeId) {
      throw pbError({ status: 400, message: 'Category, subcategory, and store are required.' });
    }

    if (await isOtherStore(storeId)) {
      if (!storeText) throw pbError({ status: 400, message: 'Store name is required when store is Other.' });
    } else {
      storeText = '';
    }

    return await pb.collection('oikos_transactions').update(id, {
      date: pbDate(date),
      title,
      amount,
      payment_method: sanitizeName(body.paymentMethod) || null,
      category: categoryId,
      subcategory: subcategoryId,
      store: storeId,
      storeText,
      user: transaction.user || user.id
    });
  } catch (error) {
    throw pbError(error);
  }
}

export async function deleteTransaction(id) {
  const user = requireAuthRecord();
  try {
    const transaction = await pb.collection('oikos_transactions').getOne(id);
    if (!isAdminRecord(user) && transaction.user !== user.id) {
      throw pbError({ status: 404, message: 'Transaction not found.' });
    }
    await pb.collection('oikos_transactions').delete(id);
  } catch (error) {
    throw pbError(error);
  }
}

export async function fetchHomeTotals() {
  const user = requireAuthRecord();
  try {
    const baseFilters = [];
    const scope = userScopeFilter(user);
    if (scope) baseFilters.push(scope);
    const thisMonth = currentMonthRange(0);
    const lastMonth = currentMonthRange(-1);
    const rangeFilter = [
      ...baseFilters,
      `date >= "${lastMonth.start}"`,
      `date < "${thisMonth.end}"`
    ].join(' && ');

    const records = await listRecords('oikos_transactions', {
      fields: 'date,amount',
      filter: rangeFilter,
      skipTotal: true,
      batch: 1000
    });

    let thisMonthTotal = 0;
    let lastMonthTotal = 0;
    records.forEach((record) => {
      const amount = Number(record.amount || 0);
      const date = String(record.date || '');
      if (date >= thisMonth.start && date < thisMonth.end) thisMonthTotal += amount;
      else if (date >= lastMonth.start && date < lastMonth.end) lastMonthTotal += amount;
    });

    return { thisMonth: thisMonthTotal, lastMonth: lastMonthTotal };
  } catch (error) {
    throw pbError(error);
  }
}

export async function fetchSummary() {
  const user = requireAuthRecord();
  try {
    const filter = userScopeFilter(user);
    const [transactions, categories, subcategories, stores, paymentMethods] = await Promise.all([
      listRecords('oikos_transactions', {
        fields: 'id,date,amount,category,subcategory,store,storeText,payment_method',
        filter,
        skipTotal: true,
        batch: 1000
      }),
      listRecords('oikos_categories', { fields: 'id,name', skipTotal: true, batch: 200 }),
      listRecords('oikos_subcategories', { fields: 'id,name', skipTotal: true, batch: 500 }),
      listRecords('oikos_stores', { fields: 'id,name', skipTotal: true, batch: 200 }),
      listRecords('oikos_payment_methods', { fields: 'id,name', skipTotal: true, batch: 100 })
    ]);

    const maps = {
      categories: toNameMap(categories),
      subcategories: toNameMap(subcategories),
      stores: toNameMap(stores),
      paymentMethods: toNameMap(paymentMethods)
    };

    return {
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        amount: transaction.amount,
        storeText: transaction.storeText || '',
        category: maps.categories[transaction.category] || 'Uncategorized',
        subcategory: maps.subcategories[transaction.subcategory] || 'None',
        store: maps.stores[transaction.store] || 'Other',
        paymentMethod: maps.paymentMethods[transaction.payment_method] || 'Not set'
      }))
    };
  } catch (error) {
    throw pbError(error);
  }
}

export function getAppInfo() {
  return {
    version: String(typeof __OIKOS_VERSION__ !== 'undefined' ? __OIKOS_VERSION__ : '').trim(),
    branch: String(typeof __OIKOS_BRANCH__ !== 'undefined' ? __OIKOS_BRANCH__ : '').trim()
  };
}
