# Reference data & users

Shared catalogs are admin-managed for writes; approved users (and admins) can read them for expense entry.

## Categories

| Helper | Notes |
|--------|--------|
| `fetchCategories()` | Categories with nested `subcategories` |
| `createCategory({ name, subcategoryName })` | Admin; optional first subcategory |
| `createSubcategory({ categoryId, name })` | Admin |
| `updateCategory(id, { name })` | Admin |
| `updateSubcategory(id, { name })` | Admin |
| `deleteCategory(id, { replacementCategoryId, replacementSubcategoryId })` | Admin; reassigns then deletes |
| `deleteSubcategory(id, { replacementId })` | Admin |

## Stores

| Helper | Notes |
|--------|--------|
| `fetchStores()` | |
| `createStore({ name })` | Admin |
| `updateStore(id, { name })` | Admin |
| `deleteStore(id, { replacementId })` | Admin; reassigns transactions when needed |

## Payment methods

| Helper | Notes |
|--------|--------|
| `fetchPaymentMethods()` | |
| `createPaymentMethod({ name })` | Admin |
| `updatePaymentMethod(id, { name })` | Admin |
| `deletePaymentMethod(id, { replacementId })` | Admin |

## Usage counts

`countTransactionsUsing(field, id)` — how many transactions reference a relation field (`store`, `payment_method`, `category`, `subcategory`, etc.). Used before delete dialogs.

## Users (admin)

| Helper | Notes |
|--------|--------|
| `fetchUsers()` | Maps records through `publicUser` |
| `approveUser(userId)` | Sets `approved: true` |
| `adminResendVerification(userId)` | `requestVerification` for that user’s email |

There is **no** mark-verified admin helper in the client; verification is email (or PocketBase Admin).

Promote to admin via CLI:

```bash
PB_URL=http://127.0.0.1:8090 npm run make:admin
```

(`kind: 'admin'`, `approved: true`)
