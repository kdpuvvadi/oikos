import { useEffect, useMemo, useState } from 'react';
import {
  countTransactionsUsing,
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  updateCategory,
  updateSubcategory
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useData } from '../context/DataContext';
import { EditNameDialog } from '../components/EditNameDialog';
import { DeleteReferenceDialog } from '../components/DeleteReferenceDialog';

export default function CategoriesPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { categories, loadCategories, invalidate } = useData();
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [usageCount, setUsageCount] = useState(0);
  const [usageLoading, setUsageLoading] = useState(false);

  useEffect(() => {
    void loadCategories().catch((error) => toast(error.message));
  }, [loadCategories, toast]);

  useEffect(() => {
    if (!deleteTarget) {
      setUsageCount(0);
      return;
    }
    let cancelled = false;
    setUsageLoading(true);
    const field = deleteTarget.kind === 'category' ? 'category' : 'subcategory';
    void countTransactionsUsing(field, deleteTarget.id)
      .then((count) => {
        if (!cancelled) setUsageCount(count);
      })
      .catch((error) => {
        if (!cancelled) toast(error.message);
      })
      .finally(() => {
        if (!cancelled) setUsageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deleteTarget, toast]);

  async function refresh() {
    invalidate('categories', 'transactions', 'summaryTransactions', 'homeTotals');
    await loadCategories(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await createCategory(Object.fromEntries(new FormData(form)));
      form.reset();
      toast('Category saved.');
      await refresh();
    } catch (error) {
      toast(error.message);
    }
  }

  async function handleEditSubmit(name) {
    if (!editTarget) return;
    try {
      if (editTarget.kind === 'category') {
        if (name === editTarget.name) {
          setEditTarget(null);
          return;
        }
        await updateCategory(editTarget.id, { name });
        toast('Category updated.');
      } else if (editTarget.kind === 'subcategory') {
        if (name === editTarget.name) {
          setEditTarget(null);
          return;
        }
        await updateSubcategory(editTarget.id, { name });
        toast('Subcategory updated.');
      } else if (editTarget.kind === 'add-subcategory') {
        await createSubcategory({ categoryId: editTarget.categoryId, name });
        toast('Subcategory added.');
      }
      setEditTarget(null);
      await refresh();
    } catch (error) {
      toast(error.message);
      throw error;
    }
  }

  const categoryReplacements = useMemo(
    () => categories
      .filter((category) => category.id !== deleteTarget?.id)
      .map((category) => ({ id: category.id, name: category.name })),
    [categories, deleteTarget]
  );

  const subcategoryReplacements = useMemo(() => {
    if (deleteTarget?.kind !== 'subcategory') return [];
    return categories
      .flatMap((category) => (category.subcategories || []).map((subcategory) => ({
        id: subcategory.id,
        name: `${category.name} · ${subcategory.name}`,
        categoryId: category.id
      })))
      .filter((item) => item.id !== deleteTarget.id);
  }, [categories, deleteTarget]);

  async function handleDeleteConfirm(payload) {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === 'category') {
        await deleteCategory(deleteTarget.id, {
          replacementCategoryId: payload.replacementId,
          replacementSubcategoryId: payload.replacementSubcategoryId
        });
        toast('Category deleted.');
      } else {
        await deleteSubcategory(deleteTarget.id, {
          replacementId: payload.replacementId
        });
        toast('Subcategory deleted.');
      }
      setDeleteTarget(null);
      await refresh();
    } catch (error) {
      toast(error.message);
      throw error;
    }
  }

  const dialogTitle = editTarget?.kind === 'category'
    ? 'Edit category'
    : editTarget?.kind === 'subcategory'
      ? 'Edit subcategory'
      : editTarget?.kind === 'add-subcategory'
        ? `Add subcategory to ${editTarget.categoryName}`
        : '';

  const dialogLabel = editTarget?.kind === 'add-subcategory' ? 'Subcategory name' : 'Name';
  const dialogSubmit = editTarget?.kind === 'add-subcategory' ? 'Add subcategory' : 'Save changes';

  return (
    <section id="categoriesPage">
      <div className="page-title">
        <p className="eyebrow">Categories</p>
        <h1>Categories</h1>
      </div>

      {isAdmin ? (
        <form id="categoryForm" className="panel inline-form" onSubmit={handleSubmit}>
          <input type="text" name="name" placeholder="Category name" required />
          <input type="text" name="subcategoryName" placeholder="Optional subcategory" />
          <button type="submit">Add category</button>
        </form>
      ) : null}

      <div id="categoryList" className="list-grid">
        {categories.length ? categories.map((category) => (
          <article key={category.id} className="list-item ref-card">
            <div className="list-heading">
              <strong>{category.name}</strong>
              {isAdmin ? (
                <div className="ref-card-actions">
                  <button
                    type="button"
                    className="ghost small-button"
                    onClick={() => setEditTarget({
                      kind: 'category',
                      id: category.id,
                      name: category.name
                    })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ghost small-button"
                    onClick={() => setEditTarget({
                      kind: 'add-subcategory',
                      categoryId: category.id,
                      categoryName: category.name,
                      name: ''
                    })}
                  >
                    Add subcategory
                  </button>
                  <button
                    type="button"
                    className="ghost small-button danger-text"
                    onClick={() => setDeleteTarget({
                      kind: 'category',
                      id: category.id,
                      name: category.name
                    })}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
            <div className="pill-list">
              {(category.subcategories || []).length ? (
                (category.subcategories || []).map((subcategory) => (
                  <span key={subcategory.id} className="pill">
                    {subcategory.name}
                    {isAdmin ? (
                      <>
                        <button
                          type="button"
                          className="pill-button"
                          onClick={() => setEditTarget({
                            kind: 'subcategory',
                            id: subcategory.id,
                            name: subcategory.name
                          })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="pill-button"
                          onClick={() => setDeleteTarget({
                            kind: 'subcategory',
                            id: subcategory.id,
                            name: subcategory.name
                          })}
                        >
                          Delete
                        </button>
                      </>
                    ) : null}
                  </span>
                ))
              ) : (
                <span className="pill">No subcategories</span>
              )}
            </div>
          </article>
        )) : (
          <p className="panel-empty">No categories yet.</p>
        )}
      </div>

      <EditNameDialog
        open={Boolean(editTarget)}
        title={dialogTitle}
        label={dialogLabel}
        initialValue={editTarget?.name || ''}
        placeholder={editTarget?.kind === 'add-subcategory' ? 'Example: Train tickets' : ''}
        submitLabel={dialogSubmit}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEditSubmit}
      />

      <DeleteReferenceDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.kind === 'category' ? 'Delete category' : 'Delete subcategory'}
        itemName={deleteTarget?.name || ''}
        usageCount={usageCount}
        usageLoading={usageLoading}
        replacementLabel={deleteTarget?.kind === 'category' ? 'Replacement category' : 'Replacement subcategory'}
        replacementOptions={deleteTarget?.kind === 'category' ? categoryReplacements : subcategoryReplacements}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        canConfirm={({ replacementId, usageCount: count, replacementSubcategoryId }) => {
          if (deleteTarget?.kind !== 'category' || !count) return true;
          if (!replacementId) return false;
          return Boolean(replacementSubcategoryId);
        }}
        extraFields={deleteTarget?.kind === 'category' && usageCount > 0
          ? ({ replacementId, values, setValues, saving }) => {
            const selected = categories.find((category) => category.id === replacementId);
            const subcategories = selected?.subcategories || [];
            return (
              <label>
                Replacement subcategory
                <select
                  required
                  disabled={saving || !replacementId || !subcategories.length}
                  value={values.replacementSubcategoryId || ''}
                  onChange={(event) => setValues((current) => ({
                    ...current,
                    replacementSubcategoryId: event.target.value
                  }))}
                >
                  <option value="">
                    {!replacementId
                      ? 'Select a category first'
                      : subcategories.length
                        ? 'Select subcategory'
                        : 'Selected category has no subcategories'}
                  </option>
                  {subcategories.map((subcategory) => (
                    <option key={subcategory.id} value={subcategory.id}>
                      {subcategory.name}
                    </option>
                  ))}
                </select>
              </label>
            );
          }
          : null}
      />
    </section>
  );
}
