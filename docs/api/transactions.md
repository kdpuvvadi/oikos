# Transactions

Collection: `oikos_transactions`.  
Helpers: `fetchTransactions`, `fetchTransaction`, `createTransaction`, `updateTransaction`, `deleteTransaction`, `fetchSharedTransaction`, `enableTransactionShare`, `disableTransactionShare`.

Non-admins are scoped to `user = <self>`. Admins see all records and may filter by `user`.

Soft-delete: `deleteTransaction` sets `archived = true` (and clears `shareKey`). Archived rows are excluded from normal lists, home totals, dashboard summary, digests, and public share links.

## List — `fetchTransactions(query)`

| Query key | Effect |
|-----------|--------|
| `fromDate`, `toDate` | Inclusive calendar dates (`YYYY-MM-DD`); end uses next-day boundary |
| `category`, `subcategory`, `store` | Relation ids |
| `paymentMethod` | Filters `payment_method` |
| `user` | Admin only |
| `deleted` | Admin only; truthy → only `archived = true` (otherwise `archived = false`) |
| `page` | Default `1` |
| `perPage` | Default user’s `transactionPageSize` (normalized to 10/25/50/100) |
| `includeTotalAmount` | If truthy and results span multiple pages, loads amounts for `totalAmount` |

Expand: `category,subcategory,store,user,payment_method`. Sort: `-date`.

Returns:

```js
{
  items, page, perPage, totalItems, totalPages,
  totalAmount  // page sum, or full filtered sum when includeTotalAmount
}
```

## One — `fetchTransaction(id)`

Expands the same relations. Non-owners get a not-found style error. Non-admins cannot load archived records.

## Public share — `GET /api/oikos/shared-transactions/{id}?key=…`

PocketBase hook (`pb_hooks/shared-transaction.pb.js`). Also: `fetchSharedTransaction(id, key)`.

When a transaction has a non-empty `shareKey`, anyone with the matching key can load a **sanitized** read-only view (no user PII). Wrong/missing keys, or archived records, return 404.

SPA URL: `/transactions/:id?key=<shareKey>`.

| Helper | Effect |
|--------|--------|
| `enableTransactionShare(id)` | Creates a `shareKey` if missing (owner/admin); refused when archived |
| `disableTransactionShare(id)` | Clears `shareKey` (revokes the link) |
| `publicTransactionShareUrl(id, key)` | Builds the absolute share URL |

## Create — `createTransaction(body)`

| Field | Required | Notes |
|-------|----------|--------|
| `date` | yes | `YYYY-MM-DD` |
| `amount` | yes | number &gt; 0 |
| `title` | no | |
| `category`, `subcategory`, `store` | yes* | ids |
| `paymentMethod` | no | → `payment_method` |
| `storeText` | if store is “other” | free-text label |
| `categoryName`, `subcategoryName`, `storeName` | admin only | create-or-reuse by name |

\* Unless admin supplies `*Name` fields to create reference rows first.

Sets `user` to the current auth user and `archived` to `false`.

## Update — `updateTransaction(id, body)`

Same core fields as create (`date`, `amount`, `title`, category/subcategory/store ids, `paymentMethod`, `storeText`). Does not create reference data on the fly. Does not change `shareKey` (use the share helpers). Refused when archived.

## Delete — `deleteTransaction(id)`

Owner or admin. Soft-deletes by setting `archived = true` and clearing `shareKey` (record is kept).
