import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  countTransactionsUsing,
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

export default function CategoryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { categories, loadCategories, invalidate } = useData();
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [usageCount, setUsageCount] = useState(0);
  const [usageLoading, setUsageLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void loadCategories()
      .catch((error) => toast(error.message))
      .finally(() => setLoaded(true));
  }, [loadCategories, toast]);

  const category = useMemo(
    () => categories.find((item) => item.id === id) || null,
    [categories, id]
  );

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

  async function handleAddSubcategory(event) {
    event.preventDefault();
    if (!category) return;
    const form = event.currentTarget;
    const name = String(new FormData(form).get('name') || '').trim();
    if (!name) return;
    try {
      await createSubcategory({ categoryId: category.id, name });
      form.reset();
      toast('Subcategory added.');
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
      .filter((item) => item.id !== deleteTarget?.id)
      .map((item) => ({ id: item.id, name: item.name })),
    [categories, deleteTarget]
  );

  const subcategoryReplacements = useMemo(() => {
    if (deleteTarget?.kind !== 'subcategory') return [];
    return categories
      .flatMap((item) => (item.subcategories || []).map((subcategory) => ({
        id: subcategory.id,
        name: `${item.name} · ${subcategory.name}`,
        categoryId: item.id
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
        setDeleteTarget(null);
        navigate('/categories', { replace: true });
        await refresh();
        return;
      }
      await deleteSubcategory(deleteTarget.id, {
        replacementId: payload.replacementId
      });
      toast('Subcategory deleted.');
      setDeleteTarget(null);
      await refresh();
    } catch (error) {
      toast(error.message);
      throw error;
    }
  }

  if (!loaded) {
    return (
      <section id="categoryDetailPage">
        <p className="panel-empty">Loading…</p>
      </section>
    );
  }

  if (!category) {
    return (
      <section id="categoryDetailPage">
        <div className="page-title-bar">
          <div className="page-title">
            <p className="eyebrow">Categories</p>
            <h1>Category not found</h1>
          </div>
          <Link className="ghost button-link" to="/categories">Back to categories</Link>
        </div>
        <p className="panel-empty">This category does not exist or was deleted.</p>
      </section>
    );
  }

  const subcategories = category.subcategories || [];

  return (
    <section id="categoryDetailPage">
      <div className="page-title-bar">
        <div className="page-title">
          <p className="eyebrow">
            <Link to="/categories" className="ghost-link">Categories</Link>
          </p>
          <h1>{category.name}</h1>
        </div>
        {isAdmin ? (
          <div className="ref-card-actions category-detail-actions">
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

      {isAdmin ? (
        <form className="panel inline-form" onSubmit={handleAddSubcategory}>
          <input type="text" name="name" placeholder="Subcategory name" required />
          <button type="submit">Add subcategory</button>
        </form>
      ) : null}

      <div className="list-grid compact">
        {subcategories.length ? subcategories.map((subcategory) => (
          <article key={subcategory.id} className="ref-item ref-card">
            <div className="list-heading">
              <strong>{subcategory.name}</strong>
              {isAdmin ? (
                <div className="ref-card-actions">
                  <button
                    type="button"
                    className="ghost small-button"
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
                    className="ghost small-button danger-text"
                    onClick={() => setDeleteTarget({
                      kind: 'subcategory',
                      id: subcategory.id,
                      name: subcategory.name
                    })}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        )) : (
          <p className="panel-empty">No subcategories yet.</p>
        )}
      </div>

      <EditNameDialog
        open={Boolean(editTarget)}
        title={editTarget?.kind === 'category' ? 'Edit category' : 'Edit subcategory'}
        label="Name"
        initialValue={editTarget?.name || ''}
        submitLabel="Save changes"
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
            const selected = categories.find((item) => item.id === replacementId);
            const options = selected?.subcategories || [];
            return (
              <label>
                Replacement subcategory
                <select
                  required
                  disabled={saving || !replacementId || !options.length}
                  value={values.replacementSubcategoryId || ''}
                  onChange={(event) => setValues((current) => ({
                    ...current,
                    replacementSubcategoryId: event.target.value
                  }))}
                >
                  <option value="">
                    {!replacementId
                      ? 'Select a category first'
                      : options.length
                        ? 'Select subcategory'
                        : 'Selected category has no subcategories'}
                  </option>
                  {options.map((subcategory) => (
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
