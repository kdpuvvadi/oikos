# Oikos

Lightweight, self-hosted household expense tracker. A **React + Vite** SPA talks to **PocketBase** directly; production serves the built UI from PocketBase’s `pb_public` folder in a single container.

## What’s inside?

- **Expense entry** — date, amount, optional title, category, subcategory, store, payment mode
- **Dashboard & filters** — this month vs last month, category breakdowns, pivot-style row/column filters
- **On-the-fly create** — admins can add categories, subcategories, or stores while logging an expense
- **Paginated history** — per-user page size preference
- **Email verification + admin approval** — new accounts verify email, then wait for approval before using the app
- **Weekly digests** — Monday email of last week’s spending (on by default; opt out under **Me**)
- **Privacy first** — users only see their own transactions; admins (`kind=admin`) manage reference data and can see everyone’s expenses

## Getting started (Docker)

### 1. Start the stack

```bash
cp .env.example .env
docker compose up --build
```

### 2. Open the apps

- **App:** [http://localhost:8090](http://localhost:8090)
- **PocketBase Admin:** [http://localhost:8090/_/](http://localhost:8090/_/)

Change the published port with `APP_PORT` in `.env`. Set `APP_PUBLIC_URL` to the public app URL so verification and digest links point at Oikos (not an internal host).

### 3. Create admin + schema

1. Open PocketBase Admin and create the first superuser.
2. From the **host** (the production image is PocketBase-only — there is no `npm` inside the container):

```bash
PB_URL=http://127.0.0.1:8090 npm run setup:pocketbase
```

The script is idempotent. Re-run it after upgrades so collections and fields stay in sync. With `APP_PUBLIC_URL` set, it also points verification emails at `/verify-email?token={TOKEN}` and enables PocketBase email OTP templates.

Promote an app user to admin:

```bash
PB_URL=http://127.0.0.1:8090 npm run make:admin
```

The **Me** page shows the image build branch (`APP_BUILD_BRANCH`, default `local`).

### ZeptoMail (e.g. Railway)

Outbound SMTP is often blocked. [`pb_hooks/zeptomail.pb.js`](pb_hooks/zeptomail.pb.js) sends PocketBase mail (verification, OTP, reset, weekly digests) through ZeptoMail’s HTTPS API when these are set:

```env
ZEPTO_MAIL_API_KEY=your_zeptomail_api_key
ZEPTO_MAIL_FROM_ADDRESS=noreply@example.com
ZEPTO_MAIL_FROM_NAME=Oikos
```

If the key or from-address is missing, the hook falls through to PocketBase’s configured mailer (`e.next()`).

### Weekly spending digests

[`pb_hooks/weekly-digest.pb.js`](pb_hooks/weekly-digest.pb.js) emails verified, approved (or admin) users who have **not** opted out. Summary covers the previous Mon–Sun (UTC): total spent, count, top categories. Empty weeks still get a zero-spend email.

- Preference field: `weeklyDigestOptOut` (false = send; default on)
- Toggle: **Me → Weekly digest**
- Schedule: `0 8 * * 1` (Monday 08:00 UTC), override with `WEEKLY_DIGEST_CRON`

## Local development (no Docker)

1. Run PocketBase (e.g. `http://127.0.0.1:8090`) and create a superuser.
2. `npm install`
3. Copy `.env.example` → `.env` (`PB_URL`, `VITE_PB_URL`, `APP_PUBLIC_URL`).
4. `npm run setup:pocketbase`
5. `npm run dev` — Vite at [http://localhost:5173](http://localhost:5173) (API via `VITE_PB_URL`)

Production build: `npm run build` (output in `dist/`, copied to `pb_public` in the Docker image).

## Environment

| Variable | Purpose |
|----------|---------|
| `APP_PORT` | Host port mapped to container `8090` (Compose) |
| `PB_URL` | PocketBase URL for setup / make-admin scripts |
| `VITE_PB_URL` | PocketBase URL baked into the Vite app (empty = same-origin in prod) |
| `APP_PUBLIC_URL` | Public app URL for email links |
| `APP_BUILD_BRANCH` | Label shown on Me |
| `ZEPTO_MAIL_*` | ZeptoMail delivery |
| `WEEKLY_DIGEST_CRON` | Optional cron override for digests |
| `PB_TOKEN` | Optional PocketBase admin token for setup (instead of interactive login) |

## Collections

Auth: PocketBase `users` (plus `firstName`, `lastName`, `kind`, `approved`, `weeklyDigestOptOut`, `transactionPageSize`).

Business: `oikos_categories`, `oikos_subcategories`, `oikos_stores`, `oikos_payment_methods`, `oikos_transactions`.

## Docs

- [Application guide](docs/APP.md)
- [Client / PocketBase API](docs/api/README.md)
  - [Auth](docs/api/auth.md)
  - [Transactions](docs/api/transactions.md)
  - [Reference data & users](docs/api/reference-data.md)
  - [Aggregates & app info](docs/api/system.md)
