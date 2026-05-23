# Auth API

## `POST /api/auth/register`

Creates a regular user account and sends a verification email through PocketBase.

New users are created with:

- `emailVisibility: true`
- `kind: "user"`
- `verified: false` until the email confirmation succeeds
- `approved: false` until an admin explicitly approves the account

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
  "requiresVerification": true,
  "email": "user@example.com",
  "message": "Account created. Check your email to verify your address before signing in."
}
```

## `POST /api/auth/login`

Authenticates an existing verified user and sets auth cookies.

If the email is verified but admin approval is still pending, the route still returns auth data so Oikos can show the approval-pending screen, but all business endpoints remain blocked until approval is granted.

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
    "emailVisibility": true,
    "kind": "user",
    "isAdmin": false
  }
}
```

Failure:

- `401 Unauthorized`
- `403 Forbidden` when the account exists but email verification is still pending

Response:

```json
{
  "error": "Please verify your email before signing in.",
  "requiresVerification": true,
  "email": "user@example.com"
}
```

## `POST /api/auth/request-verification`

Resends the verification email for an address.

Request body:

```json
{
  "email": "user@example.com"
}
```

Success:

- `200 OK`

Response:

```json
{
  "ok": true,
  "email": "user@example.com",
  "message": "Verification email sent."
}
```

## `POST /api/auth/verify`

Confirms a verification token from the Oikos verification page.

Request body:

```json
{
  "token": "POCKETBASE_VERIFICATION_TOKEN"
}
```

Success:

- `200 OK`

Response:

```json
{
  "ok": true,
  "message": "Email verified. Your account is now waiting for admin approval."
}
```

## `POST /api/auth/logout`

Clears the auth cookies.

Success:

- `204 No Content`

## `GET /api/auth/me`

Returns the current logged-in user.

Before responding, Oikos refreshes the PocketBase auth record, so fields such as `verified` and `transactionPageSize` reflect the latest server state.

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
    "emailVisibility": true,
    "verified": true,
    "approved": true,
    "kind": "user",
    "isAdmin": false,
    "transactionPageSize": 25
  }
}
```

## `PUT /api/auth/me`

Requires authentication.

Updates the current user's profile-level auth settings.

Currently supported fields:

```json
{
  "emailVisibility": true,
  "transactionPageSize": 25
}
```

Response:

```json
{
  "token": "POCKETBASE_AUTH_TOKEN",
  "user": {
    "id": "USER_ID",
    "email": "user@example.com",
    "name": "Example User",
    "emailVisibility": true,
    "verified": true,
    "approved": true,
    "kind": "user",
    "isAdmin": false,
    "transactionPageSize": 25
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

## `POST /api/auth/request-otp`

Starts an email OTP flow for third-party or API-driven usage.

Request body:

```json
{
  "email": "user@example.com"
}
```

Success:

- `200 OK`

Response:

```json
{
  "ok": true,
  "email": "user@example.com",
  "otpId": "OTP_REQUEST_ID",
  "message": "OTP sent."
}
```

## `POST /api/auth/login-otp`

Completes an OTP login using the `otpId` from `/api/auth/request-otp` and the code delivered by PocketBase email.

Request body:

```json
{
  "otpId": "OTP_REQUEST_ID",
  "otp": "123456"
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
    "emailVisibility": true,
    "verified": true,
    "approved": true,
    "kind": "user",
    "isAdmin": false,
    "transactionPageSize": 25
  },
  "message": "OTP login successful."
}
```
