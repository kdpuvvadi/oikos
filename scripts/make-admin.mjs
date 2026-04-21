import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import PocketBase from 'pocketbase';

const pbUrl = (process.env.PB_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
const pb = new PocketBase(pbUrl);

async function superuserAuth(rl) {
  if (process.env.PB_TOKEN) {
    pb.authStore.save(process.env.PB_TOKEN, null);
    return;
  }

  const identity = await rl.question('PocketBase admin email: ');
  const password = await rl.question('PocketBase admin password: ');

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

const rl = readline.createInterface({ input, output });

try {
  await superuserAuth(rl);
  const email = (process.env.ADMIN_USER_EMAIL || await rl.question('User email to make admin: ')).trim().toLowerCase();
  const users = await pb.collection('users').getList(1, 1, {
    filter: `email = "${email.replaceAll('"', '\\"')}"`
  });

  if (!users.items.length) {
    throw new Error(`No user found with email ${email}.`);
  }

  await pb.collection('users').update(users.items[0].id, { kind: 'admin' });
  console.log(`${email} is now an admin.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  rl.close();
}
