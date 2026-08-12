# Oikos client / PocketBase API

Oikos has **no Express HTTP API**. The React app uses the PocketBase JS SDK through helpers in [`src/lib/api.js`](../../src/lib/api.js).

You can also call PocketBase’s own REST API (`/api/collections/...`, `/api/collections/users/auth-with-password`, etc.) with a valid auth token. This folder documents the **app’s client helpers** and the auth / data conventions they enforce.

## Base URL

| Environment | API host |
|-------------|----------|
| Production (Docker image) | Same origin as the SPA (empty `VITE_PB_URL`) |
| Local Vite | `VITE_PB_URL` (default `http://127.0.0.1:8090`) |
| Setup scripts | `PB_URL` |

PocketBase Admin and health: `{PB_URL}/_/` and `{PB_URL}/api/health`.

## Authentication

- Auth lives in the PocketBase auth store (SDK), not an HttpOnly `pb_auth` cookie from Express.
- A lightweight `oikos_session=1` cookie is set only as a UI session hint.
- Helpers throw `Error` objects with optional `.status` and `.data` (see `pbError`).
- `401` responses can trigger the unauthorized handler (`setUnauthorizedHandler`) to clear the session.

### Roles

| Role | How | Capabilities |
|------|-----|----------------|
| User | `kind` ≠ `admin`, `approved` + `verified` | Own transactions; read reference data |
| Admin | `kind === 'admin'` | All of the above + CRUD reference data, list users, see all transactions |

`isApprovedUser(user)`: admins always; others need `verified && approved`.

## Error shape

Client helpers surface:

```js
err.message  // human-readable
err.status   // HTTP-ish status when available
err.data     // PocketBase / custom payload (e.g. requiresVerification)
err.isAbort  // request aborted
```

## Modules

- [Auth](./auth.md) — register, login, verify, profile
- [Transactions](./transactions.md) — CRUD + list filters
- [Reference data & users](./reference-data.md) — categories, stores, payment methods, approvals
- [Aggregates & app info](./system.md) — home totals, summary, version

Admin weekly digest preview is client-side; send uses `POST /api/collections/oikos_digest_jobs/records`.

Bruno API collection: [`bruno/`](../../bruno/) (QA/local envs — set `baseUrl` + user/admin credentials).
