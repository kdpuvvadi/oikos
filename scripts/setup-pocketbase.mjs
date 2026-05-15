import readline from 'node:readline/promises';
import fs from 'node:fs';
import path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import PocketBase from 'pocketbase';

function loadDotEnv() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) return;

  const contents = fs.readFileSync(envPath, 'utf8');
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

loadDotEnv();

const pbUrl = (process.env.PB_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
const appPublicUrl = String(process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
const pb = new PocketBase(pbUrl);

async function auth() {
  if (process.env.PB_TOKEN) {
    pb.authStore.save(process.env.PB_TOKEN, null);
    return;
  }

  const rl = readline.createInterface({ input, output });
  const identity = await rl.question('PocketBase admin email: ');
  const password = await rl.question('PocketBase admin password: ');
  rl.close();

  for (const collection of ['_superusers', '_admins']) {
    try {
      await pb.collection(collection).authWithPassword(identity, password);
      return;
    } catch {
      // Try the next PocketBase auth route for newer/older versions.
    }
  }

  throw new Error('Could not authenticate. Check your PocketBase admin credentials.');
}

async function collectionByName(name) {
  try {
    return await pb.collections.getOne(name);
  } catch {
    return null;
  }
}

async function createCollection(payload) {
  const existing = await collectionByName(payload.name);
  if (existing) {
    const fields = existing.fields || [];
    const missingFields = payload.fields.filter((field) => !fields.some((existingField) => existingField.name === field.name));
    const desiredByName = new Map(payload.fields.map((field) => [field.name, field]));
    const mergedFields = fields.map((field) => {
      const desired = desiredByName.get(field.name);
      return desired ? { ...field, ...desired } : field;
    });
    const hasChangedFields = mergedFields.some((field, index) => {
      const desired = desiredByName.get(field.name);
      if (!desired) return false;
      return Object.entries(desired).some(([key, value]) => field[key] !== value || fields[index][key] !== value);
    });
    const ruleKeys = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule'];

    let current = existing;
    if (missingFields.length || hasChangedFields) {
      current = await pb.collections.update(existing.id, {
        fields: [...mergedFields, ...missingFields]
      });
      console.log(`Updated fields for collection: ${payload.name}`);
    }

    const removeFields = payload.removeFields || [];
    const currentFields = current.fields || fields;
    const removableFields = currentFields.filter((field) => removeFields.includes(field.name));

    if (removableFields.length) {
      current = await pb.collections.update(current.id, {
        fields: currentFields.filter((field) => !removeFields.includes(field.name))
      });
      console.log(`Removed obsolete fields from collection: ${payload.name}`);
    }

    const changedRules = Object.fromEntries(
      ruleKeys
        .filter((key) => current[key] !== payload[key])
        .map((key) => [key, payload[key]])
    );

    if (Object.keys(changedRules).length) {
      const updated = await pb.collections.update(current.id, changedRules);
      console.log(`Updated collection: ${payload.name}`);
      return updated;
    }

    console.log(`Collection already exists: ${payload.name}`);
    return existing;
  }
  const created = await pb.collections.create(payload);
  console.log(`Created collection: ${payload.name}`);
  return created;
}

async function ensureAppSettings() {
  if (!appPublicUrl) {
    console.log('APP_PUBLIC_URL not set. Skipping PocketBase public app URL/email template updates.');
    return;
  }

  const settings = await pb.settings.getAll();
  const meta = settings.meta || {};
  const nextMeta = {
    ...meta,
    appName: meta.appName || 'Oikos',
    appUrl: appPublicUrl,
    appURL: appPublicUrl
  };

  if (meta.appUrl !== appPublicUrl || meta.appURL !== appPublicUrl || meta.appName !== nextMeta.appName) {
    await pb.settings.update({ meta: nextMeta });
    console.log(`Updated PocketBase app URL to: ${appPublicUrl}`);
  }
}

async function ensureVerificationTemplate(collection) {
  if (!appPublicUrl || !collection?.id) return;

  const actionUrl = `${appPublicUrl}/verify-email?token={TOKEN}`;
  const subject = 'Verify your {APP_NAME} email';
  const body = [
    '<p>Hello,</p>',
    '<p>Confirm your email address for <strong>{APP_NAME}</strong> by clicking the button below:</p>',
    `<p><a href="${actionUrl}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#2e7d4f;color:#ffffff;text-decoration:none;font-weight:700;">Verify email</a></p>`,
    '<p>If the button does not work, use this direct link:</p>',
    `<p><a href="${actionUrl}">${actionUrl}</a></p>`
  ].join('');
  const currentTemplate = collection.verificationTemplate || {};
  if (currentTemplate.actionUrl === actionUrl && currentTemplate.subject === subject && currentTemplate.body === body) return;

  await pb.collections.update(collection.id, {
    verificationTemplate: {
      ...currentTemplate,
      subject,
      body,
      actionUrl
    }
  });
  console.log(`Updated verification email action URL for ${collection.name}.`);
}

async function ensureOtpConfig(collection) {
  if (!collection?.id) return;

  const currentOtp = collection.otp || {};
  const emailTemplate = currentOtp.emailTemplate || {};
  const desired = {
    ...currentOtp,
    enabled: true,
    duration: currentOtp.duration || 180,
    length: currentOtp.length || 6,
    emailTemplate: {
      ...emailTemplate,
      subject: 'Your {APP_NAME} sign-in code',
      body: [
        '<p>Hello,</p>',
        '<p>Use the one-time code below to sign in to <strong>{APP_NAME}</strong>:</p>',
        '<p style="font-size:28px;font-weight:800;letter-spacing:0.18em;margin:16px 0;">{OTP}</p>',
        '<p>If you did not request this code, you can ignore this email.</p>'
      ].join('')
    }
  };

  const otpChanged = JSON.stringify({
    enabled: currentOtp.enabled,
    duration: currentOtp.duration,
    length: currentOtp.length,
    emailTemplate
  }) !== JSON.stringify({
    enabled: desired.enabled,
    duration: desired.duration,
    length: desired.length,
    emailTemplate: desired.emailTemplate
  });

  if (!otpChanged) return;

  await pb.collections.update(collection.id, {
    otp: desired
  });
  console.log(`Enabled OTP login for ${collection.name}.`);
}

async function seedRecord(collection, body) {
  const escaped = body.name.replaceAll('"', '\\"');
  const list = await pb.collection(collection).getList(1, 1, {
    filter: `name = "${escaped}"`
  });
  if (list.items?.length) return list.items[0];
  return pb.collection(collection).create(body);
}

const textField = (name, required = true) => ({ name, type: 'text', required, min: 0, max: 120, pattern: '' });
const numberField = (name) => ({ name, type: 'number', required: true, min: 0, max: 1000000000000, noDecimal: false });
const optionalWholeNumberField = (name, min = 1, max = 1000) => ({ name, type: 'number', required: false, min, max, noDecimal: true });
const boolField = (name, required = false) => ({ name, type: 'bool', required });
const dateField = (name) => ({ name, type: 'date', required: true, min: '', max: '' });
const relationField = (name, collectionId, cascadeDelete = false, required = true) => ({
  name,
  type: 'relation',
  required,
  collectionId,
  cascadeDelete,
  minSelect: 0,
  maxSelect: 1
});

async function main() {
  await auth();
  await ensureAppSettings();
  const users = await createCollection({
    name: 'users',
    type: 'auth',
    system: false,
    listRule: 'id = @request.auth.id || @request.auth.kind = "admin"',
    viewRule: 'id = @request.auth.id || @request.auth.kind = "admin"',
    createRule: '',
    updateRule: 'id = @request.auth.id || @request.auth.kind = "admin"',
    deleteRule: '@request.auth.kind = "admin"',
    fields: [
      textField('kind', false),
      boolField('approved', false),
      optionalWholeNumberField('transactionPageSize', 10, 100)
    ]
  });
  if (!users?.id) {
    throw new Error('The default PocketBase users collection was not found.');
  }
  await ensureVerificationTemplate(users);
  await ensureOtpConfig(users);

  const authRule = '@request.auth.id != ""';
  const adminRule = '@request.auth.kind = "admin"';
  const ownOrAdminTransactionRule = '@request.auth.kind = "admin" || user = @request.auth.id';
  const ownCreateTransactionRule = '@request.auth.id != "" && user = @request.auth.id';

  const categories = await createCollection({
    name: 'oikos_categories',
    type: 'base',
    system: false,
    listRule: authRule,
    viewRule: authRule,
    createRule: adminRule,
    updateRule: adminRule,
    deleteRule: adminRule,
    fields: [textField('name')]
  });

  const subcategories = await createCollection({
    name: 'oikos_subcategories',
    type: 'base',
    system: false,
    listRule: authRule,
    viewRule: authRule,
    createRule: adminRule,
    updateRule: adminRule,
    deleteRule: adminRule,
    fields: [
      textField('name'),
      relationField('category', categories.id, true)
    ]
  });

  const stores = await createCollection({
    name: 'oikos_stores',
    type: 'base',
    system: false,
    listRule: authRule,
    viewRule: authRule,
    createRule: adminRule,
    updateRule: adminRule,
    deleteRule: adminRule,
    fields: [textField('name')]
  });

  const paymentMethods = await createCollection({
    name: 'oikos_payment_methods',
    type: 'base',
    system: false,
    listRule: authRule,
    viewRule: authRule,
    createRule: adminRule,
    updateRule: adminRule,
    deleteRule: adminRule,
    fields: [textField('name')]
  });

  await createCollection({
    name: 'oikos_transactions',
    type: 'base',
    system: false,
    listRule: ownOrAdminTransactionRule,
    viewRule: ownOrAdminTransactionRule,
    createRule: ownCreateTransactionRule,
    updateRule: ownOrAdminTransactionRule,
    deleteRule: ownOrAdminTransactionRule,
    removeFields: ['paymentMethod'],
    fields: [
      dateField('date'),
      textField('title', false),
      numberField('amount'),
      relationField('payment_method', paymentMethods.id, false, false),
      relationField('category', categories.id),
      relationField('subcategory', subcategories.id),
      relationField('store', stores.id),
      textField('storeText', false),
      relationField('user', users.id, false, false)
    ]
  });

  const seeds = {
    Food: ['Takeout', 'Restaurant', 'Snacks'],
    Entertainment: ['Movies', 'Concerts', 'Gaming'],
    Groceries: ['Produce', 'Meat', 'Beverages', 'Household Supplies', 'Staples', 'Frozen Foods', 'Bakery', 'Canned Goods', 'Deli', 'Seafood', 'Organic', 'International'],
    Transport: ['Fuel', 'Taxi', 'Public transport', 'Travel', 'Vehicle Maintenance', 'Parking', 'Tolls'],
    Bills: ['Electricity', 'Internet', 'Mobile', 'Rent', 'Utilities', 'Subscriptions'],
    Shopping: ['Clothing', 'Home', 'Personal care'],
    Health: ['Medicine', 'Doctor', 'Fitness', 'Diagnostic', 'Insurance', 'Supplements', 'Therapy'],
    Education: ['Books', 'Courses', 'Supplies'],
    Miscellaneous: ['Gifts', 'Donations', 'Other'],
    Hobbies: ['Sports', 'Music', 'Art', 'Crafts', 'Collectibles'],
    Kitchen: ['Diningware', 'Cookware', 'Utensils'],
    Baby: ['Clothing', 'Toys', 'Food', 'Care Products', 'Medical', 'Suppplies'],
    Dairy: ['Milk', 'Cheese', 'Yogurt', 'Butter', 'Paneer', 'Cream', 'Ghee', 'Lassi'],
    Home: ['Furniture', 'Large Appliances', 'Decor', 'Maintenance', 'Garden', 'Cleaning', 'Security', 'Small Appliances', 'Repairs'],
  };

  for (const [categoryName, subcategoryNames] of Object.entries(seeds)) {
    const category = await seedRecord('oikos_categories', { name: categoryName });
    for (const subcategoryName of subcategoryNames) {
      await seedRecord('oikos_subcategories', { name: subcategoryName, category: category.id });
    }
  }

  for (const storeName of ['General Store', 'Local Market', 'Amazon', 'Flipkart', 'Zepto', 'BigBasket', 'Ratnadeep', 'Vijetha', 'Restaurant', 'Petrol Pump', 'Pharmacy', 'Clothing Store', 'Blinkit', 'Swiggy', 'Zomato', 'Uber', 'Ola', 'Public Transport', 'JioMart', 'Dmart', 'Sid\'s','Heritage', 'Ikea', 'Cred', 'other']) {
    await seedRecord('oikos_stores', { name: storeName });
  }

  for (const paymentMethodName of ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'Internet Banking', 'Wallet', 'Other']) {
    await seedRecord('oikos_payment_methods', { name: paymentMethodName });
  }

  console.log('PocketBase setup complete.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
