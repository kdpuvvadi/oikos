# Reference Data API

All endpoints in this section require authentication.

## Categories

### `GET /api/categories`

Returns all categories plus their subcategories.

Success:

- `200 OK`

Response shape:

```json
[
  {
    "id": "CATEGORY_ID",
    "name": "Transport",
    "subcategories": [
      {
        "id": "SUBCATEGORY_ID",
        "name": "Fuel",
        "category": "CATEGORY_ID"
      }
    ]
  }
]
```

### `POST /api/categories`

Admin only.

Creates a category if needed and optionally creates one subcategory under it.

Request body:

```json
{
  "name": "Transport",
  "subcategoryName": "Fuel"
}
```

Success:

- `201 Created`

Response shape:

```json
{
  "category": {
    "id": "CATEGORY_ID",
    "name": "Transport"
  },
  "subcategory": {
    "id": "SUBCATEGORY_ID",
    "name": "Fuel",
    "category": "CATEGORY_ID"
  }
}
```

### `PUT /api/categories/:id`

Admin only.

Request body:

```json
{
  "name": "Transport"
}
```

## Subcategories

### `POST /api/subcategories`

Admin only.

Request body:

```json
{
  "name": "Fuel",
  "category": "CATEGORY_ID"
}
```

### `PUT /api/subcategories/:id`

Admin only.

Request body:

```json
{
  "name": "Fuel"
}
```

## Stores

### `GET /api/stores`

Returns all stores.

### `POST /api/stores`

Admin only.

Request body:

```json
{
  "name": "Amazon"
}
```

## Payment methods

### `GET /api/payment-methods`

Returns all payment methods.

### `POST /api/payment-methods`

Admin only.

Request body:

```json
{
  "name": "Cash"
}
```

### `PUT /api/payment-methods/:id`

Admin only.

Request body:

```json
{
  "name": "Cash"
}
```

## Users

### `GET /api/users`

Admin only.

Returns all users in a public-safe shape.

If a user's PocketBase email visibility is disabled, `email` may be `null`.

Response shape:

```json
[
  {
    "id": "USER_ID",
    "email": "user@example.com",
    "name": "Example User",
    "verified": true,
    "approved": true,
    "kind": "user",
    "isAdmin": false
  }
]
```

### `POST /api/users/:id/approve`

Admin only.

Marks a verified or newly created user as approved so they can use the rest of the app after login.

Success:

- `200 OK`

Response shape:

```json
{
  "user": {
    "id": "USER_ID",
    "email": "user@example.com",
    "name": "Example User",
    "verified": true,
    "approved": true,
    "kind": "user",
    "isAdmin": false
  }
}
```
