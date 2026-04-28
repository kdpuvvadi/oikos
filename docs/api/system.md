# System API

## `GET /api/health`

Checks whether the Express server can reach PocketBase.

Success:

- `200 OK`

Response:

```json
{
  "ok": true
}
```

Failure:

- `503 Service Unavailable` if PocketBase is not reachable

## `GET /api/summary`

Requires authentication.

Returns a bulk transaction payload used by the frontend summary-style pages.

Permissions:

- admin gets all transactions
- regular user gets only their own transactions

Response:

```json
{
  "transactions": [
    {
      "id": "TRANSACTION_ID",
      "amount": 2364.99
    }
  ]
}
```

## `GET /api/home-totals`

Requires authentication.

Returns the current-month and previous-month totals directly from the backend so the home page does not need to fetch and sum full transaction lists in the browser.

Permissions:

- admin gets totals across all users
- regular user gets totals only for their own transactions

Response:

```json
{
  "thisMonth": 2364.99,
  "lastMonth": 6516
}
```

## `GET /api/monthly-totals`

Requires authentication.

Returns expense totals grouped by month, keyed as `YYYY-MM`.

Permissions:

- admin gets totals across all users
- regular user gets totals only for their own transactions

Response:

```json
{
  "totals": {
    "2026-03": 6516,
    "2026-04": 2487.99
  }
}
```
