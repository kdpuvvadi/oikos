# Auth

Helpers: `register`, `login`, `logout`, `getCurrentUser`, `updateProfile`, `requestVerification`, `verifyEmail`, `isVerificationTokenSpent`, `publicUser`.

SPA pages: auth card on `/` when logged out; `/verify-email` for confirmation and resend.

## Registration — `register({ email, password, firstName, lastName })`

Creates a PocketBase user with:

- `kind: 'user'`
- `approved: false`
- `emailVisibility: true`
- `weeklyDigestOptOut` unset → **false** (digests on by default)

Then calls `requestVerification`. Does **not** leave the user signed in.

Returns:

```js
{
  requiresVerification: true,
  email: 'user@example.com',
  message: 'Account created. Check your email to verify…'
}
```

The SPA navigates to `/verify-email?email=…`.

## Login — `login({ email, password })`

Uses `authWithPassword`. If `verified !== true`, clears the auth store and throws with:

```js
error.data = { requiresVerification: true, email }
```

On success:

```js
{
  user: publicUser(record),
  approvalPending: !(admin || approved)
}
```

Approval-pending users remain in the auth store so the UI can show the waiting screen; business collection rules still require approval (or admin).

## Current user — `getCurrentUser()`

Requires a valid auth store. Clears the store and fails if `verified !== true`. May `authRefresh` when the token is near expiry.

## Logout — `logout()`

Clears the PocketBase auth store.

## Verify email — `verifyEmail(token)`

Calls `confirmVerification(token)`.

`/verify-email`:

- With `?token=` / `?verificationToken=` — confirms, toasts, redirects to `/`
- Spent/invalid tokens that look expired are treated as already verified (`isVerificationTokenSpent`) so refresh after success still lands on sign-in
- Without token — “check inbox” UI + resend via `requestVerification`

## Resend — `requestVerification(email)`

PocketBase `users.requestVerification`.

Admins can also use `adminResendVerification(userId)` (see [reference-data](./reference-data.md)).

## Profile — `updateProfile(updates)`

Authenticated user update. Supported fields:

| Input | Stored |
|-------|--------|
| `firstName`, `lastName` | + derived `name` |
| `email` | may require re-verification |
| `emailVisibility` | bool |
| `transactionPageSize` | 10 / 25 / 50 / 100 |
| `weeklyDigest` | UI “enabled”; stored as `weeklyDigestOptOut = !weeklyDigest` |

Returns `{ user: publicUser(updated) }`.

## `publicUser(record)`

Normalized user for the SPA:

```js
{
  id, email, name, firstName, lastName,
  emailVisibility,
  verified,          // record.verified === true
  approved,          // admins forced true
  weeklyDigest,      // !weeklyDigestOptOut
  kind, isAdmin,
  transactionPageSize
}
```

## OTP

Setup enables PocketBase **email OTP** on `users` for integrations. The SPA does not wrap OTP login helpers; use PocketBase’s OTP auth APIs directly if needed.

## Verification email links

With `APP_PUBLIC_URL`, setup sets the collection verification `actionUrl` to:

```text
{APP_PUBLIC_URL}/verify-email?token={TOKEN}
```
