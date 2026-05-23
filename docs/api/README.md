# Oikos API

This folder documents the HTTP API exposed by the Oikos Express server in [server.js](/C:/Data/add/code/oikos/server.js).

## Base URL

Local development default:

```text
http://localhost:3000
```

## Authentication

Most endpoints require a logged-in user. Authentication is cookie-based.

- `pb_auth`
  PocketBase auth cookie. `HttpOnly`.
- `oikos_session`
  Lightweight session hint cookie used by the frontend to avoid flashing the login screen before auth verification finishes.

After a successful login or registration, send later requests with the cookies returned by the server.

Auth responses also include the current PocketBase auth token in the JSON body.

`GET /api/auth/me` refreshes the PocketBase auth record before responding, so profile settings changed in Oikos or directly in PocketBase Admin stay in sync with the app.

## Roles

- `user`
  Can read shared reference data and manage only their own transactions.
- `admin`
  Can manage categories, subcategories, stores, payment methods, users, and can view/filter all transactions.

## Error format

Most errors use this shape:

```json
{
  "error": "Human-readable message",
  "details": {},
  "hint": "Optional recovery hint"
}
```

Common status codes:

- `400` validation error
- `401` not authenticated
- `403` admin-only route or action
- `404` missing record or inaccessible transaction
- `409` PocketBase schema mismatch
- `500` unexpected server error
- `503` PocketBase unavailable

## Endpoints

- [Auth](./auth.md)
- [Reference Data](./reference-data.md)
- [Transactions](./transactions.md)
- [Summary and Health](./system.md)
