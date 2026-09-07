# Auth

Helpers: `register`, `login`, `loginWithOAuth`, `linkOAuth`, `unlinkOAuth`, `getSignInMethods`, `listOAuthProviders`, `listLinkedAuthProviders`, `logout`, `getCurrentUser`, `updateProfile`, `requestVerification`, `verifyEmail`, `isVerificationTokenSpent`, `publicUser`.

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

## Google / OAuth — `loginWithOAuth(provider)` / `listOAuthProviders()`

`listOAuthProviders()` calls PocketBase `users.listAuthMethods()` and returns `{ name, displayName }` for enabled OAuth2 providers. The auth page only shows **Continue with Google** when Google is enabled.

`loginWithOAuth('google')` uses the SDK all-in-one popup (`authWithOAuth2`). Redirect URI registered with Google must be `{APP_PUBLIC_URL or PB_URL}/api/oauth2-redirect`.

New Google users are created with `kind: 'user'`, `emailVisibility: true`, and **`approved: true`** (`pb_hooks/oauth.pb.js`, including `onRecordCreateRequest` when `@request.context` is `oauth2`). Google-confirmed emails are typically `verified: true`, so they skip `/verify-email` and enter the app without admin approval. Email/password signups remain unapproved until an admin allows them.

Existing users with the same email are linked by PocketBase. After a **password** login, if Google is enabled and not linked, the SPA asks once to link it. Google logins do not show that prompt (Google is already in use). They can also link later under **Me**.

Public policy pages (for Google’s OAuth consent screen): `/privacy`, `/terms`.

Returns the same shape as password `login`, plus `isNew` when PocketBase created the record.

## Sign-in methods — `getSignInMethods()` / `linkOAuth(provider)`

`getSignInMethods()` returns how the signed-in user can log in:

```js
{
  password: true,
  oauth: [{ name: 'google', displayName: 'Google', linked: false }]
}
```

Linked providers come from `_externalAuths` (`recordRef` = current user). The Me page shows **Email and password** as available and **Google** as Linked, or a **Link Google** button when the provider is enabled but not connected.

`linkOAuth('google')` runs the same OAuth popup while the user is already signed in. PocketBase attaches the Google identity to the current record. If that Google account is already tied to a different user, the previous session is restored and the helper throws.

`unlinkOAuth('google')` deletes the `_externalAuths` row. Used when the user declines the first-login link prompt after Google matched an existing account.

SPA: `/me` → Sign-in.

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
