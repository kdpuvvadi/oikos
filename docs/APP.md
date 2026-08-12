# Oikos — Application guide

**Oikos** is a lightweight, self-hosted expense tracker: a React SPA backed by PocketBase. Data stays on your server; regular users only see their own transactions.

---

## Table of contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Getting started](#getting-started)
5. [Database schema](#database-schema)
6. [Frontend](#frontend)
7. [Hooks & email](#hooks--email)
8. [Development](#development)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

---

## Overview

- **Privacy** — data on your PocketBase instance
- **Simplicity** — log spending, review dashboards and filters
- **Self-hosted** — one Docker image serves UI + API + hooks
- **Roles** — users own their expenses; admins manage shared reference data and can view all transactions

### Tech stack

| Layer | Technology |
|-------|------------|
| UI | React 19, Vite 8, React Router, Tailwind CSS 4, shadcn/ui |
| Data | PocketBase (JS SDK `pocketbase`) |
| Auth | PocketBase auth store (browser); session hint cookie `oikos_session` |
| Email | PocketBase mailer → optional ZeptoMail HTTPS hook |
| Jobs | PocketBase JSVM cron (`pb_hooks/`) |
| Deploy | Single Docker image (`Dockerfile`) + Compose |

There is **no Express server**. The browser talks to PocketBase directly via [`src/lib/api.js`](../src/lib/api.js).

---

## Features

### Expense entry & history

- Date, amount, optional title, category, subcategory, store, payment method
- Admins can create categories / subcategories / stores from the form
- “Other” store can require a free-text `storeText` label
- Paginated transaction list; page size saved on the user (`transactionPageSize`)
- Transaction detail page for edit / delete
- Mobile-friendly activity-style grouping by day

### Dashboard & filters

- Home KPIs: this month vs last month
- Dashboard charts and category breakdowns
- Filter page with pivot-style row/column dimensions

### Reference data (admin)

- Categories (list + detail with subcategories)
- Stores and payment methods
- Delete-with-replacement when records are still used by transactions
- Users list: approve accounts, resend verification email

### Auth & access

1. **Register** — creates user with `approved: false`, sends verification email
2. **Verify** — link opens `/verify-email?token=…` (spent tokens treated as already verified for UX)
3. **Sign in** — requires `verified === true`; otherwise user is sent to verify-email
4. **Admin approval** — verified but not approved users see an approval-pending screen; main app unlocks when `kind === 'admin'` or `approved && verified`

### Preferences (Me)

- Name, email, email visibility
- Transaction page size
- **Weekly digest** — on by default; opt out with the switch (`weeklyDigestOptOut`)

### Themes

Light/dark theme toggle on auth and app shells (`data-theme` / `.dark`).

---

## Architecture

```text
Browser (React SPA)
    │  PocketBase JS SDK
    ▼
PocketBase (:8090)
    ├── REST / realtime / auth
    ├── pb_public/     ← Vite build (production)
    ├── pb_hooks/      ← ZeptoMail + weekly digest
    └── pb_data/       ← SQLite + uploads
```

### Auth session

- Real auth: PocketBase token in the SDK auth store
- `oikos_session=1` cookie + `has-session` / body classes: UI chrome hints only
- Unverified sessions are cleared on login / `getCurrentUser`
- App shell (`showApp`) requires `user && isApprovedUser(user)`  
  (`isApprovedUser`: admins always; others need `verified && approved`)

### SPA routes

| Path | Notes |
|------|--------|
| `/` | Home / expense entry (auth page when logged out) |
| `/verify-email` | Token confirm or “check inbox” + resend |
| `/me` | Profile & preferences |
| `/transactions`, `/transactions/:id` | History & detail |
| `/dashboard`, `/filter` | Analytics |
| `/categories`, `/categories/:id` | Admin |
| `/stores`, `/payment-methods`, `/users` | Admin |

`/verify-email` is rendered outside the main approved-app shell (`App.jsx`).

### Data flow

Client helpers in `src/lib/api.js` call PocketBase collections. Aggregates such as home totals and dashboard summaries are computed in the client from filtered transaction lists (not separate Express routes).

---

## Getting started

### Docker

```bash
cp .env.example .env
docker compose up --build
```

- App: `http://localhost:8090`
- Admin UI: `http://localhost:8090/_/`

Create a PocketBase superuser, then from the host:

```bash
PB_URL=http://127.0.0.1:8090 npm run setup:pocketbase
PB_URL=http://127.0.0.1:8090 npm run make:admin
```

### Local Vite + PocketBase

1. Start PocketBase with data dir / hooks as needed  
2. `npm install` && configure `.env`  
3. `npm run setup:pocketbase`  
4. `npm run dev` → `http://localhost:5173`

### Environment variables

See [`.env.example`](../.env.example) and the [README](../README.md#environment).

---

## Database schema

Managed by [`scripts/setup-pocketbase.mjs`](../scripts/setup-pocketbase.mjs) (idempotent).

### `users` (auth)

| Field | Type | Notes |
|-------|------|--------|
| `email`, `password`, `verified`, `emailVisibility`, `name` | built-in | |
| `firstName`, `lastName` | text | |
| `kind` | text | `"user"` or `"admin"` (only admins can change; signup locked to `user`) |
| `approved` | bool | Required for non-admin app access; users cannot self-set |
| `weeklyDigestOptOut` | bool | `false` = receive weekly digests (default) |
| `transactionPageSize` | number | 10 / 25 / 50 / 100 |

Obsolete field `weeklyDigest` is removed by setup if present.

### `oikos_categories`

| Field | Type |
|-------|------|
| `name` | text |

### `oikos_subcategories`

| Field | Type |
|-------|------|
| `name` | text |
| `category` | relation → categories |

### `oikos_stores` / `oikos_payment_methods`

| Field | Type |
|-------|------|
| `name` | text |

### `oikos_transactions`

| Field | Type | Notes |
|-------|------|--------|
| `date` | date | |
| `title` | text | optional |
| `amount` | number | |
| `payment_method` | relation | optional |
| `category`, `subcategory`, `store` | relation | required |
| `storeText` | text | when store is “other” |
| `user` | relation → users | owner |

Indexes include `(user)`, `(date)`, `(user, date)`.

### Access rules (summary)

- Reference collections: authenticated + (`kind = admin` OR `approved = true`)
- Transactions: owner if approved user; admins can access all
- Creating categories/stores/payment methods: admin only (API helpers enforce the same)

Setup also seeds common categories, stores, and payment methods.

---

## Frontend

| Area | Location |
|------|----------|
| Pages | `src/pages/` |
| Auth / data contexts | `src/context/` |
| PocketBase client API | `src/lib/api.js` |
| Charts / money helpers | `src/lib/charts.js`, `src/lib/format.js` |
| UI primitives | `src/components/ui/` |
| Theme | `ThemeToggle`, tokens in `src/index.css` |

---

## Hooks & email

### ZeptoMail — `pb_hooks/zeptomail.pb.js`

`onMailerSend`: if `ZEPTO_MAIL_API_KEY` and `ZEPTO_MAIL_FROM_ADDRESS` are set, POST to ZeptoMail; otherwise `e.next()` (SMTP/sendmail).

### Weekly digest — `pb_hooks/weekly-digest.pb.js`

- Cron job id: `oikos-weekly-digest`
- Default expression: `0 8 * * 1` (override with `WEEKLY_DIGEST_CRON`)
- Recipients: `verified = true && weeklyDigestOptOut = false && (approved = true || kind = "admin")`
- Content: previous UTC Mon–Sun totals + top categories; empty weeks still emailed
- Delivery: `$app.newMailClient().send` (goes through Zepto hook when configured)

---

## Development

```bash
npm run dev                 # Vite
npm run build               # dist/
npm run preview             # preview build
npm run setup:pocketbase    # schema + seeds + mail templates
npm run make:admin          # promote user to kind=admin, approved
npm run check               # syntax-check scripts
```

---

## Deployment

1. Build/push the image from [`Dockerfile`](../Dockerfile) (Vite → `pb_public`, copy `pb_hooks`).
2. Run with Compose or your host; mount `pb_data` for persistence.
3. Set `APP_PUBLIC_URL` and Zepto (or SMTP) env vars.
4. Run `setup:pocketbase` against the public/admin URL from a machine with Node.
5. Healthcheck: `GET /api/health` on PocketBase.

Compose publishes `${APP_PORT:-8090}:8090` and passes `APP_PUBLIC_URL`, Zepto vars, and `WEEKLY_DIGEST_CRON`.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Verification links hit wrong host | `APP_PUBLIC_URL` + re-run setup |
| No emails | Zepto env vars, or PocketBase mail settings when Zepto unset |
| Stuck on “verify email” after confirming | Sign in; token refresh treats spent tokens as success on `/verify-email` |
| Sees approval screen but isn’t verified | Should not happen; login clears unverified sessions. Approval UI only if `verified && !approved` |
| No weekly digests | User opted out; not verified/approved; cron/logs; mail config |
| Schema errors after upgrade | `npm run setup:pocketbase` |
| Vite can’t reach PB | `VITE_PB_URL` in `.env` for local dev |
