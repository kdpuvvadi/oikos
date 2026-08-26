/// <reference path="../pb_data/types/types.d.ts" />

/**
 * Public shared transaction view (no auth).
 * GET /api/oikos/shared-transactions/{id}?key=...
 *
 * Returns a sanitized payload when the transaction has a matching shareKey.
 * Wrong/missing keys and unknown ids all respond as 404.
 */
routerAdd("GET", "/api/oikos/shared-transactions/{id}", (e) => {
  function fieldString(record, name) {
    try {
      if (typeof record.getString === "function") {
        return String(record.getString(name) || "").trim();
      }
    } catch (error) {
      // fall through
    }
    try {
      return String(record.get(name) || "").trim();
    } catch (error) {
      return "";
    }
  }

  function relationName(collection, id) {
    const recordId = String(id || "").trim();
    if (!recordId) return "";
    try {
      const related = $app.findRecordById(collection, recordId);
      return fieldString(related, "name");
    } catch (error) {
      return "";
    }
  }

  const id = String(e.request.pathValue("id") || "").trim();
  let key = "";
  try {
    const query = e.requestInfo().query || {};
    key = String(query.key || "").trim();
  } catch (error) {
    try {
      key = String(e.request.url.query().get("key") || "").trim();
    } catch (inner) {
      key = "";
    }
  }

  if (!id || !key) {
    throw new NotFoundError("Shared transaction not found.");
  }

  let record;
  try {
    record = $app.findRecordById("oikos_transactions", id);
  } catch (error) {
    throw new NotFoundError("Shared transaction not found.");
  }

  const shareKey = fieldString(record, "shareKey");
  if (!shareKey || shareKey !== key) {
    throw new NotFoundError("Shared transaction not found.");
  }

  const paymentMethodId = fieldString(record, "payment_method");
  const categoryId = fieldString(record, "category");
  const subcategoryId = fieldString(record, "subcategory");
  const storeId = fieldString(record, "store");

  let amount = 0;
  try {
    amount = Number(record.get("amount") || 0);
  } catch (error) {
    amount = 0;
  }

  return e.json(200, {
    id: record.id,
    date: fieldString(record, "date"),
    title: fieldString(record, "title"),
    amount: amount,
    storeText: fieldString(record, "storeText"),
    shared: true,
    expand: {
      category: categoryId ? { id: categoryId, name: relationName("oikos_categories", categoryId) } : null,
      subcategory: subcategoryId ? { id: subcategoryId, name: relationName("oikos_subcategories", subcategoryId) } : null,
      store: storeId ? { id: storeId, name: relationName("oikos_stores", storeId) } : null,
      payment_method: paymentMethodId
        ? { id: paymentMethodId, name: relationName("oikos_payment_methods", paymentMethodId) }
        : null
    }
  });
});
