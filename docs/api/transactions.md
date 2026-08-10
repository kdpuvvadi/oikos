# Transactions

Collection: `oikos_transactions`.  
Helpers: `fetchTransactions`, `fetchTransaction`, `createTransaction`, `updateTransaction`, `deleteTransaction`.

Non-admins are scoped to `user = <self>`. Admins see all records and may filter by `user`.

## List — `fetchTransactions(query)`

| Query key | Effect |
|-----------|--------|
| `fromDate`, `toDate` | Inclusive calendar dates (`YYYY-MM-DD`); end uses next-day boundary |
| `category`, `subcategory`, `store` | Relation ids |
| `paymentMethod` | Filters `payment_method` |
| `user` | Admin only |
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

Expands the same relations. Non-owners get a not-found style error.

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

Sets `user` to the current auth user.

## Update — `updateTransaction(id, body)`

Same core fields as create (`date`, `amount`, `title`, category/subcategory/store ids, `paymentMethod`, `storeText`). Does not create reference data on the fly.

## Delete — `deleteTransaction(id)`

Owner or admin.
