import express from 'express';
import PocketBase from 'pocketbase';
import { AsyncLocalStorage } from 'node:async_hooks';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appVersion = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version;

function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!existsSync(envPath)) return;

  const contents = readFileSync(envPath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function detectGitBranch() {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
}

function resolveAppBuildBranch() {
  const configured = String(process.env.APP_BUILD_BRANCH || '').trim();
  if (configured) return configured;
  return detectGitBranch() || 'unknown';
}

loadDotEnv();

const appVersion = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version;

const app = express();
const port = Number(process.env.PORT || process.env.APP_PORT || 3000);
const pbUrl = (process.env.PB_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
const pbToken = process.env.PB_TOKEN || '';
const appBuildBranch = resolveAppBuildBranch();
const authCookieName = 'pb_auth';
const authHintCookieName = 'oikos_session';
const DEFAULT_TRANSACTION_PAGE_SIZE = 25;
const TRANSACTION_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const API_CACHE_TTL_MS = Number(process.env.API_CACHE_TTL_MS || 5 * 60 * 1000);
const apiCache = new Map();
const apiCacheInflight = new Map();
const requestContext = new AsyncLocalStorage();
let requestIdSequence = 0;

function nextRequestId() {
  requestIdSequence += 1;
  return requestIdSequence.toString(36).padStart(6, '0');
}

function requestId() {
  return requestContext.getStore()?.id || 'startup';
}

function logHttp(label, details) {
  console.log(`[${label}]`, JSON.stringify({
    requestId: requestId(),
    ...details
  }));
}

function requestPath(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function createPocketBaseClient() {
  const client = new PocketBase(pbUrl);
  client.beforeSend = (url, options) => {
    options.__oikosStartedAt = performance.now();
    options.__oikosUrl = url;
    const baseFetch = options.fetch || fetch;
    options.fetch = async (fetchUrl, fetchOptions) => {
      try {
        return await baseFetch(fetchUrl, fetchOptions);
      } catch (error) {
        const elapsedMs = Math.round((performance.now() - (options.__oikosStartedAt || performance.now())) * 100) / 100;
        logHttp('pb', {
          target: pbUrl,
          method: options.method || 'GET',
          url: requestPath(String(fetchUrl || url)),
          status: 'network-error',
          elapsedMs,
          error: error?.message,
          causeCode: error?.cause?.code
        });
        throw error;
      }
    };
    return { url, options };
  };
  client.afterSend = (response, data, options) => {
    const elapsedMs = Math.round((performance.now() - (options.__oikosStartedAt || performance.now())) * 100) / 100;
    logHttp('pb', {
      target: pbUrl,
      method: options.method || 'GET',
      url: requestPath(response.url || options.__oikosUrl),
      status: response.status,
      elapsedMs,
      message: data?.message
    });
    return data;
  };
  return client;
}

const pb = createPocketBaseClient();

if (pbToken) {
  pb.authStore.save(pbToken, null);
}

app.use(express.json());
app.use((req, res, next) => {
  const id = nextRequestId();
  const startedAt = performance.now();
  requestContext.run({ id }, () => {
    res.on('finish', () => {
      const elapsedMs = Math.round((performance.now() - startedAt) * 100) / 100;
      logHttp('http', {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        elapsedMs,
        remoteIp: req.ip,
        forwardedFor: req.get('x-forwarded-for') || '',
        host: req.get('host') || '',
        userAgent: req.get('user-agent') || ''
      });
    });
    next();
  });
});
app.use(express.static(path.join(__dirname, 'public')));

function authCookie(client) {
  return client.authStore.exportToCookie({
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });
}

function authHintCookie() {
  return `${authHintCookieName}=1; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
}

function clearAuthHintCookie() {
  return `${authHintCookieName}=; Path=/; SameSite=Lax; Max-Age=0`;
}

function authResponseCookies(client, user) {
  return [
    authCookie(client),
    isApproved(user) ? authHintCookie() : clearAuthHintCookie()
  ];
}

function clearAuthCookies() {
  return [
    `${authCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    clearAuthHintCookie()
  ];
}

function clientFromRequest(req) {
  const client = createPocketBaseClient();
  client.authStore.loadFromCookie(req.headers.cookie || '', authCookieName);
  return client;
}

function publicUser(record) {
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
    verified: record.verified !== false,
    approved: admin ? true : record.approved !== false,
    kind: record.kind || 'user',
    isAdmin: admin,
    transactionPageSize: normalizeTransactionPageSize(record.transactionPageSize)
  };
}

function isAdmin(record) {
  return record?.kind === 'admin';
}

function isApproved(record) {
  return isAdmin(record) || record?.approved !== false;
}

function cacheScope(user) {
  return isAdmin(user) ? 'admin' : `user:${user.id}`;
}

function cacheGet(key) {
  const entry = apiCache.get(key);
  if (!entry) return null;
  if (entry.expires <= Date.now()) {
    apiCache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value, ttlMs = API_CACHE_TTL_MS) {
  apiCache.set(key, {
    value,
    expires: Date.now() + ttlMs
  });
  return value;
}

function cacheDeleteByPrefix(...prefixes) {
  for (const key of apiCache.keys()) {
    if (prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}:`) || key.startsWith(`${prefix}?`))) {
      apiCache.delete(key);
    }
  }
  for (const key of apiCacheInflight.keys()) {
    if (prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}:`) || key.startsWith(`${prefix}?`))) {
      apiCacheInflight.delete(key);
    }
  }
}

function invalidateReferenceCache() {
  cacheDeleteByPrefix('categories', 'stores', 'payment-methods', 'users');
  // Expanded transaction payloads embed reference names.
  invalidateTransactionCache();
}

function invalidateTransactionCache() {
  cacheDeleteByPrefix('summary', 'home-totals', 'monthly-totals', 'transactions', 'transaction');
}

async function cached(key, loader) {
  const hit = cacheGet(key);
  if (hit !== null) return { value: hit, cache: 'HIT' };
  if (apiCacheInflight.has(key)) {
    const value = await apiCacheInflight.get(key);
    return { value, cache: 'HIT' };
  }
  const pending = Promise.resolve()
    .then(loader)
    .then((value) => {
      cacheSet(key, value);
      return value;
    })
    .finally(() => {
      apiCacheInflight.delete(key);
    });
  apiCacheInflight.set(key, pending);
  const value = await pending;
  return { value, cache: 'MISS' };
}

function sendCached(res, payload) {
  res.setHeader('X-Oikos-Cache', payload.cache);
  res.json(payload.value);
}

function requireAuth(req, res, next) {
  const client = clientFromRequest(req);
  if (!client.authStore.isValid || !client.authStore.record?.id) {
    return res.status(401).json({ error: 'Please log in to continue.' });
  }
  req.pb = client;
  req.user = client.authStore.record;
  next();
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: 'Admin access is required.' });
  }
  next();
}

function requireApproved(req, res, next) {
  if (!isApproved(req.user)) {
    return res.status(403).json({
      error: 'Admin approval is still pending.',
      approvalPending: true
    });
  }
  next();
}

function sanitizeName(value) {
  return String(value || '').trim();
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeTransactionPageSize(value) {
  const parsed = parsePositiveInt(value, DEFAULT_TRANSACTION_PAGE_SIZE);
  return TRANSACTION_PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : DEFAULT_TRANSACTION_PAGE_SIZE;
}

function pbDate(value) {
  return `${value} 00:00:00.000Z`;
}

function monthBoundary(year, monthIndex) {
  return `${new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10)} 00:00:00.000Z`;
}

function nextDayBoundary(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return `${new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)} 00:00:00.000Z`;
}

function currentMonthRange(offset = 0) {
  const today = new Date();
  const year = today.getFullYear();
  const monthIndex = today.getMonth() + offset;
  return {
    start: monthBoundary(year, monthIndex),
    end: monthBoundary(year, monthIndex + 1)
  };
}

function sumRecordAmounts(records) {
  return records.reduce((sum, record) => sum + Number(record.amount || 0), 0);
}

function totalsByMonth(records) {
  return records.reduce((totals, record) => {
    const month = String(record.date || '').slice(0, 7);
    if (!month) return totals;
    totals[month] = (totals[month] || 0) + Number(record.amount || 0);
    return totals;
  }, {});
}

function toNameMap(records) {
  return new Map((records || []).map((record) => [record.id, record.name]));
}

function summaryTransaction(record, maps = {}) {
  const storeName = maps.stores?.get(record.store)
    || record.expand?.store?.name
    || 'Unknown';
  const storeText = String(record.storeText || '').trim();
  return {
    id: record.id,
    date: record.date,
    amount: Number(record.amount || 0),
    category: maps.categories?.get(record.category)
      || record.expand?.category?.name
      || 'Uncategorized',
    subcategory: maps.subcategories?.get(record.subcategory)
      || record.expand?.subcategory?.name
      || 'None',
    store: storeText || storeName,
    storeText,
    paymentMethod: maps.paymentMethods?.get(record.payment_method)
      || record.expand?.payment_method?.name
      || 'Not set'
  };
}

async function listRecords(client, collection, params) {
  return client.collection(collection).getFullList({
    ...Object.fromEntries(Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== ''))
  });
}

async function listPageRecords(client, collection, page, perPage, params) {
  return client.collection(collection).getList(page, perPage, {
    ...Object.fromEntries(Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== ''))
  });
}

async function sumFilteredAmounts(client, filter) {
  const records = await listRecords(client, 'oikos_transactions', {
    fields: 'amount',
    filter: filter || undefined,
    skipTotal: true,
    batch: 1000,
    requestKey: null
  });
  return sumRecordAmounts(records);
}

async function loadRelationNameMaps(client) {
  const [categories, subcategories, stores, paymentMethods] = await Promise.all([
    listRecords(client, 'oikos_categories', { fields: 'id,name', skipTotal: true, batch: 200 }),
    listRecords(client, 'oikos_subcategories', { fields: 'id,name', skipTotal: true, batch: 500 }),
    listRecords(client, 'oikos_stores', { fields: 'id,name', skipTotal: true, batch: 200 }),
    listRecords(client, 'oikos_payment_methods', { fields: 'id,name', skipTotal: true, batch: 100 })
  ]);
  return {
    categories: toNameMap(categories),
    subcategories: toNameMap(subcategories),
    stores: toNameMap(stores),
    paymentMethods: toNameMap(paymentMethods)
  };
}

async function createRecord(client, collection, body) {
  return client.collection(collection).create(body);
}

async function findByName(client, collection, name, extraFilter = '') {
  const normalized = sanitizeName(name);
  if (!normalized) return null;
  const escaped = normalized.replaceAll('"', '\\"');
  const filter = [`name = "${escaped}"`, extraFilter].filter(Boolean).join(' && ');
  try {
    return await client.collection(collection).getFirstListItem(filter);
  } catch {
    return null;
  }
}

async function findOrCreateCategory(client, name) {
  const existing = await findByName(client, 'oikos_categories', name);
  return existing || createRecord(client, 'oikos_categories', { name: sanitizeName(name) });
}

async function findOrCreateSubcategory(client, categoryId, name) {
  const normalized = sanitizeName(name);
  if (!normalized) return null;
  const existing = await findByName(client, 'oikos_subcategories', normalized, `category = "${categoryId}"`);
  return existing || createRecord(client, 'oikos_subcategories', { name: normalized, category: categoryId });
}

async function findOrCreateStore(client, name) {
  const existing = await findByName(client, 'oikos_stores', name);
  return existing || createRecord(client, 'oikos_stores', { name: sanitizeName(name) });
}

async function findOrCreatePaymentMethod(client, name) {
  const existing = await findByName(client, 'oikos_payment_methods', name);
  return existing || createRecord(client, 'oikos_payment_methods', { name: sanitizeName(name) });
}

async function resolvePaymentMethod(client, value) {
  const normalized = sanitizeName(value);
  if (!normalized) return null;
  try {
    return await client.collection('oikos_payment_methods').getOne(normalized);
  } catch {
    return findByName(client, 'oikos_payment_methods', normalized);
  }
}

async function isOtherStore(client, storeId) {
  if (!storeId) return false;
  try {
    const store = await client.collection('oikos_stores').getOne(storeId);
    return sanitizeName(store.name).toLowerCase() === 'other';
  } catch {
    return false;
  }
}

function handleError(res, error) {
  console.error(error);
  const requestUrl = error.url || error.originalError?.url || error.cause?.url || '';
  const connectionRefused = error.cause?.code === 'ECONNREFUSED' || error.originalError?.cause?.code === 'ECONNREFUSED';
  if (connectionRefused) {
    return res.status(503).json({
      error: 'PocketBase is not running.',
      details: error.message,
      hint: `Start PocketBase service. Service not available at ${pbUrl}`
    });
  }
  const validation = error.response?.data || error.data?.data || error.originalError?.data?.data || {};
  const validationMessages = Object.entries(validation)
    .map(([field, detail]) => `${field}: ${detail.message || detail}`)
    .join(' ');
  res.status(error.status || error.response?.status || 500).json({
    error: validationMessages || error.message,
    details: error.data || error.response || error.originalError,
    hint: 'Make sure PocketBase is running and run npm run setup:pocketbase once.'
  });
}

app.get('/api/health', async (_req, res) => {
  try {
    await pb.health.check();
    res.json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/app-info', (_req, res) => {
  res.json({ version: appVersion, branch: appBuildBranch });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const email = sanitizeName(req.body.email).toLowerCase();
    const password = String(req.body.password || '');
    const firstName = sanitizeName(req.body.firstName);
    const lastName = sanitizeName(req.body.lastName);
    if (!email || !firstName || !lastName || password.length < 8) {
      return res.status(400).json({ error: 'First name, last name, email, and an 8 character password are required.' });
    }

    const client = createPocketBaseClient();
    await client.collection('users').create({
      email,
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      kind: 'user',
      approved: false,
      emailVisibility: true,
      password,
      passwordConfirm: password
    });
    await client.collection('users').requestVerification(email);
    res.status(201).json({
      requiresVerification: true,
      email,
      message: 'Account created. Check your email to verify your address before signing in.'
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = sanitizeName(req.body.email).toLowerCase();
    const password = String(req.body.password || '');
    const client = createPocketBaseClient();
    const auth = await client.collection('users').authWithPassword(email, password);
    if (auth.record?.verified === false) {
      return res.status(403).json({
        error: 'Please verify your email before signing in.',
        requiresVerification: true,
        email
      });
    }
    res.setHeader('Set-Cookie', authResponseCookies(client, auth.record));
    res.json({
      token: client.authStore.token,
      user: publicUser(client.authStore.record),
      approvalPending: !isApproved(auth.record)
    });
  } catch (error) {
    console.error('Login failed', {
      pbUrl,
      status: error?.status,
      message: error?.message,
      responseMessage: error?.response?.message,
      url: error?.url || error?.originalError?.url || error?.cause?.url,
      causeCode: error?.cause?.code || error?.originalError?.cause?.code
    });
    const message = String(error?.response?.message || error?.message || '').toLowerCase();
    if (message.includes('verified') || message.includes('verification')) {
      return res.status(403).json({
        error: 'Please verify your email before signing in.',
        requiresVerification: true,
        email
      });
    }
    const authRejected = error.status === 400 || error.status === 401;
    if (!authRejected) {
      return handleError(res, error);
    }
    res.status(401).json({ error: 'Invalid email or password, or your email is not verified yet.' });
  }
});

app.post('/api/auth/request-verification', async (req, res) => {
  try {
    const email = sanitizeName(req.body.email).toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }
    const client = createPocketBaseClient();
    await client.collection('users').requestVerification(email);
    res.json({
      ok: true,
      email,
      message: 'Verification email sent.'
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/auth/verify', async (req, res) => {
  try {
    const token = sanitizeName(req.body.token);
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required.' });
    }
    const client = createPocketBaseClient();
    await client.collection('users').confirmVerification(token);
    res.json({
      ok: true,
      message: 'Email verified. Your account is now waiting for admin approval.'
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/auth/request-otp', async (req, res) => {
  try {
    const email = sanitizeName(req.body.email).toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }
    const client = createPocketBaseClient();
    const result = await client.collection('users').requestOTP(email);
    res.json({
      ok: true,
      email,
      otpId: result.otpId,
      message: 'OTP sent.'
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/auth/login-otp', async (req, res) => {
  try {
    const otpId = sanitizeName(req.body.otpId);
    const otp = sanitizeName(req.body.otp);
    if (!otpId || !otp) {
      return res.status(400).json({ error: 'otpId and otp are required.' });
    }
    const client = createPocketBaseClient();
    const auth = await client.collection('users').authWithOTP(otpId, otp);
    res.setHeader('Set-Cookie', authResponseCookies(client, auth.record || client.authStore.record));
    res.json({
      token: client.authStore.token,
      user: publicUser(auth.record || client.authStore.record),
      approvalPending: !isApproved(auth.record || client.authStore.record),
      message: 'OTP login successful.'
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', clearAuthCookies());
  res.status(204).end();
});

function tokenExpiresInMs(token) {
  try {
    const payload = String(token || '').split('.')[1];
    if (!payload) return 0;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const json = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    if (!json.exp) return 0;
    return (Number(json.exp) * 1000) - Date.now();
  } catch {
    return 0;
  }
}

function tokenNeedsRefresh(token) {
  // PocketBase tokens are long-lived; only hit auth-refresh when close to expiry.
  return tokenExpiresInMs(token) < (60 * 60 * 1000);
}

app.get('/api/auth/me', async (req, res) => {
  const client = clientFromRequest(req);
  if (!client.authStore.isValid || !client.authStore.record?.id) {
    res.setHeader('Set-Cookie', clearAuthCookies());
    return res.status(401).json({ error: 'Not logged in.' });
  }

  if (!tokenNeedsRefresh(client.authStore.token)) {
    return res.json({
      token: client.authStore.token,
      user: publicUser(client.authStore.record)
    });
  }

  try {
    const auth = await client.collection('users').authRefresh();
    res.setHeader('Set-Cookie', authResponseCookies(client, auth.record || client.authStore.record));
    res.json({
      token: client.authStore.token,
      user: publicUser(auth.record || client.authStore.record)
    });
  } catch {
    res.setHeader('Set-Cookie', clearAuthCookies());
    res.status(401).json({ error: 'Not logged in.' });
  }
});

app.put('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const updateBody = {
      emailVisibility: Boolean(req.body.emailVisibility)
    };
    const name = sanitizeName(req.body.name);
    const firstName = sanitizeName(req.body.firstName);
    const lastName = sanitizeName(req.body.lastName);
    const email = sanitizeName(req.body.email).toLowerCase();

    if (firstName || lastName) {
      if (!firstName || !lastName) {
        return res.status(400).json({ error: 'Both first name and last name are required.' });
      }
      updateBody.firstName = firstName;
      updateBody.lastName = lastName;
      updateBody.name = `${firstName} ${lastName}`;
    } else if (name) {
      updateBody.name = name;
    }
    if (email) updateBody.email = email;
    if (req.body.transactionPageSize !== undefined) {
      updateBody.transactionPageSize = normalizeTransactionPageSize(req.body.transactionPageSize);
    }
    const updated = await req.pb.collection('users').update(req.user.id, {
      ...updateBody
    });
    req.pb.authStore.save(req.pb.authStore.token, updated);
    res.setHeader('Set-Cookie', authResponseCookies(req.pb, updated));
    res.json({
      token: req.pb.authStore.token,
      user: publicUser(updated)
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/categories', requireAuth, requireApproved, async (req, res) => {
  try {
    sendCached(res, await cached('categories', async () => {
      const [categories, subcategories] = await Promise.all([
        listRecords(req.pb, 'oikos_categories', { sort: 'name' }),
        listRecords(req.pb, 'oikos_subcategories', { sort: 'name' })
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
    }));
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/categories', requireAuth, requireApproved, requireAdmin, async (req, res) => {
  try {
    const name = sanitizeName(req.body.name);
    if (!name) return res.status(400).json({ error: 'Category name is required.' });

    const category = await findOrCreateCategory(req.pb, name);
    const subcategory = await findOrCreateSubcategory(req.pb, category.id, req.body.subcategoryName);
    invalidateReferenceCache();
    res.status(201).json({ category, subcategory });
  } catch (error) {
    handleError(res, error);
  }
});

app.put('/api/categories/:id', requireAuth, requireApproved, requireAdmin, async (req, res) => {
  try {
    const name = sanitizeName(req.body.name);
    if (!name) return res.status(400).json({ error: 'Category name is required.' });
    const updated = await req.pb.collection('oikos_categories').update(req.params.id, { name });
    invalidateReferenceCache();
    res.json(updated);
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/subcategories', requireAuth, requireApproved, requireAdmin, async (req, res) => {
  try {
    const name = sanitizeName(req.body.name);
    const category = sanitizeName(req.body.category);
    if (!name || !category) return res.status(400).json({ error: 'Category and subcategory are required.' });
    const subcategory = await findOrCreateSubcategory(req.pb, category, name);
    invalidateReferenceCache();
    res.status(201).json(subcategory);
  } catch (error) {
    handleError(res, error);
  }
});

app.put('/api/subcategories/:id', requireAuth, requireApproved, requireAdmin, async (req, res) => {
  try {
    const name = sanitizeName(req.body.name);
    if (!name) return res.status(400).json({ error: 'Subcategory name is required.' });
    const updated = await req.pb.collection('oikos_subcategories').update(req.params.id, { name });
    invalidateReferenceCache();
    res.json(updated);
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/stores', requireAuth, requireApproved, async (req, res) => {
  try {
    sendCached(res, await cached('stores', () => listRecords(req.pb, 'oikos_stores', { sort: 'name' })));
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/stores', requireAuth, requireApproved, requireAdmin, async (req, res) => {
  try {
    const name = sanitizeName(req.body.name);
    if (!name) return res.status(400).json({ error: 'Store name is required.' });
    const store = await findOrCreateStore(req.pb, name);
    invalidateReferenceCache();
    res.status(201).json(store);
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/payment-methods', requireAuth, requireApproved, async (req, res) => {
  try {
    sendCached(res, await cached('payment-methods', () => listRecords(req.pb, 'oikos_payment_methods', { sort: 'name' })));
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/users', requireAuth, requireApproved, requireAdmin, async (req, res) => {
  try {
    sendCached(res, await cached('users', async () => {
      const users = await listRecords(req.pb, 'users', { sort: 'name,email' });
      return users.map(publicUser);
    }));
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/users/:id/resend-verification', requireAuth, requireApproved, requireAdmin, async (req, res) => {
  try {
    const user = await req.pb.collection('users').getOne(req.params.id);
    const email = sanitizeName(user.email).toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'User email is unavailable.' });
    }

    const client = createPocketBaseClient();
    await client.collection('users').requestVerification(email);
    res.json({
      ok: true,
      email,
      message: 'Verification email sent.'
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/users/:id/mark-verified', requireAuth, requireApproved, requireAdmin, async (req, res) => {
  try {
    const user = await req.pb.collection('users').getOne(req.params.id);
    const updated = await req.pb.collection('users').update(user.id, { verified: true });
    cacheDeleteByPrefix('users');
    res.json({
      user: publicUser(updated)
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/users/:id/approve', requireAuth, requireApproved, requireAdmin, async (req, res) => {
  try {
    const user = await req.pb.collection('users').getOne(req.params.id);
    const updated = await req.pb.collection('users').update(user.id, { approved: true });
    cacheDeleteByPrefix('users');
    res.json({
      user: publicUser(updated)
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/payment-methods', requireAuth, requireApproved, requireAdmin, async (req, res) => {
  try {
    const name = sanitizeName(req.body.name);
    if (!name) return res.status(400).json({ error: 'Payment method name is required.' });
    const paymentMethod = await findOrCreatePaymentMethod(req.pb, name);
    invalidateReferenceCache();
    res.status(201).json(paymentMethod);
  } catch (error) {
    handleError(res, error);
  }
});

app.put('/api/payment-methods/:id', requireAuth, requireApproved, requireAdmin, async (req, res) => {
  try {
    const name = sanitizeName(req.body.name);
    if (!name) return res.status(400).json({ error: 'Payment method name is required.' });
    const updated = await req.pb.collection('oikos_payment_methods').update(req.params.id, { name });
    invalidateReferenceCache();
    res.json(updated);
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/transactions', requireAuth, requireApproved, async (req, res) => {
  try {
    const scope = cacheScope(req.user);
    const cacheKey = `transactions:${scope}?${new URLSearchParams(req.query).toString()}`;
    sendCached(res, await cached(cacheKey, async () => {
      const filters = isAdmin(req.user) ? [] : [`user = "${req.user.id}"`];
      const page = parsePositiveInt(req.query.page, 1);
      const perPage = normalizeTransactionPageSize(req.query.perPage || req.user.transactionPageSize);
      if (req.query.month) {
        const [year, month] = String(req.query.month).split('-').map(Number);
        filters.push(`date >= "${monthBoundary(year, month - 1)}"`);
        filters.push(`date < "${monthBoundary(year, month)}"`);
      }
      if (req.query.fromDate) filters.push(`date >= "${pbDate(req.query.fromDate)}"`);
      if (req.query.toDate) filters.push(`date < "${nextDayBoundary(req.query.toDate)}"`);
      if (req.query.category) filters.push(`category = "${req.query.category}"`);
      if (req.query.subcategory) filters.push(`subcategory = "${req.query.subcategory}"`);
      if (req.query.user && isAdmin(req.user)) filters.push(`user = "${req.query.user}"`);
      if (req.query.store) filters.push(`store = "${req.query.store}"`);
      if (req.query.paymentMethod) filters.push(`payment_method = "${req.query.paymentMethod}"`);

      const filter = filters.join(' && ');
      const includeTotalAmount = ['1', 'true', 'yes'].includes(String(req.query.includeTotalAmount || '').toLowerCase());
      const transactions = await listPageRecords(req.pb, 'oikos_transactions', page, perPage, {
        sort: '-date',
        expand: 'category,subcategory,store,user,payment_method',
        filter,
        requestKey: null
      });

      const pageItems = transactions.items || [];
      let totalAmount = 0;
      if (transactions.totalItems <= pageItems.length) {
        totalAmount = sumRecordAmounts(pageItems);
      } else if (includeTotalAmount) {
        totalAmount = await sumFilteredAmounts(req.pb, filter);
      }

      return {
        items: pageItems,
        page: transactions.page,
        perPage: transactions.perPage,
        totalItems: transactions.totalItems,
        totalPages: transactions.totalPages,
        totalAmount
      };
    }));
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/transactions/:id', requireAuth, requireApproved, async (req, res) => {
  try {
    const scope = cacheScope(req.user);
    const cacheKey = `transaction:${scope}:${req.params.id}`;
    sendCached(res, await cached(cacheKey, async () => {
      const transaction = await req.pb.collection('oikos_transactions').getOne(req.params.id, {
        expand: 'category,subcategory,store,payment_method,user'
      });
      if (!isAdmin(req.user) && transaction.user !== req.user.id) {
        const error = new Error('Transaction not found.');
        error.status = 404;
        throw error;
      }
      return transaction;
    }));
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/home-totals', requireAuth, requireApproved, async (req, res) => {
  try {
    const scope = cacheScope(req.user);
    sendCached(res, await cached(`home-totals:${scope}`, async () => {
      const baseFilters = isAdmin(req.user) ? [] : [`user = "${req.user.id}"`];
      const thisMonth = currentMonthRange(0);
      const lastMonth = currentMonthRange(-1);
      const rangeFilter = [
        ...baseFilters,
        `date >= "${lastMonth.start}"`,
        `date < "${thisMonth.end}"`
      ].join(' && ');

      const records = await listRecords(req.pb, 'oikos_transactions', {
        fields: 'date,amount',
        filter: rangeFilter,
        skipTotal: true,
        batch: 1000,
        requestKey: null
      });

      let thisMonthTotal = 0;
      let lastMonthTotal = 0;
      records.forEach((record) => {
        const amount = Number(record.amount || 0);
        const date = String(record.date || '');
        if (date >= thisMonth.start && date < thisMonth.end) thisMonthTotal += amount;
        else if (date >= lastMonth.start && date < lastMonth.end) lastMonthTotal += amount;
      });

      return {
        thisMonth: thisMonthTotal,
        lastMonth: lastMonthTotal
      };
    }));
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/monthly-totals', requireAuth, requireApproved, async (req, res) => {
  try {
    const scope = cacheScope(req.user);
    sendCached(res, await cached(`monthly-totals:${scope}`, async () => {
      const filter = isAdmin(req.user) ? '' : `user = "${req.user.id}"`;
      const transactions = await listRecords(req.pb, 'oikos_transactions', {
        fields: 'date,amount',
        sort: 'date',
        filter: filter || undefined,
        skipTotal: true,
        batch: 1000
      });

      return {
        totals: totalsByMonth(transactions)
      };
    }));
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/transactions', requireAuth, requireApproved, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const date = sanitizeName(req.body.date);
    const title = sanitizeName(req.body.title);
    const paymentMethodId = sanitizeName(req.body.paymentMethod);
    if (!date || Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Date and a positive amount are required.' });
    }

    let categoryId = sanitizeName(req.body.category);
    let subcategoryId = sanitizeName(req.body.subcategory);
    let storeId = sanitizeName(req.body.store);
    let storeText = sanitizeName(req.body.storeText);

    if ((req.body.categoryName || req.body.subcategoryName || req.body.storeName) && !isAdmin(req.user)) {
      return res.status(403).json({ error: 'Only admins can add categories, subcategories, or stores.' });
    }

    if (req.body.categoryName) {
      const category = await findOrCreateCategory(req.pb, req.body.categoryName);
      categoryId = category.id;
    }
    if (req.body.subcategoryName && categoryId) {
      const subcategory = await findOrCreateSubcategory(req.pb, categoryId, req.body.subcategoryName);
      subcategoryId = subcategory.id;
    }
    if (req.body.storeName) {
      const store = await findOrCreateStore(req.pb, req.body.storeName);
      storeId = store.id;
    }

    if (!categoryId || !subcategoryId || !storeId) {
      return res.status(400).json({ error: 'Category, subcategory, and store are required.' });
    }

    if (await isOtherStore(req.pb, storeId)) {
      if (!storeText) {
        return res.status(400).json({ error: 'Store name is required when store is Other.' });
      }
    } else {
      storeText = '';
    }

    const paymentMethodRecord = await resolvePaymentMethod(req.pb, paymentMethodId);

    const transaction = await createRecord(req.pb, 'oikos_transactions', {
      date: pbDate(date),
      title,
      amount,
      payment_method: paymentMethodRecord?.id || null,
      category: categoryId,
      subcategory: subcategoryId,
      store: storeId,
      storeText,
      user: req.user.id
    });
    if (req.body.categoryName || req.body.subcategoryName || req.body.storeName) {
      invalidateReferenceCache();
    } else {
      invalidateTransactionCache();
    }
    res.status(201).json(transaction);
  } catch (error) {
    handleError(res, error);
  }
});

app.put('/api/transactions/:id', requireAuth, requireApproved, async (req, res) => {
  try {
    const transaction = await req.pb.collection('oikos_transactions').getOne(req.params.id);
    if (!isAdmin(req.user) && transaction.user !== req.user.id) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    const amount = Number(req.body.amount);
    const date = sanitizeName(req.body.date);
    const title = sanitizeName(req.body.title);
    const paymentMethodId = sanitizeName(req.body.paymentMethod);
    if (!date || Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Date and a positive amount are required.' });
    }

    const categoryId = sanitizeName(req.body.category);
    const subcategoryId = sanitizeName(req.body.subcategory);
    const storeId = sanitizeName(req.body.store);
    let storeText = sanitizeName(req.body.storeText);
    if (!categoryId || !subcategoryId || !storeId) {
      return res.status(400).json({ error: 'Category, subcategory, and store are required.' });
    }

    if (await isOtherStore(req.pb, storeId)) {
      if (!storeText) {
        return res.status(400).json({ error: 'Store name is required when store is Other.' });
      }
    } else {
      storeText = '';
    }

    const paymentMethodRecord = await resolvePaymentMethod(req.pb, paymentMethodId);

    const updated = await req.pb.collection('oikos_transactions').update(req.params.id, {
      date: pbDate(date),
      title,
      amount,
      payment_method: paymentMethodRecord?.id || null,
      category: categoryId,
      subcategory: subcategoryId,
      store: storeId,
      storeText,
      user: transaction.user || req.user.id
    });
    invalidateTransactionCache();
    res.json(updated);
  } catch (error) {
    handleError(res, error);
  }
});

app.delete('/api/transactions/:id', requireAuth, requireApproved, async (req, res) => {
  try {
    const transaction = await req.pb.collection('oikos_transactions').getOne(req.params.id);
    if (!isAdmin(req.user) && transaction.user !== req.user.id) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    await req.pb.collection('oikos_transactions').delete(req.params.id);
    invalidateTransactionCache();
    res.status(204).end();
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/summary', requireAuth, requireApproved, async (req, res) => {
  try {
    const scope = cacheScope(req.user);
    sendCached(res, await cached(`summary:${scope}`, async () => {
      const filter = isAdmin(req.user) ? '' : `user = "${req.user.id}"`;
      const [transactions, maps] = await Promise.all([
        listRecords(req.pb, 'oikos_transactions', {
          fields: 'id,date,amount,category,subcategory,store,storeText,payment_method',
          sort: '-date',
          filter: filter || undefined,
          skipTotal: true,
          batch: 1000
        }),
        loadRelationNameMaps(req.pb)
      ]);
      return {
        transactions: transactions.map((transaction) => summaryTransaction(transaction, maps))
      };
    }));
  } catch (error) {
    handleError(res, error);
  }
});

const pageFiles = {
  '/': 'index.html',
  '/me': 'me.html',
  '/verify-email': 'verify-email.html',
  '/categories': 'categories.html',
  '/stores': 'stores.html',
  '/payment-methods': 'payment-methods.html',
  '/users': 'users.html',
  '/transactions': 'transactions.html',
  '/dashboard': 'dashboard.html',
  '/filter': 'filter.html'
};

app.get('/transactions/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'transaction-detail.html'));
});

Object.entries(pageFiles).forEach(([route, file]) => {
  app.get(route, (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', file));
  });
});

app.listen(port, () => {
  console.log(`Oikos app running at http://localhost:${port}`);
  console.log(`Using PocketBase at ${pbUrl}`);
});
