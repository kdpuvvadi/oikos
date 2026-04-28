# Auth API

## `POST /api/auth/register`

Creates a regular user account, logs the user in immediately, and sets auth cookies.

Request body:

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "Example User"
}
```

Rules:

- `email` is required
- `password` must be at least 8 characters
- new users are created with `kind: "user"`

Success:

- `201 Created`

Response:

```json
{
  "token": "POCKETBASE_AUTH_TOKEN",
  "user": {
    "id": "USER_ID",
    "email": "user@example.com",
    "name": "Example User",
    "kind": "user",
    "isAdmin": false
  }
}
```

## `POST /api/auth/login`

Authenticates an existing user and sets auth cookies.

Request body:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Success:

- `200 OK`

Response:

```json
{
  "token": "POCKETBASE_AUTH_TOKEN",
  "user": {
    "id": "USER_ID",
    "email": "user@example.com",
    "name": "Example User",
    "kind": "user",
    "isAdmin": false
  }
}
```

Failure:

- `401 Unauthorized`

Response:

```json
{
  "error": "Invalid email or password."
}
```

## `POST /api/auth/logout`

Clears the auth cookies.

Success:

- `204 No Content`

## `GET /api/auth/me`

Returns the current logged-in user from the auth cookie.

Success:

- `200 OK`

Response:

```json
{
  "token": "POCKETBASE_AUTH_TOKEN",
  "user": {
    "id": "USER_ID",
    "email": "user@example.com",
    "name": "Example User",
    "kind": "user",
    "isAdmin": false
  }
}
```

Failure:

- `401 Unauthorized`

Response:

```json
{
  "error": "Not logged in."
}
```
