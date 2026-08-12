# Aggregates & app info

These are **client-side** helpers over PocketBase data (not legacy Express `/api/summary` routes).

## Home totals — `fetchHomeTotals()`

Loads the current user’s (or all, if admin) transaction `date` + `amount` for last month start through this month end, then returns:

```js
{ thisMonth: number, lastMonth: number }
```

Used on the home / expense entry page KPIs.

## Summary — `fetchSummary()`

Fetches the full scoped transaction list with expansions suitable for dashboard and filter pages. Monthly / category aggregation is done in the UI (`src/lib/charts.js`, dashboard / filter pages).

## App info — `GET /api/app-info`

Public PocketBase route (`pb_hooks/app-info.pb.js`). Also available as client helper `getAppInfo()`.

```http
GET /api/app-info
```

```json
{
  "version": "0.6.3",
  "branch": "release",
  "pocketbase": "0.39.7"
}
```

- `version` — `APP_VERSION`, else `pb_public/manifest.json` / `package.json`
- `branch` — `APP_BUILD_BRANCH` (defaults to `unknown`)
- `pocketbase` — from `pocketbase --version`

## Health

Compose healthcheck hits PocketBase:

```http
GET /api/health
```

There is no separate Oikos Express health endpoint.

## Weekly digests

Not a client API. See [`pb_hooks/weekly-digest.pb.js`](../../pb_hooks/weekly-digest.pb.js) and [APP.md — Hooks & email](../APP.md#hooks--email). Preference is updated via `updateProfile({ weeklyDigest })` ([auth](./auth.md)).
