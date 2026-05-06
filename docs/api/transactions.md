# Transactions API

All endpoints in this section require authentication.

Regular users can access only their own transactions. Admins can access all transactions.

## `GET /api/transactions`

Returns transactions sorted by descending date.

Supported query parameters:

- `month`
  Month in `YYYY-MM` format. Filters to that calendar month.
- `fromDate`
  Inclusive lower date bound in `YYYY-MM-DD` format.
- `toDate`
  Inclusive upper date bound supplied as `YYYY-MM-DD`. Internally this is converted to the next day boundary so the selected day is included.
- `category`
  Category id.
- `subcategory`
  Subcategory id.
- `store`
  Store id.
- `user`
  User id. Admin only. Ignored for non-admin users.

Example:

```curl
GET /api/transactions?fromDate=2026-04-01&toDate=2026-04-30&category=CATEGORY_ID&subcategory=SUBCATEGORY_ID
```

Response shape:

```json
[
  {
    "id": "TRANSACTION_ID",
    "date": "2026-04-27 00:00:00.000Z",
    "amount": 2364.99,
    "payment_method": "PAYMENT_METHOD_ID",
    "category": "CATEGORY_ID",
    "subcategory": "SUBCATEGORY_ID",
    "store": "STORE_ID",
    "user": "USER_ID",
    "expand": {
      "category": {
        "id": "CATEGORY_ID",
        "name": "Transport"
      },
      "subcategory": {
        "id": "SUBCATEGORY_ID",
        "name": "Fuel"
      },
      "store": {
        "id": "STORE_ID",
        "name": "Amazon"
      },
      "user": {
        "id": "USER_ID",
        "email": "user@example.com"
      },
      "payment_method": {
        "id": "PAYMENT_METHOD_ID",
        "name": "Cash"
      }
    }
  }
]
```

## `POST /api/transactions`

Creates a transaction for the currently logged-in user.

Request body:

```json
{
  "date": "2026-04-27",
  "title": "Fuel refill",
  "amount": 2364.99,
  "paymentMethod": "PAYMENT_METHOD_ID",
  "category": "CATEGORY_ID",
  "subcategory": "SUBCATEGORY_ID",
  "store": "STORE_ID",
  "storeText": "Local roadside pump"
}
```

Optional admin-only create-on-the-fly fields:

```json
{
  "categoryName": "Transport",
  "subcategoryName": "Fuel",
  "storeName": "Amazon"
}
```

Rules:

- `date` is required
- `amount` must be positive
- `category`, `subcategory`, and `store` are required after any admin-side creation logic runs
- `title` is optional
- `storeText` is required when the selected store is the seeded `Other` store
- non-admins cannot use `categoryName`, `subcategoryName`, or `storeName`
- `paymentMethod` may be omitted or blank

Success:

- `201 Created`

## `PUT /api/transactions/:id`

Updates an existing transaction.

Permissions:

- admin can update any transaction
- regular user can update only their own transaction

Request body:

```json
{
  "date": "2026-04-27",
  "title": "Fuel refill",
  "amount": 2364.99,
  "paymentMethod": "PAYMENT_METHOD_ID",
  "category": "CATEGORY_ID",
  "subcategory": "SUBCATEGORY_ID",
  "store": "STORE_ID",
  "storeText": "Local roadside pump"
}
```

Rules:

- same validation as create, except no inline category/store creation fields are supported

Failure:

- `404 Not Found` when the transaction does not exist or is not owned by the current non-admin user

## `DELETE /api/transactions/:id`

Deletes a transaction.

Permissions:

- admin can delete any transaction
- regular user can delete only their own transaction

Success:

- `204 No Content`

Failure:

- `404 Not Found` when the transaction does not exist or is not owned by the current non-admin user
