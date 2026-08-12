# Oikos Bruno API tests

HTTP tests for PocketBase REST + Oikos hooks. Open the `bruno/` folder in [Bruno](https://www.usebruno.com/).

## Environments

| Env | File | Purpose |
|-----|------|---------|
| **qa** | `environments/qa.bru` | QA / staging |
| **local** | `environments/local.bru` | `http://127.0.0.1:8090` |

### Required variables (you provide)

| Variable | Description |
|----------|-------------|
| `baseUrl` | App / PocketBase origin, no trailing slash |
| `userToken` | PocketBase auth token for a verified + approved **user** (`kind=user`) |
| `adminToken` | PocketBase auth token for an **admin** (`kind=admin`) |

Get tokens from a browser session (Network → `auth-with-password` / `auth-refresh` response) or any login call. Use the raw token value (no `Bearer` prefix).

Runtime ids (`userId`, `adminId`, category/transaction ids, etc.) are filled by **02-auth** validate requests and later setup calls.

## Run order

1. **01-system** — health + app-info (no auth)
2. **02-auth** — validate user/admin tokens (refresh + assert roles; sets `userId` / `adminId`)
3. **03-user-scope** — reference reads, own transactions, profile; admin-only denied
4. **04-admin-scope** — users, reference CRUD, all transactions, digest jobs list
5. **05-negative** — unauthenticated / invalid token (empty 200 or 4xx; fails if data leaks)

## Notes

- Auth header: `Authorization: {{userToken}}` or `{{adminToken}}` (PocketBase raw JWT).
- Digest **send** is not exercised (may email); suite checks list access + user forbidden create.
- Registration / email verification are not automated here.
