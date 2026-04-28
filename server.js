import express from 'express';
import PocketBase from 'pocketbase';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);
const pbUrl = (process.env.PB_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
const pbToken = process.env.PB_TOKEN || '';
const pb = new PocketBase(pbUrl);
const authCookieName = 'pb_auth';
const authHintCookieName = 'oikos_session';

if (pbToken) {
  pb.authStore.save(pbToken, null);
}

app.use(express.json());
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

function clearAuthCookies() {
  return [
    `${authCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    `${authHintCookieName}=; Path=/; SameSite=Lax; Max-Age=0`
  ];
}

function clientFromRequest(req) {
  const client = new PocketBase(pbUrl);
  client.authStore.loadFromCookie(req.headers.cookie || '', authCookieName);
  return client;
}

function publicUser(record) {
  if (!record) return null;
  return {
    id: record.id,
    email: record.email,
    name: record.name || record.email,
    kind: record.kind || 'user',
    isAdmin: record.kind === 'admin'
  };
}

function isAdmin(record) {
  return record?.kind === 'admin';
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

function sanitizeName(value) {
  return String(value || '').trim();
}

function pbDate(value) {
  return `${value} 00:00:00.000Z`;
}

function monthBoundary(year, monthIndex) {
  return `${new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10)} 00:00:00.000Z`;
}

async function listRecords(client, collection, params) {
  return client.collection(collection).getFullList({
    ...Object.fromEntries(Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== ''))
  });
}

async function createRecord(client, collection, body) {
  return client.collection(collection).create(body);
}

async function findByName(client, collection, name, extraFilter = '') {
  const normalized = sanitizeName(name);
  if (!normalized) return null;
  const escaped = normalized.replaceAll('"', '\\"');
  const filter = [`name = "${escaped}"`, extraFilter].filter(Boolean).join(' && ');
  const matches = await listRecords(client, collection, { filter, perPage: '1' });
  return matches[0] || null;
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

function handleError(res, error) {
  console.error(error);
  const requestUrl = error.url || error.originalError?.url || error.cause?.url || '';
  const connectionRefused = error.cause?.code === 'ECONNREFUSED' || error.originalError?.cause?.code === 'ECONNREFUSED';
  if (connectionRefused) {
    return res.status(503).json({
      error: 'PocketBase is not running.',
      details: error.message,
      hint: 'Start PocketBase service. Service not avaiable at http://127.0.0.1:8090'
    });
  }
  if (error.status === 400 && requestUrl.includes('oikos_transactions') && requestUrl.includes('user')) {
    return res.status(409).json({
      error: 'PocketBase needs the latest Oikos expenses schema.',
      hint: 'Run: docker compose exec app npm run setup:pocketbase'
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
    res.json({ ok: true, pocketbase: pbUrl });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const email = sanitizeName(req.body.email).toLowerCase();
    const password = String(req.body.password || '');
    const name = sanitizeName(req.body.name);
    if (!email || password.length < 8) {
      return res.status(400).json({ error: 'Email and an 8 character password are required.' });
    }

    const client = new PocketBase(pbUrl);
    await client.collection('users').create({
      email,
      name,
      kind: 'user',
      password,
      passwordConfirm: password
    });
    await client.collection('users').authWithPassword(email, password);
    res.setHeader('Set-Cookie', [authCookie(client), authHintCookie()]);
    res.status(201).json({ user: publicUser(client.authStore.record) });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = sanitizeName(req.body.email).toLowerCase();
    const password = String(req.body.password || '');
    const client = new PocketBase(pbUrl);
    await client.collection('users').authWithPassword(email, password);
    res.setHeader('Set-Cookie', [authCookie(client), authHintCookie()]);
    res.json({ user: publicUser(client.authStore.record) });
  } catch {
    res.status(401).json({ error: 'Invalid email or password.' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', clearAuthCookies());
  res.status(204).end();
});

app.get('/api/auth/me', (req, res) => {
  const client = clientFromRequest(req);
  if (!client.authStore.isValid || !client.authStore.record?.id) {
    res.setHeader('Set-Cookie', clearAuthCookies());
    return res.status(401).json({ error: 'Not logged in.' });
  }
  res.json({ user: publicUser(client.authStore.record) });
});

app.get('/api/categories', requireAuth, async (req, res) => {
  try {
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

    res.json(categories.map((category) => ({
      ...category,
      subcategories: subcategoriesByCategory[category.id] || []
    })));
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/categories', requireAuth, requireAdmin, async (req, res) => {
  try {
    const name = sanitizeName(req.body.name);
    if (!name) return res.status(400).json({ error: 'Category name is required.' });

    const category = await findOrCreateCategory(req.pb, name);
    const subcategory = await findOrCreateSubcategory(req.pb, category.id, req.body.subcategoryName);
    res.status(201).json({ category, subcategory });
  } catch (error) {
    handleError(res, error);
  }
});

app.put('/api/categories/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const name = sanitizeName(req.body.name);
    if (!name) return res.status(400).json({ error: 'Category name is required.' });
    res.json(await req.pb.collection('oikos_categories').update(req.params.id, { name }));
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/subcategories', requireAuth, requireAdmin, async (req, res) => {
  try {
    const name = sanitizeName(req.body.name);
    const category = sanitizeName(req.body.category);
    if (!name || !category) return res.status(400).json({ error: 'Category and subcategory are required.' });
    const subcategory = await findOrCreateSubcategory(req.pb, category, name);
    res.status(201).json(subcategory);
  } catch (error) {
    handleError(res, error);
  }
});

app.put('/api/subcategories/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const name = sanitizeName(req.body.name);
    if (!name) return res.status(400).json({ error: 'Subcategory name is required.' });
    res.json(await req.pb.collection('oikos_subcategories').update(req.params.id, { name }));
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/stores', requireAuth, async (req, res) => {
  try {
    res.json(await listRecords(req.pb, 'oikos_stores', { sort: 'name' }));
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/stores', requireAuth, requireAdmin, async (req, res) => {
  try {
    const name = sanitizeName(req.body.name);
    if (!name) return res.status(400).json({ error: 'Store name is required.' });
    res.status(201).json(await findOrCreateStore(req.pb, name));
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/payment-methods', requireAuth, async (req, res) => {
  try {
    res.json(await listRecords(req.pb, 'oikos_payment_methods', { sort: 'name' }));
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/payment-methods', requireAuth, requireAdmin, async (req, res) => {
  try {
    const name = sanitizeName(req.body.name);
    if (!name) return res.status(400).json({ error: 'Payment method name is required.' });
    res.status(201).json(await findOrCreatePaymentMethod(req.pb, name));
  } catch (error) {
    handleError(res, error);
  }
});

app.put('/api/payment-methods/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const name = sanitizeName(req.body.name);
    if (!name) return res.status(400).json({ error: 'Payment method name is required.' });
    res.json(await req.pb.collection('oikos_payment_methods').update(req.params.id, { name }));
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/transactions', requireAuth, async (req, res) => {
  try {
    const filters = isAdmin(req.user) ? [] : [`user = "${req.user.id}"`];
    if (req.query.month) {
      const [year, month] = String(req.query.month).split('-').map(Number);
      filters.push(`date >= "${monthBoundary(year, month - 1)}"`);
      filters.push(`date < "${monthBoundary(year, month)}"`);
    }
    if (req.query.category) filters.push(`category = "${req.query.category}"`);
    if (req.query.store) filters.push(`store = "${req.query.store}"`);

    const transactions = await listRecords(req.pb, 'oikos_transactions', {
      sort: '-date',
      expand: 'category,subcategory,store,user,payment_method',
      filter: filters.join(' && ')
    });
    res.json(transactions);
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/transactions', requireAuth, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const date = sanitizeName(req.body.date);
    const paymentMethodId = sanitizeName(req.body.paymentMethod);
    if (!date || Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Date and a positive amount are required.' });
    }

    let categoryId = sanitizeName(req.body.category);
    let subcategoryId = sanitizeName(req.body.subcategory);
    let storeId = sanitizeName(req.body.store);

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

    let paymentMethod = '';
    const paymentMethodRecord = await resolvePaymentMethod(req.pb, paymentMethodId);
    if (paymentMethodRecord) {
      paymentMethod = paymentMethodRecord.name || '';
    }

    const transaction = await createRecord(req.pb, 'oikos_transactions', {
      date: pbDate(date),
      amount,
      paymentMethod,
      payment_method: paymentMethodRecord?.id || null,
      category: categoryId,
      subcategory: subcategoryId,
      store: storeId,
      user: req.user.id
    });
    res.status(201).json(transaction);
  } catch (error) {
    handleError(res, error);
  }
});

app.put('/api/transactions/:id', requireAuth, async (req, res) => {
  try {
    const transaction = await req.pb.collection('oikos_transactions').getOne(req.params.id);
    if (!isAdmin(req.user) && transaction.user !== req.user.id) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    const amount = Number(req.body.amount);
    const date = sanitizeName(req.body.date);
    const paymentMethodId = sanitizeName(req.body.paymentMethod);
    if (!date || Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Date and a positive amount are required.' });
    }

    const categoryId = sanitizeName(req.body.category);
    const subcategoryId = sanitizeName(req.body.subcategory);
    const storeId = sanitizeName(req.body.store);
    if (!categoryId || !subcategoryId || !storeId) {
      return res.status(400).json({ error: 'Category, subcategory, and store are required.' });
    }

    let paymentMethod = '';
    const paymentMethodRecord = await resolvePaymentMethod(req.pb, paymentMethodId);
    if (paymentMethodRecord) {
      paymentMethod = paymentMethodRecord.name || '';
    }

    const updated = await req.pb.collection('oikos_transactions').update(req.params.id, {
      date: pbDate(date),
      amount,
      paymentMethod,
      payment_method: paymentMethodRecord?.id || null,
      category: categoryId,
      subcategory: subcategoryId,
      store: storeId,
      user: transaction.user || req.user.id
    });
    res.json(updated);
  } catch (error) {
    handleError(res, error);
  }
});

app.delete('/api/transactions/:id', requireAuth, async (req, res) => {
  try {
    const transaction = await req.pb.collection('oikos_transactions').getOne(req.params.id);
    if (!isAdmin(req.user) && transaction.user !== req.user.id) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    await req.pb.collection('oikos_transactions').delete(req.params.id);
    res.status(204).end();
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/summary', requireAuth, async (req, res) => {
  try {
    const filter = isAdmin(req.user) ? '' : `user = "${req.user.id}"`;
    const transactions = await listRecords(req.pb, 'oikos_transactions', {
      sort: '-date',
      expand: 'category,subcategory,store,user,payment_method',
      filter
    });
    res.json({ transactions });
  } catch (error) {
    handleError(res, error);
  }
});

const pageFiles = {
  '/': 'index.html',
  '/categories': 'categories.html',
  '/stores': 'stores.html',
  '/payment-methods': 'payment-methods.html',
  '/transactions': 'transactions.html',
  '/dashboard': 'dashboard.html',
  '/filter': 'filter.html'
};

app.get(Object.keys(pageFiles), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', pageFiles[req.path]));
});

app.listen(port, () => {
  console.log(`Oikos app running at http://localhost:${port}`);
  console.log(`Using PocketBase at ${pbUrl}`);
});
