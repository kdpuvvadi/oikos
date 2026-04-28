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
